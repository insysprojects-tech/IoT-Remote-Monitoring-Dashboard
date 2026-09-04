"""
IoT Remote Monitoring Dashboard — Backend Configuration

Loads settings from environment variables (.env file).
"""

import json
from typing import Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- App ---
    APP_NAME: str = "IoT Remote Monitoring Dashboard"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://iotdash:iotdash_dev@localhost:5433/iotdash_db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """
        Normalize database URL for asyncpg and Supabase compatibility:
        - Automatically prefix postgresql+asyncpg:// if standard postgres:// or postgresql:// is provided.
        - Handle sslmode query params (asyncpg uses ssl=require instead of sslmode=require).
        """
        if not isinstance(v, str):
            return v
        url = v.strip()
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        
        # Replace sslmode with ssl for asyncpg compatibility
        if "sslmode=require" in url:
            url = url.replace("sslmode=require", "ssl=require")
        elif "sslmode=prefer" in url:
            url = url.replace("sslmode=prefer", "ssl=prefer")
        elif "sslmode=disable" in url:
            url = url.replace("sslmode=disable", "ssl=disable")
            
        return url

    # --- MQTT ---
    MQTT_BROKER_HOST: str = "j18eff7a.ala.asia-southeast1.emqxsl.com"
    MQTT_BROKER_PORT: int = 8883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""
    MQTT_TOPIC_PATTERN: str = "test/devices/+/power"
    MQTT_USE_TLS: bool = True

    # --- JWT Auth ---
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- CORS ---
    CORS_ORIGINS: Union[list[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def parse_cors_origins(cls, v):
        """Allow CORS origins as JSON list string, single string, or comma-separated string."""
        origins = []
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    origins = json.loads(v)
                except Exception:
                    origins = [origin.strip() for origin in v.split(",") if origin.strip()]
            else:
                origins = [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            origins = list(v)

        # Always include both localhost and 127.0.0.1 variants for local testing
        dev_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        for dev_origin in dev_origins:
            if dev_origin not in origins:
                origins.append(dev_origin)

        return origins

    # --- Device Offline Detection ---
    DEVICE_OFFLINE_TIMEOUT: int = 10  # Seconds without data before marking offline (firmware sends every 3s)
    DEVICE_OFFLINE_CHECK_INTERVAL: int = 2  # How often to check for offline devices (seconds)

    # --- Data Retention (Supabase Free Tier Safety) ---
    TELEMETRY_RETENTION_HOURS: int = 24  # Keep last 24 hours of telemetry
    CLEANUP_INTERVAL_MINUTES: int = 60  # Run retention cleanup every hour
    ENABLE_APP_RETENTION_CLEANUP: bool = True  # Backup retention task in FastAPI

    model_config = {
        "env_file": (".env", "../.env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()

