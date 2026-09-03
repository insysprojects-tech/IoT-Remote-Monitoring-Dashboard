"""
Alert Service — evaluates incoming telemetry against alert rules and fires events.

This service is called by the MQTT service after each telemetry write.
When a rule is violated, it:
1. Creates an AlertEvent record in the database
2. Broadcasts the alert to connected WebSocket clients
"""

import asyncio
import logging
import operator as op
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from sqlalchemy import select, update, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.alert_rule import AlertRule
from app.models.alert_event import AlertEvent
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.config import settings

logger = logging.getLogger(__name__)

# Operator mapping
OPERATORS = {
    "<": op.lt,
    ">": op.gt,
    "<=": op.le,
    ">=": op.ge,
    "==": op.eq,
}

# Metrics that can be evaluated as float values
FLOAT_METRICS = {"battery_1_voltage", "battery_2_voltage"}


class AlertService:
    """
    Evaluates telemetry data against configured alert rules.
    Manages alert event lifecycle (trigger, resolve, cooldown).
    """

    def __init__(self):
        self._broadcast_callback: Optional[Callable] = None
        self._offline_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
        # Cooldown tracking: (rule_id) -> last_triggered_at
        # Prevents spamming alerts for the same rule
        self._cooldowns: dict[str, datetime] = {}
        self._cooldown_seconds = 300  # 5-minute cooldown between repeat alerts

    def set_broadcast_callback(self, callback: Callable):
        """Register a callback to broadcast alerts to WebSocket clients."""
        self._broadcast_callback = callback

    async def evaluate_telemetry(
        self,
        session: AsyncSession,
        device_id,
        device_name: str,
        telemetry_data: dict,
    ):
        """
        Check all active rules for a device against incoming telemetry.
        Creates alert events for any violated rules.
        """
        # Fetch active rules for this device
        result = await session.execute(
            select(AlertRule).where(
                AlertRule.device_id == device_id,
                AlertRule.enabled == True,
            )
        )
        rules = result.scalars().all()

        if not rules:
            return

        now = datetime.now(timezone.utc)

        for rule in rules:
            try:
                await self._evaluate_rule(session, rule, device_name, telemetry_data, now)
            except Exception as e:
                logger.error(f"Error evaluating alert rule {rule.id}: {e}")

    async def _evaluate_rule(
        self,
        session: AsyncSession,
        rule: AlertRule,
        device_name: str,
        telemetry_data: dict,
        now: datetime,
    ):
        """Evaluate a single rule against telemetry data."""
        metric_value = telemetry_data.get(rule.metric)
        if metric_value is None:
            return

        # Convert to float for numeric metrics
        if rule.metric in FLOAT_METRICS:
            try:
                metric_value = float(metric_value)
            except (ValueError, TypeError):
                return
        else:
            # For AC status, compare as string
            return

        # Get the comparison operator function
        compare_fn = OPERATORS.get(rule.operator)
        if compare_fn is None:
            logger.warning(f"Unknown operator: {rule.operator}")
            return

        # Check if rule is violated
        is_violated = compare_fn(metric_value, rule.threshold)

        if is_violated:
            # Check cooldown — don't spam alerts
            rule_key = str(rule.id)
            last_triggered = self._cooldowns.get(rule_key)
            if last_triggered and (now - last_triggered).total_seconds() < self._cooldown_seconds:
                return  # Still in cooldown period

            # Create alert event
            message = (
                f"{device_name or 'Unknown Device'}: "
                f"{rule.metric.replace('_', ' ').title()} is {metric_value:.2f}V "
                f"({rule.operator} {rule.threshold}V threshold)"
            )

            event = AlertEvent(
                rule_id=rule.id,
                device_id=rule.device_id,
                metric=rule.metric,
                value=metric_value,
                severity=rule.severity,
                message=message,
                triggered_at=now,
            )
            session.add(event)
            await session.flush()

            # Update cooldown
            self._cooldowns[rule_key] = now

            logger.info(f"🔔 Alert fired: {message}")

            # Broadcast to WebSocket clients
            if self._broadcast_callback:
                alert_data = {
                    "type": "alert",
                    "id": str(event.id),
                    "rule_id": str(rule.id),
                    "device_id": str(rule.device_id),
                    "device_name": device_name,
                    "metric": rule.metric,
                    "value": metric_value,
                    "operator": rule.operator,
                    "threshold": rule.threshold,
                    "severity": rule.severity,
                    "message": message,
                    "acknowledged": False,
                    "triggered_at": now.isoformat(),
                }
                await self._broadcast_callback(alert_data)

    async def start_offline_detection(self):
        """Start the background task that detects offline devices and purges old telemetry."""
        self._running = True
        self._offline_task = asyncio.create_task(self._offline_detection_loop())
        logger.info("Device offline detection started")

        if settings.ENABLE_APP_RETENTION_CLEANUP:
            self._cleanup_task = asyncio.create_task(self._retention_cleanup_loop())
            logger.info(
                f"Telemetry retention cleanup started (keeping last {settings.TELEMETRY_RETENTION_HOURS}h, runs every {settings.CLEANUP_INTERVAL_MINUTES}m)"
            )

    async def stop_offline_detection(self):
        """Stop background tasks."""
        self._running = False
        if self._offline_task:
            self._offline_task.cancel()
            try:
                await self._offline_task
            except asyncio.CancelledError:
                pass
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("Background detection and retention services stopped")

    async def _offline_detection_loop(self):
        """
        Periodically check for devices that haven't sent data recently.
        Marks them as offline and creates alert events.
        """
        while self._running:
            try:
                await asyncio.sleep(settings.DEVICE_OFFLINE_CHECK_INTERVAL)
                await self._check_offline_devices()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in offline detection: {e}")
                await asyncio.sleep(30)

    async def _check_offline_devices(self):
        """Check for devices that have gone offline."""
        now = datetime.now(timezone.utc)
        threshold_time = now - timedelta(seconds=settings.DEVICE_OFFLINE_TIMEOUT)

        async with async_session() as session:
            # Find devices that are marked online but haven't been seen recently
            result = await session.execute(
                select(Device).where(
                    Device.is_online == True,
                    Device.last_seen < threshold_time,
                )
            )
            stale_devices = result.scalars().all()

            for device in stale_devices:
                # Mark as offline
                await session.execute(
                    update(Device)
                    .where(Device.id == device.id)
                    .values(is_online=False, updated_at=now)
                )

                logger.info(f"📴 Device {device.name or device.mac_address} marked offline")

                # Broadcast offline status
                if self._broadcast_callback:
                    await self._broadcast_callback({
                        "type": "device_offline",
                        "device_id": str(device.id),
                        "device_name": device.name,
                        "mac_address": device.mac_address,
                        "last_seen": device.last_seen.isoformat() if device.last_seen else None,
                    })

            if stale_devices:
                await session.commit()

    async def _retention_cleanup_loop(self):
        """
        Periodically purge telemetry older than TELEMETRY_RETENTION_HOURS (default 24h).
        Protects the Supabase 500 MB free tier limit from overflowing.
        """
        interval_seconds = max(60, settings.CLEANUP_INTERVAL_MINUTES * 60)
        # Initial wait of 30 seconds after boot before running the first cleanup
        await asyncio.sleep(30)

        while self._running:
            try:
                await self._purge_old_telemetry()
                await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in telemetry retention cleanup: {e}")
                await asyncio.sleep(60)

    async def _purge_old_telemetry(self):
        """Delete telemetry older than configured retention period."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.TELEMETRY_RETENTION_HOURS)
        async with async_session() as session:
            try:
                stmt = delete(Telemetry).where(Telemetry.time < cutoff)
                result = await session.execute(stmt)
                await session.commit()
                deleted_rows = result.rowcount
                if deleted_rows > 0:
                    logger.info(
                        f"🧹 [Data Retention] Purged {deleted_rows} telemetry records older than {settings.TELEMETRY_RETENTION_HOURS}h"
                    )
            except Exception as e:
                await session.rollback()
                logger.warning(f"Telemetry retention cleanup query encountered an issue: {e}")


# Singleton instance
alert_service = AlertService()

