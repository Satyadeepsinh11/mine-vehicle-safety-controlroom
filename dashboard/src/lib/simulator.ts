import { riskFor, type CycleState, type DriveCommand, type Telemetry } from "./collision";
import { PRESENCE_TRACKS, ROUTES, pointOnPath, type TruckSpec } from "./fleet";

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;
const r1 = (v: number) => Number(v.toFixed(1));

/**
 * One truck's data model. Motion follows its haul road (load → haul → dump →
 * return), speeds and payload come from the truck's published specs, the
 * forward obstacle sensor and radar/thermal readings follow the formats of the
 * real parts (HC-SR04, HLK-LD2410, AMG8833).
 */
export class TelemetrySimulator {
  private distance = 220;
  private velocity = 0;
  private brakeHold = 0;
  private manual: DriveCommand = "STOP";
  private autoMode = true;
  private start = Date.now() - Math.random() * 3600_000 * 6;
  private battery = 90 + Math.random() * 8;
  private fuel: number;
  private engine: number;
  private progress = 0;
  private state: CycleState = "LOADING";
  private stateTicks = 0;
  private payload = 0;
  private speedKmh = 0;
  private track: Array<[number, number, boolean]> | null = null;
  private trackStep = 0;
  private hotspot = 0;
  private path;
  private dock: number;

  constructor(private spec: TruckSpec) {
    this.fuel = spec.profile.fuelStart;
    this.engine = spec.profile.engineBase - 10;
    this.path = ROUTES[spec.route % ROUTES.length]!.path;
    // trucks sharing a road use a different loading bay so they never overlap
    this.dock = ["HT-04", "HT-05"].includes(spec.id) ? 45 : 0;
    this.progress = this.dock;
    const len = pointOnPath(this.path, 0).length;
    // stagger trucks so they aren't all in the same place
    const phase = Math.random();
    if (phase < 0.2) this.state = "LOADING";
    else if (phase < 0.6) { this.state = "HAULING"; this.progress = this.dock + (len - this.dock) * Math.random(); this.payload = spec.payload_t; }
    else { this.state = "RETURNING"; this.progress = this.dock + (len - this.dock) * Math.random(); }
    this.stateTicks = Math.floor(Math.random() * 10);
  }

  setMode(auto: boolean) { this.autoMode = auto; }
  setCommand(cmd: DriveCommand) {
    this.manual = cmd;
    if (cmd === "STOP") this.brakeHold = Math.max(this.brakeHold, 6);
  }

  private obstacle() {
    const p = this.spec.profile;
    if (this.autoMode) {
      if (this.brakeHold > 0) { this.brakeHold -= 1; this.velocity = 0; }
      else if (this.distance <= 22) { this.velocity = 0; this.brakeHold = 14; }
      else if (this.velocity === 0 && this.distance < 180) this.velocity = 7 + Math.random() * 5;
      else if (this.distance >= 180) {
        this.velocity = Math.random() < 0.025 * p.obstacleRate && this.speedKmh > 5 ? -(5 + Math.random() * 6) : 0;
      }
    } else {
      const speeds: Record<DriveCommand, number> = { FORWARD: -7, BACKWARD: 7, LEFT: -2, RIGHT: -2, STOP: 0 };
      this.velocity = this.brakeHold > 0 ? 0 : speeds[this.manual];
      if (this.brakeHold > 0) this.brakeHold -= 1;
      if (this.distance <= 20 && this.velocity < 0) { this.velocity = 0; this.brakeHold = 10; this.manual = "STOP"; }
    }
    this.distance = Math.min(260, Math.max(8, this.distance + this.velocity + gauss() * 1.2));
    if (this.distance >= 250) this.distance = 230 + Math.random() * 25;
  }

