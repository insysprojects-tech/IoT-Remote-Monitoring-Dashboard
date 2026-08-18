"""
Authentication router — Login and Registration.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserResponse
from app.utils.deps import get_current_admin, get_current_user
from app.utils.security import create_access_token, verify_password, hash_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate a user and return a JWT access token.
    Uses standard OAuth2 password flow (username/password).
    """
    # Find user by username
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate JWT Token
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 1440 * 60  # 24 hours in seconds (matching default in security config)
    }


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    Register a new user. Only admins can perform this action.
    """
    # Check if username or email exists
    result = await db.execute(
        select(User).where((User.username == payload.username) | (User.email == payload.email))
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered"
        )

    hashed_password = hash_password(payload.password)
    new_user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hashed_password,
        role=payload.role
    )
    
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return new_user


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently logged-in user."""
    return current_user
