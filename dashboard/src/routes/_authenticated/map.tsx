import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPinned } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { ROUTES, ZONES, truckFor } from "@/lib/fleet";
import { riskMeta } from "@/lib/collision";
import mineImg from "@/assets/mine-aerial.jpg";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Mine Site Map — Open-Cast Collision Avoidance" },
      { name: "description", content: "Aerial map of the open-pit mine showing all five haul trucks moving along their haul roads, with proximity alerts." },
      { property: "og:title", content: "Mine Site Map — Collision Avoidance" },
      { property: "og:description", content: "Live positions of every haul truck in the pit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

const W = 1000, H = 600;
const PROX_M = 45;

function MapPage() {
  const { fleetTel, fleetHistory, vehicles, activeVehicle, selectVehicle } = useTelemetry();
  const [showRoads, setShowRoads] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const units = vehicles.map((v) => ({ v, t: fleetTel[v.id], spec: truckFor(v.id) })).filter((u) => u.t);
  const pairs: { a: (typeof units)[number]; b: (typeof units)[number]; d: number }[] = [];
  units.forEach((a, i) => units.slice(i + 1).forEach((b) => {
    const d = Math.hypot(a.t!.pos_x - b.t!.pos_x, a.t!.pos_y - b.t!.pos_y);
    if (d < PROX_M) pairs.push({ a, b, d });
  }));
  const sel = units.find((u) => u.v.id === activeVehicle.id);
  const btn = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`;

  return (
    <main className="mx-auto grid max-w-[1500px] gap-4 p-4 md:p-6 lg:grid-cols-4">
      <section className="panel-glass p-4 lg:col-span-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <MapPinned className="size-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Mine site · 1.0 × 0.6 km</h2>
          <div className="ml-auto flex gap-1.5">
            <button onClick={() => setShowRoads(!showRoads)} className={btn(showRoads)}>Haul roads</button>
            <button onClick={() => setShowTrails(!showTrails)} className={btn(showTrails)}>Trails</button>
            <button onClick={() => setShowLabels(!showLabels)} className={btn(showLabels)}>Labels</button>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-border">
          <img src={mineImg} alt="Aerial view of the open-pit mine" width={1600} height={960} className="block w-full" />
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full">
            {showRoads && ROUTES.map((r) => (
              <polyline key={r.name} points={r.path.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={4} strokeLinejoin="round" strokeDasharray="10 6" />
            ))}
            {showLabels && ZONES.map((z) => (
              <g key={z.id}>
                <rect x={z.x - 52} y={z.y - 12} width={104} height={20} rx={10} fill="#0f172a" fillOpacity={0.7} />
                <text x={z.x} y={z.y + 2} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={600}>{z.label}</text>
              </g>
            ))}
            {showTrails && units.map(({ v, spec }) => {
              const h = (fleetHistory[v.id] ?? []).slice(-60);
              return h.length > 1 ? <polyline key={v.id} points={h.map((p) => `${p.pos_x},${p.pos_y}`).join(" ")} fill="none" stroke={spec.color} strokeWidth={3} strokeOpacity={0.7} /> : null;
            })}
            {pairs.map(({ a, b, d }) => (
              <g key={a.v.id + b.v.id}>
                <line x1={a.t!.pos_x} y1={a.t!.pos_y} x2={b.t!.pos_x} y2={b.t!.pos_y} stroke="#ef4444" strokeWidth={2.5} strokeDasharray="6 4" />
                <text x={(a.t!.pos_x + b.t!.pos_x) / 2} y={(a.t!.pos_y + b.t!.pos_y) / 2 - 6} textAnchor="middle" fontSize={11} fill="#fff" stroke="#ef4444" strokeWidth={3} paintOrder="stroke" fontWeight={700}>{d.toFixed(0)} m</text>
              </g>
            ))}
            {units.map(({ v, t, spec }) => {
              const active = v.id === activeVehicle.id;
              return (
                <g key={v.id} transform={`translate(${t!.pos_x} ${t!.pos_y})`} onClick={() => selectVehicle(v.id)} className="cursor-pointer">
                  {active && <circle r={22} fill="none" stroke="#fff" strokeWidth={2} className="animate-pulse" />}
                  {t!.mmwave_presence && <circle r={30} fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" />}
                  <g transform={`rotate(${t!.heading_deg})`}>
                    <rect x={-13} y={-8} width={26} height={16} rx={3} fill={spec.color} stroke="#fff" strokeWidth={2} />
                    <path d="M 13 -6 L 20 0 L 13 6 Z" fill="#fff" />
                  </g>
                  <text y={-16} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" stroke="#0f172a" strokeWidth={3} paintOrder="stroke">{v.id}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Click a truck to select it. Red dashed lines appear when two trucks are within {PROX_M} m. Red circle = person detected by the truck's radar.</p>
      </section>

      <aside className="space-y-4">
        {sel && (
          <section className="panel-glass space-y-2 p-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: sel.spec.color }} />
              <h3 className="font-display text-base font-semibold">{sel.v.name}</h3>
            </div>
            <p className="text-muted-foreground">{sel.spec.maker} {sel.spec.model}</p>
            <dl className="grid grid-cols-2 gap-y-1.5">
              <dt className="text-muted-foreground">State</dt><dd className="text-right capitalize">{sel.t!.cycle_state.toLowerCase()}</dd>
              <dt className="text-muted-foreground">Route</dt><dd className="text-right">{ROUTES[sel.spec.route % ROUTES.length]!.name}</dd>
              <dt className="text-muted-foreground">Speed</dt><dd className="text-right">{sel.t!.speed_kmh.toFixed(1)} km/h</dd>
              <dt className="text-muted-foreground">Payload</dt><dd className="text-right">{sel.t!.payload_t} t</dd>
              <dt className="text-muted-foreground">Position</dt><dd className="text-right">{sel.t!.pos_x.toFixed(0)}, {sel.t!.pos_y.toFixed(0)} m</dd>
              <dt className="text-muted-foreground">Heading</dt><dd className="text-right">{sel.t!.heading_deg}°</dd>
              <dt className="text-muted-foreground">Front sensor</dt><dd className={`text-right ${riskMeta[sel.t!.risk_level].text}`}>{sel.t!.distance_cm.toFixed(0)} cm</dd>
            </dl>
          </section>
        )}
        <section className="panel-glass p-4">
          <h3 className="mb-2 font-display text-sm font-semibold">Fleet</h3>
          <ul className="space-y-1.5 text-sm">
            {units.map(({ v, t, spec }) => (
              <li key={v.id}>
                <button onClick={() => selectVehicle(v.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${v.id === activeVehicle.id ? "bg-accent" : "hover:bg-secondary"}`}>
                  <span className="size-2.5 rounded-full" style={{ background: spec.color }} />
                  <span className="font-medium">{v.id}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{t!.cycle_state.charAt(0) + t!.cycle_state.slice(1).toLowerCase()} · {t!.speed_kmh.toFixed(0)} km/h</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel-glass p-4 text-sm">
          <h3 className="mb-2 font-display text-sm font-semibold">Proximity alerts</h3>
          {pairs.length === 0 ? <p className="text-muted-foreground">All trucks well separated.</p> : pairs.map(({ a, b, d }) => (
            <p key={a.v.id + b.v.id} className="text-status-crit">{a.v.id} ↔ {b.v.id}: {d.toFixed(0)} m</p>
          ))}
        </section>
      </aside>
    </main>
  );
}