  private drive(blocked: boolean) {
    const len = pointOnPath(this.path, 0).length;
    const s = this.spec;
    const loaded = this.payload / s.payload_t;
    let target = 0;
    if (!this.autoMode) {
      target = this.manual === "FORWARD" || this.manual === "BACKWARD" ? 18 : 0;
    } else if (this.state === "HAULING") target = s.top_speed_kmh * (0.32 + (1 - loaded) * 0.2); // loaded on ramp
    else if (this.state === "RETURNING") target = s.top_speed_kmh * 0.58;
    if (blocked) target = 0;
    // acceleration limited, ~3 km/h per tick up, 6 down
    this.speedKmh += Math.max(-6, Math.min(3, target - this.speedKmh));
    this.speedKmh = Math.max(0, this.speedKmh + (target ? gauss() * 0.6 : 0));
    const step = (this.speedKmh / 3.6) * 0.4 * 3; // metres per tick, 3x time-lapse
    const dir = !this.autoMode ? (this.manual === "BACKWARD" ? -1 : 1) : this.state === "RETURNING" ? -1 : 1;
    if (this.state === "HAULING" || this.state === "RETURNING" || !this.autoMode) this.progress += step * dir;
    this.progress = Math.max(this.dock, Math.min(len, this.progress));

    if (!this.autoMode) return;
    this.stateTicks += 1;
    if (this.state === "LOADING") {
      this.payload = Math.min(s.payload_t, this.payload + s.payload_t / 22);
      if (this.stateTicks > 24) { this.state = "HAULING"; this.stateTicks = 0; this.payload = s.payload_t * (0.96 + Math.random() * 0.06); }
    } else if (this.state === "HAULING" && this.progress >= len) { this.state = "DUMPING"; this.stateTicks = 0; }
    else if (this.state === "DUMPING") {
      this.payload = Math.max(0, this.payload - s.payload_t / 10);
      if (this.stateTicks > 12) { this.state = "RETURNING"; this.stateTicks = 0; this.payload = 0; }
    } else if (this.state === "RETURNING" && this.progress <= this.dock) { this.state = "LOADING"; this.stateTicks = 0; }
  }

