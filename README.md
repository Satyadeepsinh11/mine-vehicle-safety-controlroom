# Open-Cast Mine Collision Avoidance Control System

Three parts: an ESP32-CAM vehicle node, a Python (FastAPI + OpenCV) control
server, and a web admin dashboard.

```
backend/    FastAPI + Socket.IO + OpenCV HUD pipeline + SQLAlchemy models
database/   init_db.py seeder (admin / admin123) and schema.sql reference
firmware/   ESP32-CAM Arduino sketch (HC-SR04 + L298N + Socket.IO + MJPEG)
```

The dashboard is hosted separately (built with React + Tailwind); point it at
this server from its **Data Source** panel.

## Safety thresholds

| Range | State | Action |
|---|---|---|
| `<= 20 cm` | CRITICAL | automatic `STOP` sent to the vehicle, red flashing HUD banner, incident logged |
| `20–45 cm` | WARNING | amber banner |
| `> 45 cm` | CLEAR | normal operation |

## 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # set SECRET_KEY and CORS_ORIGINS
python ../database/init_db.py # creates tables + admin / admin123
uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload
```

- API docs: http://localhost:8000/docs
- HUD MJPEG stream: http://localhost:8000/api/video_feed
- Health check: http://localhost:8000/api/health

Set `CAMERA_SOURCE=0` for a local webcam, or `ESP32_STREAM_URL=http://<esp-ip>:81/stream`
to process the vehicle camera.

### Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | – | OAuth2 password form, returns a 24 h JWT |
| GET | `/api/auth/me` | JWT | current operator |
| POST | `/api/telemetry` | – | HTTP telemetry ingest fallback |
| GET | `/api/telemetry/latest` | JWT | latest reading |
| GET | `/api/telemetry/history` | JWT | historical readings |
| GET | `/api/logs/incidents` | JWT | filterable incident list |
| DELETE | `/api/logs/incidents` | JWT | clear incidents |
| POST | `/api/vehicle/command` | JWT | manual drive command |
| POST | `/api/vehicle/estop` | JWT | emergency stop |

Socket.IO events: vehicles emit `telemetry`, dashboards receive `telemetry`
and emit `command` / `mode`. Vehicles connect with `auth: {role: "vehicle"}`;
dashboards pass `auth: {token: "<JWT>"}`.

### CORS

Add the dashboard origin to `CORS_ORIGINS` in `.env`, comma separated, then
restart uvicorn. Without it the browser blocks the connection.

## 2. Firmware

1. Arduino IDE → Boards Manager → **esp32** by Espressif.
2. Library Manager → **WebSockets** (Markus Sattler) and **ArduinoJson**.
3. Board: *AI Thinker ESP32-CAM*, Partition scheme: *Huge APP*.
4. Edit `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_HOST`, `SERVER_PORT` at the top
   of `esp32_car_node.ino`, then upload with GPIO0 tied to GND.

Wiring:

| Signal | GPIO |
|---|---|
| HC-SR04 TRIG | 13 |
| HC-SR04 ECHO | 12 (use a 1k/2k divider — ECHO is 5 V) |
| L298N IN1 / IN2 (left) | 14 / 15 |
| L298N IN3 / IN4 (right) | 2 / 4 |

Power the motors from a separate battery pack and tie the grounds together.
GPIO4 also drives the flash LED and GPIO2/14/15 are shared with the SD slot,
so leave the SD card out.

The sketch keeps its own local interlock: it stops the motors at 20 cm even if
the backend link drops.

## 3. Dashboard

Log in with **admin / admin123**. In the *Data Source* panel choose:

- **Simulator** — realistic telemetry with no hardware attached
- **Live backend** — enter `http://<server-ip>:8000` and press Connect

## Dashboard: camera, sensors and hardware control

* **Camera page** – per vehicle choose ESP32-CAM (`http://<ip>:81/stream`), any IP/MJPEG camera, a USB webcam, or the server CV stream. Browsers block plain-http camera streams on an https page, so run the dashboard on your LAN (`bun run dev`) when using ESP32/IP cameras.
* **Telemetry JSON** the dashboard understands (all optional except `distance_cm`):
  `distance_cm, speed_pct, thermal_c, thermal_grid[64], ambient_c, humidity_pct, mmwave_presence, mmwave_distance_cm, mmwave_motion, battery_pct, battery_v, current_a, uptime_s, ram_pct, cpu_pct, cpu_temp_c, motor_temp_c, rssi_dbm, tilt_deg, heading_deg, pos_x, pos_y`.
* **Hardware control** is sent as Socket.IO event `hw` `{key, value}` (speed_limit, headlights, flash_led, horn, buzzer_armed, pan, tilt, cam_resolution, cam_quality, *_enabled, calibrate, reboot). The server relays it to the vehicle.

## Dashboard (web app)
`dashboard/` holds the full web dashboard: 5 haul trucks, mine footage camera, thermal + mmWave sensors, control, mine map, analytics.
Run: `cd dashboard && npm install && npm run dev`, then open http://localhost:8080 (login admin / admin123).
Set the backend address in System → Data Source to switch from simulator to your Python server.
