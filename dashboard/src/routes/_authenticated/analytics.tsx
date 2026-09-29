import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTelemetry } from "@/context/TelemetryContext";
import { CRITICAL_CM, WARNING_CM, formatTime, type Telemetry } from "@/lib/collision";
import { TruckPicker } from "@/components/TruckPicker";
import { truckFor } from "@/lib/fleet";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Fleet Analytics — Open-Cast Collision Avoidance" },
      { name: "description", content: "Precise per-truck statistics: closest approach, percentiles, time in risk zones, speed, payload, fuel burn and fleet comparison." },
      { property: "og:title", content: "Fleet Analytics — Collision Avoidance" },
      { property: "og:description", content: "Per-truck and fleet-wide safety and productivity statistics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analytics,
});

const tip = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };
const TICK_S = 0.4;

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

function stats(h: Telemetry[]) {
  const d = h.map((t) => t.distance_cm).sort((a, b) => a - b);
  const sp = h.map((t) => t.speed_kmh);
  const n = h.length || 1;
  const zone = { CLEAR: 0, WARNING: 0, CRITICAL: 0 };
  h.forEach((t) => zone[t.risk_level]++);
  let brakes = 0, presence = 0;
  h.forEach((t, i) => {
    const p = h[i - 1];
    if (t.risk_level === "CRITICAL" && p?.risk_level !== "CRITICAL") brakes++;
    if (t.mmwave_presence && !p?.mmwave_presence) presence++;
  });
  const mean = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const moving = sp.filter((v) => v > 0.5);
  const fuelUsed = h.length > 1 ? h[0]!.fuel_pct - h[h.length - 1]!.fuel_pct : 0;
  return {
    n: h.length,
    seconds: h.length * TICK_S,
    min: d[0] ?? 0, p5: pct(d, 0.05), median: pct(d, 0.5), mean, sd, max: d[d.length - 1] ?? 0,
    zone: { clear: (zone.CLEAR / n) * 100, warn: (zone.WARNING / n) * 100, crit: (zone.CRITICAL / n) * 100 },
    brakes, presence,
    avgSpeed: moving.length ? moving.reduce((a, b) => a + b, 0) / moving.length : 0,
    maxSpeed: sp.length ? Math.max(...sp) : 0,
    movingPct: (moving.length / n) * 100,
    maxEngine: h.length ? Math.max(...h.map((t) => t.engine_temp_c)) : 0,
    peakThermal: h.length ? Math.max(...h.map((t) => t.thermal_c)) : 0,
    fuelUsed,
  };
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="panel-glass p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`panel-glass p-4 ${className}`}>
      <p className="mb-3 font-display text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

function Analytics() {
  const { history, incidents, activeVehicle, vehicles, fleetHistory } = useTelemetry();
  const s = stats(history);
  const spec = truckFor(activeVehicle.id);
  const data = history.map((t) => ({ time: formatTime(t.timestamp), distance: +t.distance_cm.toFixed(1), speed: +t.speed_kmh.toFixed(1), payload: t.payload_t, engine: +t.engine_temp_c.toFixed(1), fuel: +t.fuel_pct.toFixed(2), thermal: t.thermal_c }));

  // distance histogram, 20 cm bins
  const bins = Array.from({ length: 13 }, (_, i) => ({ range: `${i * 20}–${i * 20 + 20}`, lo: i * 20, count: 0 }));
  history.forEach((t) => { const b = bins[Math.min(12, Math.floor(t.distance_cm / 20))]; if (b) b.count++; });

  const fleet = vehicles.map((v) => ({ id: v.id, ...stats(fleetHistory[v.id] ?? []), color: truckFor(v.id).color }));
  const mine = incidents.filter((i) => i.vehicle_id === activeVehicle.id);

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Analytics · {activeVehicle.name}</h2>
        <p className="text-sm text-muted-foreground">
          {s.n} readings over {Math.floor(s.seconds / 60)} min {Math.round(s.seconds % 60)} s (one every {TICK_S} s). Pick a truck to switch.
        </p>
      </div>
      <TruckPicker />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Stat label="Closest approach" value={`${s.min.toFixed(1)} cm`} tone={s.min <= CRITICAL_CM ? "text-status-crit" : ""} />
        <Stat label="5th percentile" value={`${s.p5.toFixed(1)} cm`} sub="95% of time farther" />
        <Stat label="Median distance" value={`${s.median.toFixed(1)} cm`} sub={`mean ${s.mean.toFixed(1)} ± ${s.sd.toFixed(1)}`} />
        <Stat label="Emergency brakes" value={String(s.brakes)} sub={`${mine.length} incidents logged`} tone={s.brakes ? "text-status-crit" : ""} />
        <Stat label="People detected" value={String(s.presence)} sub="radar events" tone={s.presence ? "text-status-warn" : ""} />
        <Stat label="Average speed" value={`${s.avgSpeed.toFixed(1)} km/h`} sub={`max ${s.maxSpeed.toFixed(1)} / ${spec.top_speed_kmh}`} />
        <Stat label="Time moving" value={`${s.movingPct.toFixed(1)}%`} />
        <Stat label="Fuel used" value={`${s.fuelUsed.toFixed(2)}%`} sub={`≈ ${Math.round((s.fuelUsed / 100) * spec.fuel_tank_l)} L`} />
      </div>

      <Card title="Front obstacle distance (cm)">
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={axis} minTickGap={50} />
              <YAxis tick={axis} domain={[0, 260]} />
              <Tooltip contentStyle={tip} />
              <ReferenceLine y={WARNING_CM} stroke="var(--status-warn)" strokeDasharray="4 4" label={{ value: `Warning ${WARNING_CM}`, fontSize: 10, fill: "var(--status-warn)", position: "insideTopRight" }} />
              <ReferenceLine y={CRITICAL_CM} stroke="var(--status-crit)" strokeDasharray="4 4" label={{ value: `Brake ${CRITICAL_CM}`, fontSize: 10, fill: "var(--status-crit)", position: "insideBottomRight" }} />
              <Area type="monotone" dataKey="distance" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Speed (km/h) and payload (t)" className="lg:col-span-2">
          <div className="h-60">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis yAxisId="s" tick={axis} domain={[0, spec.top_speed_kmh]} />
                <YAxis yAxisId="p" orientation="right" tick={axis} domain={[0, spec.payload_t]} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="s" type="monotone" dataKey="speed" name="Speed" stroke="var(--primary)" dot={false} isAnimationActive={false} />
                <Line yAxisId="p" type="stepAfter" dataKey="payload" name="Payload" stroke="var(--status-warn)" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Time in each risk zone">
          <div className="space-y-3 pt-2">
            {[["Clear", s.zone.clear, "bg-status-clear"], ["Warning", s.zone.warn, "bg-status-warn"], ["Critical", s.zone.crit, "bg-status-crit"]].map(([l, v, c]) => (
              <div key={l as string}>
                <div className="flex justify-between text-sm"><span>{l}</span><span className="font-semibold">{(v as number).toFixed(1)}% · {(((v as number) / 100) * s.seconds).toFixed(0)} s</span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${c}`} style={{ width: `${v}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Distance distribution (readings per 20 cm)">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={bins}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ ...axis, fontSize: 9 }} interval={1} />
                <YAxis tick={axis} allowDecimals={false} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="count" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                  {bins.map((b) => <Cell key={b.lo} fill={b.lo < CRITICAL_CM ? "var(--status-crit)" : b.lo < WARNING_CM ? "var(--status-warn)" : "var(--primary)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Engine coolant & peak thermal (°C)">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis tick={axis} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="engine" name="Engine" stroke="var(--status-crit)" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="thermal" name="Thermal peak" stroke="var(--status-warn)" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Fuel level (%)">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={data}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis tick={axis} domain={["dataMin - 0.5", "dataMax + 0.5"]} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip contentStyle={tip} />
                <Area type="monotone" dataKey="fuel" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Fleet comparison">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left"><th className="py-2">Truck</th><th className="text-right">Readings</th><th className="text-right">Closest</th><th className="text-right">Median</th><th className="text-right">Brakes</th><th className="text-right">People</th><th className="text-right">Critical time</th><th className="text-right">Avg speed</th><th className="text-right">Max engine</th><th className="text-right">Fuel used</th></tr>
            </thead>
            <tbody>
              {fleet.map((f) => (
                <tr key={f.id} className={`border-t border-border ${f.id === activeVehicle.id ? "bg-accent" : ""}`}>
                  <td className="py-2 font-medium"><span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: f.color }} />{f.id}</td>
                  <td className="text-right">{f.n}</td>
                  <td className={`text-right ${f.min <= CRITICAL_CM ? "text-status-crit" : ""}`}>{f.min.toFixed(1)} cm</td>
                  <td className="text-right">{f.median.toFixed(1)} cm</td>
                  <td className="text-right">{f.brakes}</td>
                  <td className="text-right">{f.presence}</td>
                  <td className="text-right">{f.zone.crit.toFixed(1)}%</td>
                  <td className="text-right">{f.avgSpeed.toFixed(1)} km/h</td>
                  <td className="text-right">{f.maxEngine.toFixed(1)}°C</td>
                  <td className="text-right">{f.fuelUsed.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 h-48">
          <ResponsiveContainer>
            <BarChart data={fleet}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="id" tick={axis} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip contentStyle={tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="brakes" name="Emergency brakes" fill="var(--status-crit)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
              <Bar dataKey="presence" name="People detected" fill="var(--status-warn)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </main>
  );
}
