import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Database, Radio, Server } from "lucide-react";
import { SourcePanel } from "@/components/SourcePanel";
import { useTelemetry } from "@/context/TelemetryContext";
import { CRITICAL_CM, WARNING_CM } from "@/lib/collision";

export const Route = createFileRoute("/_authenticated/system")({
  head: () => ({
    meta: [
      { title: "System & Hardware — Open-Cast Collision Avoidance" },
      { name: "description", content: "Node health, wiring pin map, safety thresholds and backend connection settings." },
      { property: "og:title", content: "System & Hardware — Collision Avoidance" },
      { property: "og:description", content: "ESP32-CAM pinout, safety rules and data source configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemPage,
});

const pins = [
  ["HC-SR04 TRIG", "GPIO 13"],
  ["HC-SR04 ECHO", "GPIO 12 (via divider)"],
  ["L298N IN1", "GPIO 14"],
  ["L298N IN2", "GPIO 15"],
  ["L298N IN3", "GPIO 2"],
  ["L298N IN4", "GPIO 4"],
  ["Power", "5V / GND shared"],
];

function SystemPage() {
  const { connection, source, telemetry, backendUrl, lastCommand } = useTelemetry();
  const nodes = [
    { icon: Cpu, name: "ESP32-CAM Node", status: source === "simulator" ? "Simulated" : connection, detail: `Last cmd: ${lastCommand}` },
    { icon: Radio, name: "Telemetry Link", status: connection, detail: `${telemetry.latency_ms} ms latency` },
    { icon: Server, name: "Python Server", status: source === "live" ? connection : "Not used", detail: backendUrl },
    { icon: Database, name: "Incident Store", status: "Ready", detail: "SQLite / PostgreSQL" },
  ];
  return (
    <main className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-6">
      <div>
        <h2 className="font-display text-lg font-bold tracking-[0.18em] uppercase">System & Hardware</h2>
        <p className="text-sm text-muted-foreground">Health of every link in the chain, from sensor to control room.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map((n) => (
          <div key={n.name} className="panel-glass p-4">
            <n.icon className="mb-2 size-5 text-primary" />
            <p className="font-display text-xs font-bold tracking-widest uppercase">{n.name}</p>
            <p className="mt-1 text-sm tracking-widest text-status-clear uppercase">{n.status}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{n.detail}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel-glass p-4">
          <p className="mb-3 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Wiring pin map</p>
          <table className="w-full text-sm">
            <tbody>
              {pins.map(([a, b]) => (
                <tr key={a} className="border-b border-border/50 last:border-0">
                  <td className="py-2">{a}</td>
                  <td className="py-2 text-right font-mono text-primary">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-glass space-y-3 p-4">
          <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Safety rules</p>
          <div className="rounded-md border border-status-crit/50 bg-status-crit/10 p-3 text-sm">
            <b className="text-status-crit">≤ {CRITICAL_CM} cm — Critical.</b> Automatic stop, red banner, incident logged. Manual drive locked.
          </div>
          <div className="rounded-md border border-status-warn/50 bg-status-warn/10 p-3 text-sm">
            <b className="text-status-warn">{CRITICAL_CM}–{WARNING_CM} cm — Warning.</b> Operator alerted, speed reduced.
          </div>
          <div className="rounded-md border border-status-clear/50 bg-status-clear/10 p-3 text-sm">
            <b className="text-status-clear">&gt; {WARNING_CM} cm — Clear.</b> Normal operation.
          </div>
          <p className="text-xs text-muted-foreground">The vehicle also enforces the {CRITICAL_CM} cm stop on-board, so it brakes even if the link drops.</p>
        </div>
        <SourcePanel />
      </div>
    </main>
  );
}
