import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";

const NEAR_M = 60; // radar range
const FRONT_DEG = 35; // half-angle of the front cone
const WARN_M = 45;
const CRIT_M = 25;

/** Front crosshair + truck-ahead distance + buzzer, and a nearby-truck radar, drawn over the live camera. */
export function CameraOverlays() {
  const { telemetry: t, activeVehicle, vehicles, fleetTel } = useTelemetry();
  const [sound, setSound] = useState(true);
  const ctxRef = useRef<AudioContext | null>(null);

  const near = vehicles
    .filter((v) => v.id !== activeVehicle.id && fleetTel[v.id])
    .map((v) => {
      const o = fleetTel[v.id]!;
      const dx = o.pos_x - t.pos_x, dy = o.pos_y - t.pos_y;
      const d = Math.hypot(dx, dy);
      let rel = ((Math.atan2(dx, -dy) * 180) / Math.PI - t.heading_deg + 540) % 360 - 180; // -180..180, 0 = straight ahead
      return { v, d, rel, spd: o.speed_kmh };
    })
    .filter((n) => n.d <= NEAR_M)
    .sort((a, b) => a.d - b.d);

  const ahead = near.find((n) => Math.abs(n.rel) <= FRONT_DEG);
  const level = !ahead ? "CLEAR" : ahead.d < CRIT_M ? "CRITICAL" : ahead.d < WARN_M ? "WARNING" : "CLEAR";
  const color = level === "CRITICAL" ? "var(--status-crit)" : level === "WARNING" ? "var(--status-warn)" : "var(--status-clear)";

  // Buzzer: beeps faster as the truck ahead gets closer
  useEffect(() => {
    if (!sound || level === "CLEAR") return;
    const beep = () => {
      try {
        const ctx = (ctxRef.current ??= new AudioContext());
        void ctx.resume();
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = level === "CRITICAL" ? 1800 : 1100;
        g.gain.value = 0.08;
        osc.connect(g).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch { /* audio unavailable */ }
    };
    beep();
    const id = setInterval(beep, level === "CRITICAL" ? 250 : 700);
    return () => clearInterval(id);
  }, [sound, level]);

  // Horizontal position of the truck ahead inside the frame (±FRONT_DEG maps to 15%..85%)
  const markerX = ahead ? 50 + (ahead.rel / FRONT_DEG) * 35 : 50;

  return (
    <>
      {/* Crosshair */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-10 size-full">
        <g stroke={color} strokeWidth="0.35" fill="none" vectorEffect="non-scaling-stroke">
          <line x1="50" y1="38" x2="50" y2="46" vectorEffect="non-scaling-stroke" />
          <line x1="50" y1="54" x2="50" y2="62" vectorEffect="non-scaling-stroke" />
          <line x1="40" y1="50" x2="46" y2="50" vectorEffect="non-scaling-stroke" />
          <line x1="54" y1="50" x2="60" y2="50" vectorEffect="non-scaling-stroke" />
          {/* front detection cone edges */}
          <line x1="15" y1="30" x2="15" y2="70" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
          <line x1="85" y1="30" x2="85" y2="70" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
        </g>
        {ahead && (
          <rect x={markerX - 7} y="38" width="14" height="24" fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" className={level === "CRITICAL" ? "animate-pulse" : ""} />
        )}
      </svg>
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color }} />

      {/* Distance readout */}
      <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 text-center">
        <div
          className={`rounded-md px-3 py-1 text-xs font-semibold shadow-md ${level === "CRITICAL" ? "animate-pulse" : ""}`}
          style={{ background: color, color: "#fff" }}
        >
          {ahead ? `${ahead.v.id} AHEAD · ${ahead.d.toFixed(1)} m` : "FRONT CLEAR"}
        </div>
        {ahead && (
          <div className="mt-1 rounded bg-card/90 px-2 py-0.5 text-[10px] text-foreground">
            {level === "CRITICAL" ? "BRAKE — too close" : level === "WARNING" ? "Slow down" : "Tracking"} · {ahead.spd.toFixed(0)} km/h
          </div>
        )}
      </div>

      {/* Buzzer toggle */}
      <button
        onClick={() => setSound((s) => !s)}
        className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-md border border-border bg-card/90 px-2 py-1 text-[10px] font-medium shadow"
      >
        {sound ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />} Buzzer {sound ? "on" : "off"}
      </button>

      {/* Nearby radar */}
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 w-40 rounded-lg border border-border bg-card/90 p-1.5 shadow-md md:w-48">
        <div className="mb-1 flex justify-between text-[10px] font-medium">
          <span>Nearby trucks</span>
          <span className="text-muted-foreground">≤{NEAR_M} m</span>
        </div>
        <svg viewBox="-50 -50 100 100" className="mx-auto block size-20 md:size-24">
          <path d={`M0 0 L${Math.sin((-FRONT_DEG * Math.PI) / 180) * 48} ${-Math.cos((FRONT_DEG * Math.PI) / 180) * 48} A48 48 0 0 1 ${Math.sin((FRONT_DEG * Math.PI) / 180) * 48} ${-Math.cos((FRONT_DEG * Math.PI) / 180) * 48} Z`} className="fill-primary/10" />
          {[48, 32, 16].map((r) => <circle key={r} r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth="1" />)}
          <polygon points="0,-5 4,4 -4,4" className="fill-primary" />
          {near.map((n) => {
            const r = (n.d / NEAR_M) * 48, a = (n.rel * Math.PI) / 180;
            return <circle key={n.v.id} cx={Math.sin(a) * r} cy={-Math.cos(a) * r} r="4" className={n.d < CRIT_M ? "fill-status-crit" : "fill-status-warn"} />;
          })}
        </svg>
        {near.length === 0 ? (
          <p className="text-center text-[10px] text-status-clear">No trucks close by</p>
        ) : (
          <ul className="space-y-0.5 text-[10px]">
            {near.slice(0, 3).map((n) => (
              <li key={n.v.id} className={`flex justify-between ${n.d < CRIT_M ? "font-semibold text-status-crit" : ""}`}>
                <span>{n.v.id}{Math.abs(n.rel) <= FRONT_DEG ? " ▲" : ""}</span>
                <span>{n.d.toFixed(0)} m</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
