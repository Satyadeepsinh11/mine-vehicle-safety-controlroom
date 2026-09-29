"""FastAPI application entry point."""
import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import settings
from .database import init_db
from .routes import auth as auth_routes
from .routes import logs as logs_routes
from .routes import telemetry as telemetry_routes
from .routes import vehicle as vehicle_routes
from .sockets.socket_manager import sio
from .vision.cv_pipeline import pipeline

app = FastAPI(title="Open-Cast Mine Collision Avoidance API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(telemetry_routes.router)
app.include_router(vehicle_routes.router)
app.include_router(logs_routes.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    print("[startup] database ready")


@app.get("/api/health")
def health():
    return {"status": "ok", "risk_level": pipeline.risk_level}


@app.get("/api/video_feed")
def video_feed():
    """MJPEG stream with OpenCV HUD overlays."""
    return StreamingResponse(
        pipeline.frames(), media_type="multipart/x-mixed-replace; boundary=frame"
    )


# Socket.IO is mounted around the FastAPI app; run this object with uvicorn.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

if __name__ == "__main__":
    uvicorn.run("app.main:socket_app", host="0.0.0.0", port=8000, reload=True)
