import { createFileRoute } from "@tanstack/react-router";
import { LiveCamera } from "@/components/LiveCamera";
import { TelemetryGauges } from "@/components/TelemetryGauges";
import { Controls } from "@/components/Controls";
import { EventLogsTable } from "@/components/EventLogsTable";
import { SourcePanel } from "@/components/SourcePanel";
import { TruckPicker } from "@/components/TruckPicker";
import { TruckSummary } from "@/components/TruckSummary";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Control Dashboard — Open-Cast Collision Avoidance" },
      { name: "description", content: "Live HUD video, proximity gauges, drive controls and incident logs for the haul vehicle node." },
      { property: "og:title", content: "Control Dashboard — Collision Avoidance" },
      { property: "og:description", content: "Real-time telemetry, emergency braking and incident history for the mine vehicle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <main className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-6">
      <TruckPicker />
      <TruckSummary />
      <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <LiveCamera />
        <EventLogsTable />
      </div>
      <div className="space-y-4">
        <TelemetryGauges />
        <Controls />
        <SourcePanel />
      </div>
      </div>
    </main>
  );
}
