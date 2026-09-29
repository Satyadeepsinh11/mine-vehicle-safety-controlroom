"""Protected manual vehicle control endpoints."""
from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..schemas import CommandIn
from ..sockets.socket_manager import VEHICLE_ROOM, sio
from ..vision.cv_pipeline import pipeline

router = APIRouter(prefix="/api/vehicle", tags=["vehicle"])


@router.post("/command")
async def command(payload: CommandIn, current_user: User = Depends(get_current_user)):
    action = payload.action
    if pipeline.risk_level == "CRITICAL" and action == "FORWARD":
        action = "STOP"  # collision interlock
    await sio.emit("command", {"action": action}, room=VEHICLE_ROOM)
    return {"dispatched": action, "operator": current_user.username}


@router.post("/estop")
async def estop(current_user: User = Depends(get_current_user)):
    await sio.emit("command", {"action": "STOP"}, room=VEHICLE_ROOM)
    return {"dispatched": "STOP", "operator": current_user.username}
