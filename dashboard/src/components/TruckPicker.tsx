import { useTelemetry } from "@/context/TelemetryContext";
import { truckFor } from "@/lib/fleet";
import { riskMeta } from "@/lib/collision";

/** Row of truck cards; clicking one makes it the active truck everywhere. */
export function TruckPicker() {
  const { vehicles, activeVehicle, selectVehicle, fleetTel } = useTelemetry();
  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {vehicles.map((v) => {
        const spec = truckFor(v.id);
        const t = fleetTel[v.id];
        const active = v.id === activeVehicle.id;
        return (
          <button
            key={v.id}
            onClick={() => selectVehicle(v.id)}
            className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50"}`}
          >
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: spec.color }} />
              <span className="font-display text-sm font-semibold">{v.name}</span>
              {t && <span className={`ml-auto size-2 rounded-full ${riskMeta[t.risk_level].dot}`} />}
            </div>
            <p className="text-xs text-muted-foreground">{v.model ?? `${spec.maker} ${spec.model}`}</p>
            {t && (
              <p className="mt-1.5 text-xs">
                <span className="font-medium">{t.cycle_state.toLowerCase()}</span>
                <span className="text-muted-foreground"> · {t.speed_kmh.toFixed(0)} km/h · {t.payload_t} t</span>
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
