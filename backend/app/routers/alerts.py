"""
Alerts router — CRUD for alert rules and querying alert events.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.alert_event import AlertEvent
from app.models.alert_rule import AlertRule
from app.models.device import Device
from app.models.user import User
from app.schemas.alert import (
    AlertEventAcknowledge,
    AlertEventResponse,
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
    AlertStats,
)
from app.utils.deps import get_current_admin, get_current_user

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


# ==========================================
# Alert Rules
# ==========================================


@router.get("/rules", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    device_id: Optional[uuid.UUID] = Query(None, description="Filter by device"),
    enabled_only: Optional[bool] = Query(None, description="Filter by enabled status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all alert rules, optionally filtered by device or status."""
    query = select(AlertRule).order_by(AlertRule.created_at.desc())

    if device_id is not None:
        query = query.where(AlertRule.device_id == device_id)
    if enabled_only is not None:
        query = query.where(AlertRule.enabled == enabled_only)

    result = await db.execute(query)
    rules = result.scalars().all()

    # Enrich with device names
    response = []
    for rule in rules:
        rule_data = AlertRuleResponse.model_validate(rule)
        if rule.device:
            rule_data.device_name = rule.device.name
        response.append(rule_data)

    return response


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
async def create_alert_rule(
    payload: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new alert rule for a device."""
    # Verify device exists
    device_result = await db.execute(
        select(Device).where(Device.id == payload.device_id)
    )
    device = device_result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    rule = AlertRule(**payload.model_dump())
    db.add(rule)
    await db.flush()
    await db.commit()
    await db.refresh(rule)

    response = AlertRuleResponse.model_validate(rule)
    response.device_name = device.name
    return response


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: uuid.UUID,
    payload: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update an existing alert rule."""
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)

    await db.flush()
    await db.commit()
    await db.refresh(rule)

    response = AlertRuleResponse.model_validate(rule)
    if rule.device:
        response.device_name = rule.device.name
    return response


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete an alert rule and all its events."""
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    await db.delete(rule)
    await db.commit()


# ==========================================
# Alert Events
# ==========================================


@router.get("/events", response_model=list[AlertEventResponse])
async def list_alert_events(
    device_id: Optional[uuid.UUID] = Query(None, description="Filter by device"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledged status"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List alert events with filters and pagination."""
    query = select(AlertEvent).order_by(desc(AlertEvent.triggered_at))

    if device_id is not None:
        query = query.where(AlertEvent.device_id == device_id)
    if severity is not None:
        query = query.where(AlertEvent.severity == severity)
    if acknowledged is not None:
        query = query.where(AlertEvent.acknowledged == acknowledged)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    # Enrich with device names
    response = []
    for event in events:
        event_data = AlertEventResponse.model_validate(event)
        if event.device:
            event_data.device_name = event.device.name
        response.append(event_data)

    return response


@router.put("/events/{event_id}/acknowledge", response_model=AlertEventResponse)
async def acknowledge_alert_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge an alert event."""
    result = await db.execute(select(AlertEvent).where(AlertEvent.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Alert event not found")

    event.acknowledged = True
    await db.flush()
    await db.commit()
    await db.refresh(event)

    response = AlertEventResponse.model_validate(event)
    if event.device:
        response.device_name = event.device.name
    return response


@router.put("/events/acknowledge-all")
async def acknowledge_all_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge all unacknowledged alert events."""
    await db.execute(
        update(AlertEvent)
        .where(AlertEvent.acknowledged == False)
        .values(acknowledged=True)
    )
    await db.commit()
    return {"message": "All alerts acknowledged"}


# ==========================================
# Alert Stats
# ==========================================


@router.get("/stats", response_model=AlertStats)
async def alert_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregate alert statistics for the dashboard."""
    total_rules = (await db.execute(select(func.count(AlertRule.id)))).scalar() or 0
    active_rules = (
        await db.execute(
            select(func.count(AlertRule.id)).where(AlertRule.enabled == True)
        )
    ).scalar() or 0
    total_events = (await db.execute(select(func.count(AlertEvent.id)))).scalar() or 0
    unacknowledged = (
        await db.execute(
            select(func.count(AlertEvent.id)).where(AlertEvent.acknowledged == False)
        )
    ).scalar() or 0
    critical_count = (
        await db.execute(
            select(func.count(AlertEvent.id)).where(
                AlertEvent.severity == "critical",
                AlertEvent.acknowledged == False,
            )
        )
    ).scalar() or 0
    warning_count = (
        await db.execute(
            select(func.count(AlertEvent.id)).where(
                AlertEvent.severity == "warning",
                AlertEvent.acknowledged == False,
            )
        )
    ).scalar() or 0
    info_count = (
        await db.execute(
            select(func.count(AlertEvent.id)).where(
                AlertEvent.severity == "info",
                AlertEvent.acknowledged == False,
            )
        )
    ).scalar() or 0

    return AlertStats(
        total_rules=total_rules,
        active_rules=active_rules,
        total_events=total_events,
        unacknowledged=unacknowledged,
        critical_count=critical_count,
        warning_count=warning_count,
        info_count=info_count,
    )
