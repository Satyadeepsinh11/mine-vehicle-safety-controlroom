export type RiskLevel = "CLEAR" | "WARNING" | "CRITICAL";

export const CRITICAL_CM = 20;
export const WARNING_CM = 45;

export type DriveCommand = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";

export interface SensorData {
  thermal_c: number; // MLX90614 / AMG8833 object temperature
  thermal_grid: number[]; // 8x8 AMG8833 frame (64 values, °C)
  ambient_c: number;
  humidity_pct: number;
  mmwave_presence: boolean;
  mmwave_distance_cm: number;
  mmwave_motion: "NONE" | "STATIC" | "MOVING";
  battery_pct: number;
  battery_v: number;
  current_a: number;
  uptime_s: number;
  ram_pct: number;
  cpu_pct: number;
  cpu_temp_c: number;
  motor_temp_c: number;
  rssi_dbm: number;
  tilt_deg: number;
  heading_deg: number;
  pos_x: number; // metres, site grid
  pos_y: number;
  // Haul truck data
  speed_kmh: number;
  payload_t: number;
  fuel_pct: number;
  engine_temp_c: number;
  tyre_temp_c: number;
  cycle_state: CycleState;
  mmwave_angle_deg: number;
  mmwave_gates: number[]; // 9 gates x 75 cm, energy 0-100 (LD2410 format)
}

export type CycleState = "LOADING" | "HAULING" | "DUMPING" | "RETURNING" | "STOPPED";

export interface Telemetry extends SensorData {
  distance_cm: number;
  risk_level: RiskLevel;
  speed_pct: number;
  emergency_brake: boolean;
  timestamp: number;
  latency_ms: number;
}

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface IncidentLog {
  id: string;
  timestamp: number;
  event_type: string;
  distance_at_brake: number;
  action_taken: string;
  vehicle_id: string;
  severity: Severity;
  acknowledged: boolean;
  note: string;
  operator?: string;
}

export const EVENT_SEVERITY: Record<string, Severity> = {
  EMERGENCY_BRAKE: "CRITICAL",
  OBSTACLE_CLOSE: "MEDIUM",
  PATH_CLEAR: "LOW",
  THERMAL_HIGH: "HIGH",
  BATTERY_LOW: "MEDIUM",
  PRESENCE_DETECTED: "HIGH",
  LINK_LOST: "HIGH",
  MANUAL_REPORT: "MEDIUM",
};

export const THRESHOLDS = {
  thermal_c: 60,
  battery_pct: 20,
  cpu_temp_c: 75,
  ram_pct: 85,
  rssi_dbm: -80,
};

export type CameraKind = "recorded" | "esp32" | "ip_mjpeg" | "usb" | "backend_cv" | "simulated";

export interface CameraConfig {
  kind: CameraKind;
  url: string; // stream URL for esp32 / ip_mjpeg
  deviceId: string; // for usb
  resolution: "QVGA" | "VGA" | "SVGA" | "HD";
  quality: number; // 10 (best) - 63
  flip: boolean;
  mirror: boolean;
}

export interface Vehicle {
  id: string;
  name: string;
  kind: "Haul truck" | "Dozer" | "Loader" | "Rover" | "Car model";
  ip: string;
  camera: CameraConfig;
  sensors: { ultrasonic: boolean; thermal: boolean; mmwave: boolean; imu: boolean; battery: boolean };
  model?: string;
}

export function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? d + "d " : ""}${h}h ${m}m ${Math.floor(s % 60)}s`;
}

export function riskFor(distanceCm: number): RiskLevel {
  if (distanceCm <= CRITICAL_CM) return "CRITICAL";
  if (distanceCm <= WARNING_CM) return "WARNING";
  return "CLEAR";
}

export const riskMeta: Record<
  RiskLevel,
  { label: string; text: string; ring: string; bg: string; dot: string }
> = {
  CLEAR: {
    label: "CLEAR",
    text: "text-status-clear",
    ring: "stroke-status-clear",
    bg: "bg-status-clear/10 border-status-clear/40",
    dot: "bg-status-clear",
  },
  WARNING: {
    label: "WARNING — OBSTACLE CLOSE",
    text: "text-status-warn",
    ring: "stroke-status-warn",
    bg: "bg-status-warn/10 border-status-warn/45",
    dot: "bg-status-warn",
  },
  CRITICAL: {
    label: "CRITICAL — EMERGENCY BRAKE",
    text: "text-status-crit",
    ring: "stroke-status-crit",
    bg: "bg-status-crit/15 border-status-crit/55",
    dot: "bg-status-crit",
  },
};

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

export function incidentsToCsv(rows: IncidentLog[]) {
  const head = "timestamp,vehicle,event_type,severity,distance_cm,action_taken,acknowledged,note";
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const body = rows
    .map(
      (r) =>
        `${new Date(r.timestamp).toISOString()},${r.vehicle_id},${r.event_type},${r.severity},${r.distance_at_brake.toFixed(1)},${esc(r.action_taken)},${r.acknowledged},${esc(r.note)}`,
    )
    .join("\n");
  return `${head}\n${body}\n`;
}
