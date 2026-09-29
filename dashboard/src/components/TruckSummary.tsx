import { Fuel, Gauge, Package, Thermometer, CircleDot, Route as RouteIcon } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { ROUTES, truckFor } from "@/lib/fleet";

/** Full spec + live readout for the selected truck. */
export function TruckSummary() {
  const { activeVehicle, telemetry: t } = useTelemetry();
  const s = truckFor(activeVehicle.id);
  const route = ROUTES[s.route % ROUTES.length]!;
  const items = [
    { icon: Gauge, label: "Speed", value: `${t.speed_kmh.toFixed(1)} km/h`, sub: `max ${s.top_speed_kmh} km/h` },
    { icon: Package, label: "Payload", value: `${t.payload_t} t`, sub: `rated ${s.payload_t} t` },
    { icon: Fuel, label: "Fuel", value: `${t.fuel_pct.toFixed(1)}%`, sub: `${Math.round((t.fuel_pct / 100) * s.fuel_tank_l)} of ${s.fuel_tank_l} L` },
    { icon: Thermometer, label: "Engine coolant", value: `${t.engine_temp_c.toFixed(1)}°C`, sub: `tyres ${t.tyre_temp_c.toFixed(0)}°C` },
    { icon: CircleDot, label: "Cycle", value: t.cycle_state.toLowerCase(), sub: `heading ${t.heading_deg}°` },
    { icon: RouteIcon, label: "Route", value: route.name, sub: `${route.from} → ${route.to}` },
  ];
  return (
    <section className="panel-glass p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-base font-semibold">{activeVehicle.name}</h2>
        <span className="text-sm text-muted-foreground">
          {s.maker} {s.model} · {s.engine_kw.toLocaleString()} kW · empty {s.empty_weight_t} t
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-lg bg-secondary/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5 text-primary" />{label}</p>
            <p className="mt-1 truncate font-display text-lg font-semibold capitalize">{value}</p>
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
