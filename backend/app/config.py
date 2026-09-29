"""Environment configuration for the collision avoidance backend."""
import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./collision.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    CORS_ORIGINS: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ]
    # Either a local webcam index or the ESP32-CAM MJPEG URL
    CAMERA_SOURCE: str = os.getenv("CAMERA_SOURCE", "0")
    ESP32_STREAM_URL: str = os.getenv("ESP32_STREAM_URL", "")

    CRITICAL_CM: float = 20.0
    WARNING_CM: float = 45.0


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
