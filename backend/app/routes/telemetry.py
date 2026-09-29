"""Telemetry ingest and history."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import TelemetryLog, User
from ..schemas import TelemetryIn, TelemetryOut
from ..vision.cv_pipeline import pipeline

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.post("", response_model=TelemetryOut)
def ingest(payload: TelemetryIn, db: Session = Depends(get_db)):
    """HTTP fallback for nodes that cannot hold a WebSocket open."""
    risk = pipeline.update(payload.distance_cm, payload.speed_pct)
    row = TelemetryLog(
        distance_cm=payload.distance_cm,
        risk_level=risk,
        emergency_brake_triggered=risk == "CRITICAL",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/latest")
def latest(current_user: User = Depends(get_current_user)):
    return {
        "distance_cm": pipeline.distance_cm,
        "risk_level": pipeline.risk_level,
        "speed_pct": pipeline.speed_pct,
        "emergency_brake": pipeline.brake,
    }


@router.get("/history", response_model=list[TelemetryOut])
def history(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(TelemetryLog)
        .order_by(TelemetryLog.timestamp.desc())
        .limit(min(limit, 1000))
        .all()
    )
