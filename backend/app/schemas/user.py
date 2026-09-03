"""
Pydantic schemas for User — authentication requests and responses.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserLogin(BaseModel):
    """Login request."""

    username: str
    password: str


class UserCreate(BaseModel):
    """Admin endpoint — create a new user."""

    username: str = Field(..., min_length=3, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    password: str = Field(..., min_length=6)
    role: str = Field("user", pattern="^(admin|user)$")


class UserResponse(BaseModel):
    """User info returned by the API (no password hash)."""

    id: uuid.UUID
    username: str
    email: Optional[str] = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PasswordChangeRequest(BaseModel):
    """Change password request."""
    old_password: str
    new_password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    """JWT token returned after successful login."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
