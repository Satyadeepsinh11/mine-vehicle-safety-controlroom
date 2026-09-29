"""OpenCV HUD processing engine.

Draws telemetry-aware overlays (range rings, obstacle bounding box, risk
banner) on each frame and yields an MJPEG byte stream for the dashboard.
"""
from __future__ import annotations

import time

import cv2
import numpy as np

from ..config import settings

COLORS = {
    "CLEAR": (129, 211, 52),      # BGR emerald
    "WARNING": (36, 191, 251),    # BGR amber
    "CRITICAL": (68, 68, 239),    # BGR crimson
}


def classify(distance_cm: float) -> str:
    if distance_cm <= settings.CRITICAL_CM:
        return "CRITICAL"
    if distance_cm <= settings.WARNING_CM:
        return "WARNING"
    return "CLEAR"


class HUDPipeline:
    """Holds the latest telemetry and renders it onto camera frames."""

    def __init__(self) -> None:
        self.distance_cm: float = 999.0
        self.risk_level: str = "CLEAR"
        self.speed_pct: int = 0
        self.brake: bool = False
        self._capture: cv2.VideoCapture | None = None

    # ---------------- telemetry ----------------
    def update(self, distance_cm: float, speed_pct: int = 0) -> str:
        self.distance_cm = float(distance_cm)
        self.risk_level = classify(self.distance_cm)
        self.speed_pct = speed_pct
        self.brake = self.risk_level == "CRITICAL"
        return self.risk_level

    # ---------------- camera ----------------
    def _open(self) -> cv2.VideoCapture:
        source: int | str
        if settings.ESP32_STREAM_URL:
            source = settings.ESP32_STREAM_URL
        else:
            source = int(settings.CAMERA_SOURCE) if settings.CAMERA_SOURCE.isdigit() else settings.CAMERA_SOURCE
        cap = cv2.VideoCapture(source)
        return cap

    def _placeholder(self) -> np.ndarray:
        frame = np.zeros((480, 854, 3), dtype=np.uint8)
        frame[:] = (32, 18, 11)
        cv2.putText(frame, "NO CAMERA SIGNAL", (250, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (180, 180, 180), 2)
        return frame

    # ---------------- rendering ----------------
    def render(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape[:2]
        color = COLORS[self.risk_level]
        cx, cy = w // 2, h - 10

        # range rings (warning + critical)
        for radius, ring_color in (
            (int(settings.WARNING_CM * 4), COLORS["WARNING"]),
            (int(settings.CRITICAL_CM * 4), COLORS["CRITICAL"]),
        ):
            cv2.ellipse(frame, (cx, cy), (radius, radius // 2), 0, 180, 360, ring_color, 1)

        # obstacle bounding box scaled by proximity
        norm = max(0.0, min(1.0, (260.0 - self.distance_cm) / 260.0))
        box_w = int(70 + norm * 260)
        box_h = int(50 + norm * 180)
        x1 = cx - box_w // 2
        y1 = int(h * 0.55 - box_h * norm)
        cv2.rectangle(frame, (x1, y1), (x1 + box_w, y1 + box_h), color, 2)
        cv2.putText(frame, f"OBSTACLE {self.distance_cm:.1f} cm", (x1, max(18, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)

        # top risk banner (flashes on CRITICAL)
        flash = self.risk_level == "CRITICAL" and int(time.time() * 3) % 2 == 0
        banner = frame[0:34, 0:w].copy()
        overlay = np.full_like(banner, color)
        alpha = 1.0 if flash else 0.25
        frame[0:34, 0:w] = cv2.addWeighted(overlay, alpha, banner, 1 - alpha, 0)
        label = {
            "CLEAR": "CLEAR",
            "WARNING": "WARNING - OBSTACLE CLOSE",
            "CRITICAL": "CRITICAL - EMERGENCY BRAKE",
        }[self.risk_level]
        text_color = (20, 20, 20) if flash else color
        cv2.putText(frame, label, (14, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 2, cv2.LINE_AA)
        cv2.putText(frame, f"SPD {self.speed_pct}%", (w - 120, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (230, 230, 230), 1, cv2.LINE_AA)

        if self.brake:
            cv2.rectangle(frame, (2, 2), (w - 3, h - 3), COLORS["CRITICAL"], 4)
        return frame

    # ---------------- MJPEG generator ----------------
    def frames(self):
        if self._capture is None or not self._capture.isOpened():
            self._capture = self._open()
        while True:
            ok, frame = (self._capture.read() if self._capture and self._capture.isOpened()
                         else (False, None))
            if not ok or frame is None:
                frame = self._placeholder()
                time.sleep(0.1)
            frame = self.render(frame)
            ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            if not ok:
                continue
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")


pipeline = HUDPipeline()
