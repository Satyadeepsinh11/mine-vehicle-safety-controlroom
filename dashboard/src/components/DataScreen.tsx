import { useTelemetry } from "@/context/TelemetryContext";
import { riskMeta, fmtUptime } from "@/lib/collision";
import { truckFor } from "@/lib/fleet";

/** Full-frame telemetry screen shown in place of video when no hardware camera is set. */
export function DataScreen() {
  const { telemetry: t, activeVehicle } = useTelemetry();
  const spec = truckFor(activeVehicle.id);
  const rm = riskMeta[t.risk_level];
  const cells: [string, string][] = [
    ["Speed", `${t.speed_kmh.toFixed(1)} km/h`],
    ["Payload", `${t.payload_t.toFixed(0)} t`],
    ["Fuel", `${t.fuel_pct.toFixed(0)} %`],
    ["Engine", `${t.engine_temp_c.toFixed(0)} °C`],
    ["Tyres", `${t.tyre_temp_c.toFixed(0)} °C`],
    ["Thermal", `${t.thermal_c.toFixed(1)} °C`],
    ["mmWave", t.mmwave_presence ? `${(t.mmwave_distance_cm / 100).toFixed(1)} m · ${t.mmwave_motion}` : "No presence"],
    ["Battery", `${t.battery_pct.toFixed(0)} % · ${t.battery_v.toFixed(1)} V`],
    ["CPU / RAM", `${t.cpu_pct.toFixed(0)} % / ${t.ram_pct.toFixed(0)} %`],
    ["Chip temp", `${t.cpu_temp_c.toFixed(0)} °C`],
    ["Wi-Fi", `${t.rssi_dbm} dBm`],
    ["Uptime", fmtUptime(t.uptime_s)],
  ];
  return (
    <div className="absolute inset-0 flex flex-col gap-3 bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-widest text-muted-foreground uppercase">{spec.maker} {spec.model}</p>
          <p className="font-display text-lg font-semibold">{activeVehicle.name} · {t.cycle_state}</p>
        </div>
        <span className={`rounded-md border px-3 py-1 text-sm font-semibold ${rm.bg} ${rm.text} ${t.risk_level === "CRITICAL" ? "animate-pulse" : ""}`}>
          {t.risk_level}{t.emergency_brake ? " · BRAKE" : ""}
        </span>
      </div>
      <div className="flex items-end gap-3">
        <span className={`font-display text-5xl font-bold tabular-nums md:text-6xl ${rm.text}`}>{t.distance_cm.toFixed(0)}</span>
        <span className="pb-2 text-sm text-muted-foreground">cm to nearest obstacle</span>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2 md:grid-cols-4">
        {cells.map(([k, v]) => (
          <div key={k} className="flex flex-col justify-center rounded-lg border border-border bg-background px-3 py-1.5">
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">{k}</span>
            <span className="truncate text-sm font-semibold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
