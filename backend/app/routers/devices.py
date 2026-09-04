"""
Devices router — CRUD endpoints for device management.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.device import Device
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceSummary, DeviceUpdate
from app.utils.deps import get_current_user, get_current_admin

router = APIRouter(prefix="/api/devices", tags=["Devices"])


@router.get("", response_model=list[DeviceSummary])
async def list_devices(
    online_only: Optional[bool] = Query(None, description="Filter by online status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all registered devices with optional online filter."""
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(seconds=settings.DEVICE_OFFLINE_TIMEOUT)

    query = select(Device).order_by(Device.created_at.desc())

    if online_only is True:
        query = query.where(Device.is_online == True, Device.last_seen >= threshold)
    elif online_only is False:
        query = query.where(
            (Device.is_online == False) | (Device.last_seen < threshold) | (Device.last_seen == None)
        )

    result = await db.execute(query)
    devices = result.scalars().all()

    # Dynamically verify is_online accurately reflects real-time freshness
    for device in devices:
        if device.is_online and (device.last_seen is None or device.last_seen < threshold):
            device.is_online = False

    return devices


@router.get("/stats")
async def device_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregate device statistics for the dashboard header."""
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(seconds=settings.DEVICE_OFFLINE_TIMEOUT)

    total = await db.execute(select(func.count(Device.id)))
    online = await db.execute(
        select(func.count(Device.id)).where(
            Device.is_online == True,
            Device.last_seen >= threshold,
        )
    )

    total_count = total.scalar() or 0
    online_count = online.scalar() or 0

    return {
        "total": total_count,
        "online": online_count,
        "offline": total_count - online_count,
    }


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single device by ID."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    now = datetime.now(timezone.utc)
    threshold = now - timedelta(seconds=settings.DEVICE_OFFLINE_TIMEOUT)
    if device.is_online and (device.last_seen is None or device.last_seen < threshold):
        device.is_online = False

    return device


@router.post("", response_model=DeviceResponse, status_code=201)
async def create_device(
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Register a new device."""
    # Check for duplicate MAC
    existing = await db.execute(
        select(Device).where(Device.mac_address == payload.mac_address)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail="Device with this MAC address already exists"
        )

    device = Device(**payload.model_dump())
    db.add(device)
    await db.flush()
    await db.commit()
    await db.refresh(device)
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: uuid.UUID,
    payload: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update an existing device's configuration."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(device, key, value)

    await db.flush()
    await db.commit()
    await db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete a device and all its telemetry data."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.delete(device)
    await db.commit()
