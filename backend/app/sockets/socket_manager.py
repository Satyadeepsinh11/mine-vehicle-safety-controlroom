"""Socket.IO server: hardware telemetry ingest, broadcast and auto-braking."""
from __future__ import annotations

import socketio
from jose import JWTError

from ..auth import decode_token
from ..config import settings
from ..database import SessionLocal
from ..models import IncidentLog, TelemetryLog
from ..vision.cv_pipeline import pipeline

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

VEHICLE_ROOM = "vehicles"
DASHBOARD_ROOM = "dashboards"

_last_risk = {"value": "CLEAR"}


def _persist(distance: float, risk: str, brake: bool, event: str | None, action: str | None) -> None:
    db = SessionLocal()
    try:
        db.add(TelemetryLog(distance_cm=distance, risk_level=risk, emergency_brake_triggered=brake))
        if event and action:
            db.add(IncidentLog(event_type=event, distance_at_brake=distance, action_taken=action))
        db.commit()
    finally:
        db.close()


@sio.event
async def connect(sid, environ, auth):
    """Vehicles join without a token; dashboards must present a valid JWT."""
    role = (auth or {}).get("role", "dashboard")
    if role == "vehicle":
        await sio.enter_room(sid, VEHICLE_ROOM)
        print(f"[socket] vehicle node connected: {sid}")
        return
    token = (auth or {}).get("token")
    if token:
        try:
            decode_token(token)
        except JWTError:
            raise ConnectionRefusedError("invalid token")
    await sio.enter_room(sid, DASHBOARD_ROOM)
    print(f"[socket] dashboard connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[socket] disconnected: {sid}")


@sio.on("telemetry")
async def telemetry(sid, data):
    """Incoming {"distance_cm": float} packets from the ESP32 node."""
    try:
        distance = float(data.get("distance_cm"))
    except (TypeError, ValueError):
        return
    speed = int(data.get("speed_pct", 0))
    risk = pipeline.update(distance, speed)
    brake = risk == "CRITICAL"

    event = action = None
    if risk != _last_risk["value"]:
        if risk == "CRITICAL":
            event, action = "EMERGENCY_BRAKE", "AUTO STOP COMMAND SENT"
        elif risk == "WARNING":
            event, action = "OBSTACLE_CLOSE", "OPERATOR WARNED"
        else:
            event, action = "PATH_CLEAR", "DRIVE RE-ENABLED"
        _last_risk["value"] = risk

    _persist(distance, risk, brake, event, action)

    if brake:
        # Automated interlock: stop the vehicle immediately.
        await sio.emit("command", {"action": "STOP"}, room=VEHICLE_ROOM)

    await sio.emit(
        "telemetry",
        {
            **{k: v for k, v in data.items() if k not in ("distance_cm", "speed_pct")},  # thermal, mmwave, battery, uptime, ram ...
            "distance_cm": distance,
            "risk_level": risk,
            "speed_pct": speed,
            "emergency_brake": brake,
            "critical_cm": settings.CRITICAL_CM,
            "warning_cm": settings.WARNING_CM,
        },
        room=DASHBOARD_ROOM,
    )


@sio.on("command")
async def command(sid, data):
    """Manual drive command from an authenticated dashboard."""
    action = str((data or {}).get("action", "STOP")).upper()
    if action not in {"FORWARD", "BACKWARD", "LEFT", "RIGHT", "STOP"}:
        return
    if pipeline.risk_level == "CRITICAL" and action == "FORWARD":
        action = "STOP"  # interlock
    await sio.emit("command", {"action": action}, room=VEHICLE_ROOM)
    await sio.emit("command_ack", {"action": action}, room=DASHBOARD_ROOM)


@sio.on("mode")
async def mode(sid, data):
    await sio.emit("mode", {"auto": bool((data or {}).get("auto", True))}, room=VEHICLE_ROOM)


@sio.on("hw")
async def hardware(sid, data):
    """Hardware control from dashboard: lights, horn, speed_limit, pan/tilt, camera, sensors, reboot."""
    if not isinstance(data, dict) or "key" not in data:
        return
    await sio.emit("hw", {"key": str(data["key"]), "value": data.get("value")}, room=VEHICLE_ROOM)
    await sio.emit("hw_ack", data, room=DASHBOARD_ROOM)
