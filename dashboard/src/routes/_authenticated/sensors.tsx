import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Battery, Clock, Compass, Cpu, Droplets, Flame, Fuel, Gauge, MemoryStick, Package, Radar, Ruler, Thermometer, Wifi, type LucideIcon,
} from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { THRESHOLDS, fmtUptime, riskMeta, type Telemetry } from "@/lib/collision";
import { TruckPicker } from "@/components/TruckPicker";
import { truckFor } from "@/lib/fleet";

export const Route = createFileRoute("/_authenticated/sensors")({
  head: () => ({
    meta: [
      { title: "Sensor Grid & Telemetry — Open-Cast Collision Avoidance" },
      { name: "description", content: "8×8 thermal array, mmWave presence radar, fuel, payload, engine and node health for each of the five haul trucks." },
      { property: "og:title", content: "Sensor Grid & Telemetry — Collision Avoidance" },
      { property: "og:description", content: "Full live sensor readout of every haul truck." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SensorsPage,
});

type Tone = "ok" | "warn" | "crit";
const toneCls: Record<Tone, string> = { ok: "text-foreground", warn: "text-status-warn", crit: "text-status-crit" };

function Tile({ icon: Icon, label, value, sub, tone = "ok", pct, spark }: { icon: LucideIcon; label: string; value: string; sub?: string; tone?: Tone; pct?: number; spark?: number[] }) {
  const max = spark ? Math.max(...spark) : 1;
  const min = spark ? Math.min(...spark) : 0;
  return (
    <div className="panel-glass p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5 text-primary" /> {label}</div>
      <p className={`mt-1 font-display text-xl font-semibold ${toneCls[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {pct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={`h-full ${tone === "crit" ? "bg-status-crit" : tone === "warn" ? "bg-status-warn" : "bg-primary"}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      {spark && spark.length > 1 && (
        <svg viewBox="0 0 100 24" className="mt-2 h-6 w-full" preserveAspectRatio="none">
          <polyline fill="none" stroke="var(--primary)" strokeWidth="1.5" points={spark.map((v, i) => `${(i / (spark.length - 1)) * 100},${22 - ((v - min) / (max - min || 1)) * 20}`).join(" ")} />
        </svg>
      )}
    </div>
  );
}

/** Ironbow-style palette used by thermal cameras. */
function ironbow(n: number) {
  const stops: [number, number, number][] = [[0, 0, 20], [60, 0, 120], [180, 20, 110], [240, 90, 20], [255, 190, 30], [255, 250, 210]];
  const x = Math.min(0.999, Math.max(0, n)) * (stops.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = stops[i]!, b = stops[i + 1]!;
  return `rgb(${a.map((v, k) => Math.round(v + (b[k]! - v) * f)).join(",")})`;
}

function ThermalGrid({ grid, ambient }: { grid: number[]; ambient: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [showNums, setShowNums] = useState(false);
  const min = Math.min(...grid), max = Math.max(...grid);
  const avg = grid.reduce((a, b) => a + b, 0) / grid.length;
  const lo = Math.min(min, ambient - 5), hi = Math.max(max, ambient + 15);
  const peakIdx = grid.indexOf(max);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    // bilinear upscale 8x8 -> 64x64 for a smooth thermal image
    const N = 64;
    const img = ctx.createImageData(N, N);
    const at = (x: number, y: number) => grid[Math.min(7, Math.max(0, y)) * 8 + Math.min(7, Math.max(0, x))]!;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = (x / N) * 8 - 0.5, gy = (y / N) * 8 - 0.5;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const v = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
      const [r, g, b] = ironbow((v - lo) / (hi - lo)).match(/\d+/g)!.map(Number);
      const o = (y * N + x) * 4;
      img.data[o] = r!; img.data[o + 1] = g!; img.data[o + 2] = b!; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [grid, lo, hi]);

  return (
    <div className="panel-glass p-4">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="size-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">Thermal array · AMG8833 8×8</h3>
        <button onClick={() => setShowNums(!showNums)} className="ml-auto rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
          {showNums ? "Image" : "Values"}
        </button>
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg">
        {showNums ? (
          <div className="grid size-full grid-cols-8">
            {grid.map((v, i) => (
              <div key={i} className={`grid place-items-center text-[11px] font-medium ${i === peakIdx ? "ring-2 ring-primary ring-inset" : ""}`} style={{ background: ironbow((v - lo) / (hi - lo)), color: (v - lo) / (hi - lo) > 0.55 ? "#111" : "#fff" }}>
                {v.toFixed(1)}
              </div>
            ))}
          </div>
        ) : (
          <>
            <canvas ref={ref} width={64} height={64} className="size-full" style={{ imageRendering: "auto" }} />
            <div className="pointer-events-none absolute size-[12.5%] rounded-full border-2 border-white" style={{ left: `${(peakIdx % 8) * 12.5}%`, top: `${Math.floor(peakIdx / 8) * 12.5}%` }} />
          </>
        )}
      </div>
      <div className="mt-2 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(ironbow).join(",")})` }} />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{lo.toFixed(0)}°C</span><span>{hi.toFixed(0)}°C</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-secondary/60 p-2"><p className="text-muted-foreground">Min</p><p className="font-semibold">{min.toFixed(1)}°C</p></div>
        <div className="rounded-lg bg-secondary/60 p-2"><p className="text-muted-foreground">Average</p><p className="font-semibold">{avg.toFixed(1)}°C</p></div>
        <div className="rounded-lg bg-secondary/60 p-2"><p className="text-muted-foreground">Peak</p><p className={`font-semibold ${max >= THRESHOLDS.thermal_c ? "text-status-crit" : ""}`}>{max.toFixed(1)}°C</p></div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Top rows: sky & pit wall · middle: benches · bottom: haul road. Vehicles show at 40–70°C, people at 31–35°C.</p>
    </div>
  );
}

function MmWave({ t, history }: { t: Telemetry; history: Telemetry[] }) {
  const R = 600; // cm max range
  const cx = 150, cy = 150, rad = 135;
  const toXY = (d: number, a: number) => {
    const r = (d / R) * rad, th = ((a - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(th), cy + r * Math.sin(th)] as const;
  };
  const trail = history.slice(-20).filter((h) => h.mmwave_presence).map((h) => toXY(h.mmwave_distance_cm, h.mmwave_angle_deg));
  const [tx, ty] = toXY(t.mmwave_distance_cm, t.mmwave_angle_deg);
  const gates = t.mmwave_gates?.length ? t.mmwave_gates : Array(9).fill(0);
  const sector = (a1: number, a2: number, r: number) => {
    const [x1, y1] = toXY((r / rad) * R, a1), [x2, y2] = toXY((r / rad) * R, a2);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  };
  return (
    <div className="panel-glass p-4">
      <div className="mb-3 flex items-center gap-2">
        <Radar className="size-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">mmWave presence radar · LD2410</h3>
      </div>
      <svg viewBox="0 0 300 160" className="w-full">
        <path d={sector(-60, 60, rad)} fill="var(--accent)" stroke="var(--border)" />
        <path d={sector(-60, 60, (225 / R) * rad)} fill="var(--status-crit)" fillOpacity={0.08} />
        {[150, 300, 450, 600].map((d) => {
          const r = (d / R) * rad;
          const [x1, y1] = toXY(d, -60), [x2, y2] = toXY(d, 60);
          return (
            <g key={d}>
              <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke="var(--border)" strokeDasharray="3 3" />
              <text x={cx + 3} y={cy - r + 10} fontSize={8} fill="var(--muted-foreground)">{d / 100} m</text>
            </g>
          );
        })}
        {[-60, -30, 0, 30, 60].map((a) => { const [x, y] = toXY(R, a); return <line key={a} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" />; })}
        {trail.length > 1 && <polyline points={trail.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="var(--status-crit)" strokeOpacity={0.4} strokeWidth={1.5} />}
        {t.mmwave_presence && (
          <g>
            <circle cx={tx} cy={ty} r={12} fill="var(--status-crit)" fillOpacity={0.2} className="animate-ping" style={{ transformOrigin: `${tx}px ${ty}px` }} />
            <circle cx={tx} cy={ty} r={5} fill="var(--status-crit)" />
          </g>
        )}
        <rect x={cx - 8} y={cy - 4} width={16} height={10} rx={2} fill="var(--primary)" />
      </svg>
      <p className={`text-center text-sm font-semibold ${t.mmwave_presence ? "text-status-crit" : "text-status-clear"}`}>
        {t.mmwave_presence ? `Person ${t.mmwave_motion === "MOVING" ? "moving" : "standing still"} · ${(t.mmwave_distance_cm / 100).toFixed(2)} m · ${t.mmwave_angle_deg}°` : "No one detected"}
      </p>
      <p className="mt-3 mb-1 text-xs text-muted-foreground">Signal energy per 0.75 m gate</p>
      <div className="flex h-16 items-end gap-1">
        {gates.map((g, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <div className={`w-full rounded-t ${g > 30 ? "bg-status-crit" : "bg-primary/40"}`} style={{ height: `${Math.max(3, g) * 0.55}px` }} title={`${g}`} />
            <span className="text-[9px] text-muted-foreground">{(i * 0.75).toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SensorsPage() {
  const { telemetry: t, history, activeVehicle, fleetTel, vehicles, selectVehicle } = useTelemetry();
  const spec = truckFor(activeVehicle.id);
  const last = history.slice(-40);
  const s = (k: keyof Telemetry) => last.map((h) => Number(h[k]) || 0);
  const lvl = (v: number, warn: number, crit: number, inverse = false): Tone =>
    inverse ? (v <= crit ? "crit" : v <= warn ? "warn" : "ok") : v >= crit ? "crit" : v >= warn ? "warn" : "ok";

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Sensors · {activeVehicle.name}</h2>
        <p className="text-sm text-muted-foreground">Pick a truck — every reading below switches to that truck.</p>
      </div>
      <TruckPicker />

      <div className="grid gap-4 lg:grid-cols-3">
        <ThermalGrid grid={t.thermal_grid} ambient={t.ambient_c} />
        <MmWave t={t} history={history} />
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Tile icon={Ruler} label="Front obstacle" value={`${t.distance_cm.toFixed(1)} cm`} tone={t.risk_level === "CRITICAL" ? "crit" : t.risk_level === "WARNING" ? "warn" : "ok"} spark={s("distance_cm")} />
          <Tile icon={Gauge} label="Speed" value={`${t.speed_kmh.toFixed(1)} km/h`} sub={`max ${spec.top_speed_kmh}`} spark={s("speed_kmh")} />
          <Tile icon={Package} label="Payload" value={`${t.payload_t} t`} pct={(t.payload_t / spec.payload_t) * 100} sub={`rated ${spec.payload_t} t`} />
          <Tile icon={Fuel} label="Fuel" value={`${t.fuel_pct.toFixed(1)}%`} tone={lvl(t.fuel_pct, 25, 15, true)} pct={t.fuel_pct} />
          <Tile icon={Thermometer} label="Engine coolant" value={`${t.engine_temp_c.toFixed(1)}°C`} tone={lvl(t.engine_temp_c, 98, 105)} spark={s("engine_temp_c")} />
          <Tile icon={Flame} label="Tyre temp" value={`${t.tyre_temp_c.toFixed(0)}°C`} tone={lvl(t.tyre_temp_c, 75, 85)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Tile icon={Thermometer} label="Ambient" value={`${t.ambient_c}°C`} />
        <Tile icon={Droplets} label="Humidity" value={`${t.humidity_pct}%`} pct={t.humidity_pct} />
        <Tile icon={Battery} label="Sensor battery" value={`${t.battery_pct}%`} sub={`${t.battery_v} V · ${t.current_a} A`} tone={lvl(t.battery_pct, 35, THRESHOLDS.battery_pct, true)} pct={t.battery_pct} />
        <Tile icon={Clock} label="Uptime" value={fmtUptime(t.uptime_s)} />
        <Tile icon={MemoryStick} label="RAM" value={`${t.ram_pct}%`} tone={lvl(t.ram_pct, 70, THRESHOLDS.ram_pct)} pct={t.ram_pct} />
        <Tile icon={Cpu} label="CPU" value={`${t.cpu_pct}%`} sub={`${t.cpu_temp_c}°C`} pct={t.cpu_pct} />
        <Tile icon={Wifi} label="Wi-Fi" value={`${t.rssi_dbm} dBm`} sub={`${t.latency_ms} ms`} tone={t.rssi_dbm < THRESHOLDS.rssi_dbm ? "warn" : "ok"} />
        <Tile icon={Compass} label="Heading / tilt" value={`${t.heading_deg}°`} sub={`tilt ${t.tilt_deg}°`} />
      </div>

      <div className="panel-glass overflow-x-auto p-4">
        <h3 className="mb-2 font-display text-sm font-semibold">All trucks</h3>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left"><th className="py-2">Truck</th><th>State</th><th className="text-right">Speed</th><th className="text-right">Payload</th><th className="text-right">Fuel</th><th className="text-right">Engine</th><th className="text-right">Peak thermal</th><th className="text-right">Radar</th><th className="text-right">Front</th></tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const u = fleetTel[v.id];
              if (!u) return null;
              return (
                <tr key={v.id} onClick={() => selectVehicle(v.id)} className={`cursor-pointer border-t border-border ${v.id === activeVehicle.id ? "bg-accent" : "hover:bg-secondary/50"}`}>
                  <td className="py-2 font-medium">{v.name}</td>
                  <td className="capitalize">{u.cycle_state.toLowerCase()}</td>
                  <td className="text-right">{u.speed_kmh.toFixed(0)} km/h</td>
                  <td className="text-right">{u.payload_t} t</td>
                  <td className={`text-right ${u.fuel_pct < 25 ? "text-status-warn" : ""}`}>{u.fuel_pct.toFixed(0)}%</td>
                  <td className="text-right">{u.engine_temp_c.toFixed(0)}°C</td>
                  <td className="text-right">{u.thermal_c.toFixed(1)}°C</td>
                  <td className={`text-right ${u.mmwave_presence ? "text-status-crit" : "text-muted-foreground"}`}>{u.mmwave_presence ? `${(u.mmwave_distance_cm / 100).toFixed(1)} m` : "—"}</td>
                  <td className={`text-right ${riskMeta[u.risk_level].text}`}>{u.distance_cm.toFixed(0)} cm</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
