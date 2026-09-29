import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import {
  EVENT_SEVERITY,
  THRESHOLDS,
  riskFor,
  type DriveCommand,
  type IncidentLog,
  type Telemetry,
  type Vehicle,
} from "@/lib/collision";
import { TelemetrySimulator } from "@/lib/simulator";
import { TRUCKS, truckFor } from "@/lib/fleet";

export type Source = "simulator" | "live";
export type ConnState = "connected" | "connecting" | "disconnected";

export interface HardwareState {
  speed_limit: number;
  headlights: boolean;
  flash_led: boolean;
  horn: boolean;
  buzzer_armed: boolean;
  pan: number;
  tilt: number;
  cam_resolution: string;
  cam_quality: number;
  ultrasonic_enabled: boolean;
  mmwave_enabled: boolean;
  thermal_enabled: boolean;
}

export interface CommandEntry {
  id: string;
  ts: number;
  action: string;
  value: string;
  vehicle: string;
}

interface TelemetryValue {
  telemetry: Telemetry;
  incidents: IncidentLog[];
  history: Telemetry[];
  source: Source;
  connection: ConnState;
  autoMode: boolean;
  lastCommand: DriveCommand;
  backendUrl: string;
  vehicles: Vehicle[];
  activeVehicle: Vehicle;
  fleetTel: Record<string, Telemetry>;
  fleetHistory: Record<string, Telemetry[]>;
  hardware: HardwareState;
  commandLog: CommandEntry[];
  setBackendUrl: (v: string) => void;
  setSource: (s: Source) => void;
  setAutoMode: (v: boolean) => void;
  sendCommand: (cmd: DriveCommand) => void;
  sendHardware: <K extends keyof HardwareState>(key: K, value: HardwareState[K]) => void;
  sendAction: (action: string, value?: string) => void;
  clearIncidents: () => void;
  acknowledgeIncident: (id: string, ack?: boolean) => void;
  annotateIncident: (id: string, note: string) => void;
  deleteIncident: (id: string) => void;
  reportIncident: (type: string, note: string, severity?: IncidentLog["severity"]) => void;
  selectVehicle: (id: string) => void;
  saveVehicle: (v: Vehicle) => void;
  removeVehicle: (id: string) => void;
}

const truckVehicle = (t: (typeof TRUCKS)[number]): Vehicle => ({
  id: t.id,
  name: t.name,
  kind: "Haul truck",
  model: `${t.maker} ${t.model}`,
  ip: `192.168.1.${60 + TRUCKS.indexOf(t)}`,
  camera: { kind: "esp32", url: `http://192.168.1.${60 + TRUCKS.indexOf(t)}:81/stream`, deviceId: "", resolution: "VGA", quality: 12, flip: false, mirror: false },
  sensors: { ultrasonic: true, thermal: true, mmwave: true, imu: true, battery: true },
});
const defaultVehicles: Vehicle[] = TRUCKS.map(truckVehicle);
const defaultVehicle: Vehicle = defaultVehicles[0]!;

const defaultHw: HardwareState = {
  speed_limit: 65,
  headlights: false,
  flash_led: false,
  horn: false,
  buzzer_armed: true,
  pan: 90,
  tilt: 90,
  cam_resolution: "VGA",
  cam_quality: 12,
  ultrasonic_enabled: true,
  mmwave_enabled: true,
  thermal_enabled: true,
};

