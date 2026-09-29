import { Gauge, OctagonAlert, Ruler, Signal } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { riskMeta } from "@/lib/collision";

function Radial({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(1, value / max);
  const r = 52;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 130 130" className="size-36">
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
      <circle
        cx="65"
        cy="65"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform="rotate(-90 65 65)"
        style={{ transition: "stroke-dashoffset 0.35s ease, stroke 0.3s ease" }}
      />
      <text
        x="65"
        y="62"
        textAnchor="middle"
        fill="currentColor"
        className="fill-foreground font-mono text-[22px] font-bold"
      >
        {value.toFixed(0)}
      </text>
      <text
        x="65"
        y="80"
        textAnchor="middle"
        className="fill-muted-foreground font-mono text-[11px] tracking-widest"
      >
        CM
      </text>
    </svg>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-bold ${accent ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

export function TelemetryGauges() {
  const { telemetry } = useTelemetry();
  const meta = riskMeta[telemetry.risk_level];
  const color =
    telemetry.risk_level === "CLEAR"
      ? "var(--status-clear)"
      : telemetry.risk_level === "WARNING"
        ? "var(--status-warn)"
        : "var(--status-crit)";

  return (
    <section className="panel-glass p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="size-4 text-primary" />
        <h2 className="font-display text-xs tracking-[0.2em] uppercase">Telemetry</h2>
      </div>

      <div className="flex flex-col items-center">
        <Radial value={telemetry.distance_cm} max={260} color={color} />
        <span
          className={`mt-1 rounded border px-3 py-1 text-[11px] tracking-[0.2em] uppercase ${meta.bg} ${meta.text} ${telemetry.risk_level === "CRITICAL" ? "animate-pulse" : ""}`}
        >
          {telemetry.risk_level}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat
          icon={<Ruler className="size-3.5" />}
          label="Range"
          value={`${telemetry.distance_cm.toFixed(1)} cm`}
        />
        <Stat
          icon={<Signal className="size-3.5" />}
          label="Speed"
          value={`${telemetry.speed_pct}%`}
        />
        <Stat
          icon={<OctagonAlert className="size-3.5" />}
          label="Brake"
          value={telemetry.emergency_brake ? "ENGAGED" : "RELEASED"}
          accent={telemetry.emergency_brake ? "text-destructive" : "text-status-clear"}
        />
        <Stat
          icon={<Signal className="size-3.5" />}
          label="Latency"
          value={`${telemetry.latency_ms} ms`}
        />
      </div>
    </section>
  );
}