  tick(): Telemetry {
    const s = this.spec;
    const p = s.profile;
    this.obstacle();
    const risk = riskFor(this.distance);
    const blocked = risk === "CRITICAL" || this.brakeHold > 0;
    this.drive(blocked);

    const pos = pointOnPath(this.path, this.progress);
    const heading = (((this.state === "RETURNING" ? pos.heading + 180 : pos.heading) % 360) + 360) % 360;
    const moving = this.speedKmh > 0.5;
    const loadFrac = this.payload / s.payload_t;

    // Fuel: ~ 90 L/h idle, up to ~ 330 L/h hauling loaded (time-lapse x60 so it visibly moves)
    const lph = 90 + (moving ? 120 + loadFrac * 120 : 0) * (s.engine_kw / 2900);
    this.fuel = Math.max(2, this.fuel - (lph / 3600) * 0.4 * 60 / s.fuel_tank_l * 100);
    this.battery = Math.max(5, this.battery - 0.004);
    this.engine += (p.engineBase + loadFrac * 6 * (moving ? 1 : 0.3) - this.engine) * 0.05 + gauss() * 0.3;

    const ambient = 31 + p.ambientOffset + Math.sin(Date.now() / 900_000) * 3;

    // Presence (LD2410 style)
    if (!this.track && Math.random() < p.presenceRate) {
      this.track = PRESENCE_TRACKS[Math.floor(Math.random() * PRESENCE_TRACKS.length)]!;
      this.trackStep = 0;
    }
    let pres: [number, number, boolean] | null = null;
    if (this.track) {
      pres = this.track[this.trackStep] ?? null;
      this.trackStep += 1;
      if (this.trackStep >= this.track.length) this.track = null;
    }
    const gates = Array.from({ length: 9 }, (_, g) => Math.round(Math.max(0, (g === 0 ? 14 : 4) + gauss() * 3)));
    if (pres) {
      const gi = Math.min(8, Math.floor(pres[0] / 75));
      const peak = pres[2] ? 70 + Math.random() * 25 : 38 + Math.random() * 12;
      gates[gi] = Math.round(peak);
      if (gi > 0) gates[gi - 1] = Math.max(gates[gi - 1]!, Math.round(peak * 0.35));
      if (gi < 8) gates[gi + 1] = Math.max(gates[gi + 1]!, Math.round(peak * 0.3));
    }

    // AMG8833 8x8 frame of the scene ahead
    if (this.hotspot > 0) this.hotspot -= 1;
    else if (Math.random() < 0.003) this.hotspot = 20;
    const obsNear = this.distance < 200 ? (200 - this.distance) / 200 : 0;
    const grid = Array.from({ length: 64 }, (_, i) => {
      const gx = i % 8, gy = Math.floor(i / 8);
      let v = gy < 2 ? ambient - 4 + gy * 1.5 : gy < 5 ? ambient + 2 + (gy - 2) * 1.6 : ambient + 8 + (gy - 5) * 1.2;
      if (obsNear > 0) {
        const rad = 0.8 + obsNear * 3.2;
        const d = Math.hypot(gx - 3.5, gy - 4);
        if (d < rad) v = Math.max(v, 42 + obsNear * 20 - d * 3 + (this.hotspot > 0 ? 25 : 0));
      }
      if (pres) {
        const col = ((pres[1] + 60) / 120) * 7;
        const row = pres[0] > 400 ? 3 : pres[0] > 200 ? 4 : 5;
        const d = Math.hypot(gx - col, (gy - row) * 0.6);
        if (d < (pres[0] < 250 ? 1.4 : 0.9)) v = Math.max(v, 31.5 + Math.random() * 2.5 - d);
      }
      return Math.min(80, Math.max(0, r1(v + gauss() * 0.35)));
    });
    const peak = Math.max(...grid);

    return {
      distance_cm: r1(this.distance),
      risk_level: risk,
      speed_pct: Math.round((this.speedKmh / s.top_speed_kmh) * 100),
      emergency_brake: blocked,
      timestamp: Date.now(),
      latency_ms: 16 + Math.round(Math.random() * 24),
      thermal_c: peak,
      thermal_grid: grid,
      ambient_c: r1(ambient),
      humidity_pct: Math.round(22 + Math.random() * 5),
      mmwave_presence: !!pres,
      mmwave_distance_cm: pres ? Math.round(pres[0]) : 0,
      mmwave_motion: pres ? (pres[2] ? "MOVING" : "STATIC") : "NONE",
      mmwave_angle_deg: pres ? Math.round(pres[1]) : 0,
      mmwave_gates: gates,
      battery_pct: Math.round(this.battery),
      battery_v: Number((11.6 + (this.battery / 100) * 1.2).toFixed(2)),
      current_a: Number((0.42 + (pres ? 0.05 : 0) + Math.random() * 0.06).toFixed(2)),
      uptime_s: Math.round((Date.now() - this.start) / 1000),
      ram_pct: Math.round(48 + Math.random() * 8 + (pres ? 6 : 0)),
      cpu_pct: Math.round(28 + (moving ? 14 : 0) + Math.random() * 10),
      cpu_temp_c: r1(ambient + 17 + Math.random() * 3 + (moving ? 3 : 0)),
      motor_temp_c: r1(this.engine),
      rssi_dbm: Math.round(-52 - (pos.y > 300 ? 14 : 4) - Math.random() * 8), // deeper in pit = weaker
      tilt_deg: r1((this.state === "HAULING" || this.state === "RETURNING" ? 4.5 : 0.5) * (pos.heading > 0 ? 1 : -1) + gauss() * 0.3),
      heading_deg: Math.round(heading),
      pos_x: r1(pos.x),
      pos_y: r1(pos.y),
      speed_kmh: r1(this.speedKmh),
      payload_t: Math.round(this.payload),
      fuel_pct: r1(this.fuel),
      engine_temp_c: r1(this.engine),
      tyre_temp_c: r1(ambient + 18 + this.speedKmh * 0.35 + loadFrac * 12),
      cycle_state: blocked ? "STOPPED" : this.autoMode ? this.state : moving ? "HAULING" : "STOPPED",
    };
  }
}