const initial: Telemetry = {
  distance_cm: 140,
  risk_level: "CLEAR",
  speed_pct: 0,
  emergency_brake: false,
  timestamp: 0,
  latency_ms: 0,
  thermal_c: 0,
  thermal_grid: Array(64).fill(0),
  ambient_c: 0,
  humidity_pct: 0,
  mmwave_presence: false,
  mmwave_distance_cm: 0,
  mmwave_motion: "NONE",
  battery_pct: 0,
  battery_v: 0,
  current_a: 0,
  uptime_s: 0,
  ram_pct: 0,
  cpu_pct: 0,
  cpu_temp_c: 0,
  motor_temp_c: 0,
  rssi_dbm: 0,
  tilt_deg: 0,
  heading_deg: 0,
  pos_x: 400,
  pos_y: 300,
  speed_kmh: 0,
  payload_t: 0,
  fuel_pct: 0,
  engine_temp_c: 0,
  tyre_temp_c: 0,
  cycle_state: "STOPPED",
  mmwave_angle_deg: 0,
  mmwave_gates: Array(9).fill(0),
};

const VKEY = "ocms.vehicles.v3";
const AKEY = "ocms.activeVehicle.v2";
const IKEY = "ocms.incidents.v2";

// Keep one context instance across hot reloads so Provider and consumers never mismatch.
const g = globalThis as { __ocmsTelemetryCtx?: React.Context<TelemetryValue | null> };
const TelemetryContext = (g.__ocmsTelemetryCtx ??= createContext<TelemetryValue | null>(null));

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const num = (v: unknown, d: number) => (typeof v === "number" && !Number.isNaN(v) ? v : d);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [fleetTel, setFleetTel] = useState<Record<string, Telemetry>>({});
  const [fleetHistory, setFleetHistory] = useState<Record<string, Telemetry[]>>({});
  const [liveTel, setLiveTel] = useState<Telemetry | null>(null);
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [source, setSource] = useState<Source>("simulator");
  const [connection, setConnection] = useState<ConnState>("connecting");
  const [autoMode, setAutoModeState] = useState(true);
  const [lastCommand, setLastCommand] = useState<DriveCommand>("STOP");
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [vehicles, setVehicles] = useState<Vehicle[]>(defaultVehicles);
  const [activeId, setActiveId] = useState(defaultVehicle.id);
  const [hardware, setHardware] = useState<HardwareState>(defaultHw);
  const [commandLog, setCommandLog] = useState<CommandEntry[]>([]);

  const simsRef = useRef<Map<string, TelemetrySimulator>>(new Map());
  const autoRef = useRef(true);
  const socketRef = useRef<Socket | null>(null);
  const prevRisk = useRef<Record<string, string>>({});
  const flagsRef = useRef<Record<string, { thermal: boolean; battery: boolean; presence: boolean; fuel: boolean }>>({});
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  // Persistence
  useEffect(() => {
    try {
      const v = localStorage.getItem(VKEY);
      if (v) {
        const parsed = JSON.parse(v) as Vehicle[];
        if (parsed.length) setVehicles(parsed);
      }
      const a = localStorage.getItem(AKEY);
      if (a) setActiveId(a);
      const i = localStorage.getItem(IKEY);
      if (i) setIncidents(JSON.parse(i) as IncidentLog[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);
  useEffect(() => localStorage.setItem(VKEY, JSON.stringify(vehicles)), [vehicles]);
  useEffect(() => localStorage.setItem(AKEY, activeId), [activeId]);
  useEffect(() => localStorage.setItem(IKEY, JSON.stringify(incidents.slice(0, 500))), [incidents]);

  const logIncident = useCallback(
    (distance: number, type: string, action: string, note = "", severity?: IncidentLog["severity"], vehicle?: string) => {
      setIncidents((prev) =>
        [
          {
            id: uid(),
            timestamp: Date.now(),
            event_type: type,
            distance_at_brake: distance,
            action_taken: action,
            vehicle_id: vehicle ?? activeRef.current,
            severity: severity ?? EVENT_SEVERITY[type] ?? "MEDIUM",
            acknowledged: false,
            note,
          },
          ...prev,
        ].slice(0, 500),
      );
    },
    [],
  );

  const evaluate = useCallback(
    (id: string, t: Telemetry) => {
      const prev = prevRisk.current[id] ?? "CLEAR";
      if (t.risk_level !== prev) {
        if (t.risk_level === "CRITICAL") logIncident(t.distance_cm, "EMERGENCY_BRAKE", "AUTO STOP COMMAND SENT", "", undefined, id);
        else if (t.risk_level === "WARNING" && prev === "CLEAR") logIncident(t.distance_cm, "OBSTACLE_CLOSE", "OPERATOR WARNED", "", undefined, id);
        else if (t.risk_level === "CLEAR" && prev !== "CLEAR") logIncident(t.distance_cm, "PATH_CLEAR", "DRIVE RE-ENABLED", "", undefined, id);
        prevRisk.current[id] = t.risk_level;
      }
      const f = (flagsRef.current[id] ??= { thermal: false, battery: false, presence: false, fuel: false });
      const hot = t.thermal_c >= THRESHOLDS.thermal_c;
      if (hot && !f.thermal) logIncident(t.distance_cm, "THERMAL_HIGH", `HOT SPOT ${t.thermal_c}°C`, "", undefined, id);
      f.thermal = hot;
      const low = t.battery_pct > 0 && t.battery_pct <= THRESHOLDS.battery_pct;
      if (low && !f.battery) logIncident(t.distance_cm, "BATTERY_LOW", `NODE BATTERY ${t.battery_pct}%`, "", undefined, id);
      f.battery = low;
      const fuelLow = t.fuel_pct > 0 && t.fuel_pct <= 15;
      if (fuelLow && !f.fuel) logIncident(t.distance_cm, "BATTERY_LOW", `FUEL ${t.fuel_pct}%`, "Fuel low", undefined, id);
      f.fuel = fuelLow;
      if (t.mmwave_presence && !f.presence)
        logIncident(t.distance_cm, "PRESENCE_DETECTED", `PERSON @ ${t.mmwave_distance_cm} cm`, "", undefined, id);
      f.presence = t.mmwave_presence;
    },
    [logIncident],
  );

  // Simulate every truck in the fleet at once
  useEffect(() => {
    setConnection(source === "simulator" ? "connected" : "connecting");
    const id = setInterval(() => {
      const sims = simsRef.current;
      const list = vehiclesRef.current;
      const out: Record<string, Telemetry> = {};
      for (const v of list) {
        let sim = sims.get(v.id);
        if (!sim) {
          sim = new TelemetrySimulator(truckFor(v.id));
          sim.setMode(autoRef.current);
          sims.set(v.id, sim);
        }
        // in live mode the active truck comes from the real board instead
        if (source === "live" && v.id === activeRef.current) continue;
        const t = sim.tick();
        out[v.id] = t;
        evaluate(v.id, t);
      }
      setFleetTel((prev) => ({ ...prev, ...out }));
      setFleetHistory((prev) => {
        const next = { ...prev };
        for (const [k, t] of Object.entries(out)) next[k] = [...(prev[k] ?? []), t].slice(-300);
        return next;
      });
    }, 400);
    return () => clearInterval(id);
  }, [source, evaluate]);

  // Live Socket.IO backend
  useEffect(() => {
    if (source !== "live") return;
    let cancelled = false;
    setConnection("connecting");
    (async () => {
      const { io } = await import("socket.io-client");
      if (cancelled) return;
      const socket = io(backendUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1500,
      });
      socketRef.current = socket;
      socket.on("connect", () => setConnection("connected"));
      socket.on("disconnect", () => {
        setConnection("disconnected");
        logIncident(0, "LINK_LOST", "DASHBOARD LINK DROPPED");
      });
      socket.on("connect_error", () => setConnection("disconnected"));
      socket.on("telemetry", (raw: Partial<Telemetry> & { sent_ms?: number }) => {
        const distance = Number(raw.distance_cm);
        const risk = riskFor(distance);
        const id = activeRef.current;
        const t: Telemetry = {
          ...initial,
          ...raw,
          distance_cm: distance,
          risk_level: risk,
          speed_pct: num(raw.speed_pct, 0),
          emergency_brake: risk === "CRITICAL",
          thermal_grid: Array.isArray(raw.thermal_grid) && raw.thermal_grid.length === 64 ? raw.thermal_grid : initial.thermal_grid,
          timestamp: Date.now(),
          latency_ms: raw.sent_ms ? Math.max(0, Date.now() - raw.sent_ms) : 0,
        };
        setLiveTel(t);
        setFleetTel((p) => ({ ...p, [id]: t }));
        setFleetHistory((p) => ({ ...p, [id]: [...(p[id] ?? []), t].slice(-300) }));
        evaluate(id, t);
      });
    })();
    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [source, backendUrl, evaluate, logIncident]);

  const pushLog = useCallback((action: string, value: string) => {
    setCommandLog((l) => [{ id: uid(), ts: Date.now(), action, value, vehicle: activeRef.current }, ...l].slice(0, 100));
  }, []);

  const sendCommand = useCallback(
    (cmd: DriveCommand) => {
      setLastCommand(cmd);
      simsRef.current.get(activeRef.current)?.setCommand(cmd);
      socketRef.current?.emit("command", { action: cmd, vehicle: activeRef.current });
      pushLog("DRIVE", cmd);
    },
    [pushLog],
  );

  const sendHardware = useCallback(
    <K extends keyof HardwareState>(key: K, value: HardwareState[K]) => {
      setHardware((h) => ({ ...h, [key]: value }));
      socketRef.current?.emit("hw", { key, value, vehicle: activeRef.current });
      pushLog(String(key).toUpperCase(), String(value));
    },
    [pushLog],
  );

  const sendAction = useCallback(
    (action: string, value = "") => {
      socketRef.current?.emit("hw", { key: action, value, vehicle: activeRef.current });
      pushLog(action.toUpperCase(), value);
    },
    [pushLog],
  );

  const setAutoMode = useCallback(
    (v: boolean) => {
      setAutoModeState(v);
      autoRef.current = v;
      simsRef.current.forEach((sim) => sim.setMode(v));
      socketRef.current?.emit("mode", { auto: v });
      pushLog("MODE", v ? "AUTO" : "MANUAL");
    },
    [pushLog],
  );

  const telemetry = (source === "live" ? liveTel : null) ?? fleetTel[activeId] ?? initial;
  const history = fleetHistory[activeId] ?? [];
  const activeVehicle = vehicles.find((v) => v.id === activeId) ?? vehicles[0] ?? defaultVehicle;

  return (
    <TelemetryContext.Provider
      value={{
        telemetry,
        incidents,
        history,
        source,
        connection,
        autoMode,
        lastCommand,
        backendUrl,
        vehicles,
        activeVehicle,
        fleetTel,
        fleetHistory,
        hardware,
        commandLog,
        setBackendUrl,
        setSource,
        setAutoMode,
        sendCommand,
        sendHardware,
        sendAction,
        clearIncidents: () => setIncidents([]),
        acknowledgeIncident: (id, ack = true) =>
          setIncidents((p) => p.map((i) => (i.id === id ? { ...i, acknowledged: ack } : i))),
        annotateIncident: (id, note) => setIncidents((p) => p.map((i) => (i.id === id ? { ...i, note } : i))),
        deleteIncident: (id) => setIncidents((p) => p.filter((i) => i.id !== id)),
        reportIncident: (type, note, severity) =>
          logIncident(telemetry.distance_cm, type, "MANUAL OPERATOR REPORT", note, severity),
        selectVehicle: (id) => {
          setActiveId(id);
          pushLog("VEHICLE", id);
        },
        saveVehicle: (v) =>
          setVehicles((list) => (list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v])),
        removeVehicle: (id) =>
          setVehicles((list) => {
            const next = list.filter((x) => x.id !== id);
            return next.length ? next : defaultVehicles;
          }),
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error("useTelemetry must be used inside TelemetryProvider");
  return ctx;
}
