"""Pydantic v2 schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    created_at: datetime


class TelemetryIn(BaseModel):
    distance_cm: float = Field(ge=0, le=1000)
    speed_pct: int = Field(default=0, ge=0, le=100)


class TelemetryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    distance_cm: float
    risk_level: str
    emergency_brake_triggered: bool


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    event_type: str
    distance_at_brake: float
    action_taken: str


class CommandIn(BaseModel):
    action: str = Field(pattern="^(FORWARD|BACKWARD|LEFT|RIGHT|STOP)$")
