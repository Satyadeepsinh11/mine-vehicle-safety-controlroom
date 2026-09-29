"""Incident reporting endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import IncidentLog, User
from ..schemas import IncidentOut

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/incidents", response_model=list[IncidentOut])
def incidents(
    event_type: str | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(IncidentLog)
    if event_type:
        query = query.filter(IncidentLog.event_type == event_type)
    return query.order_by(IncidentLog.timestamp.desc()).limit(min(limit, 1000)).all()


@router.delete("/incidents")
def clear(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    deleted = db.query(IncidentLog).delete()
    db.commit()
    return {"deleted": deleted}
