import { createFileRoute } from "@tanstack/react-router";
import { LiveCamera } from "@/components/LiveCamera";
import { VehicleManager } from "@/components/VehicleManager";
import { TelemetryGauges } from "@/components/TelemetryGauges";
import { TruckPicker } from "@/components/TruckPicker";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Live Feed & CV Stream — Open-Cast Collision Avoidance" },
      { name: "description", content: "Live hardware camera from each vehicle with computer-vision overlay, thermal fusion, snapshots and recording." },
      { property: "og:title", content: "Live Feed & CV Stream — Collision Avoidance" },
      { property: "og:description", content: "Switch vehicles and camera hardware, with live CV overlays." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  return (
    <main className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-6">
      <TruckPicker />
      <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <LiveCamera />
        <TelemetryGauges />
      </div>
      <VehicleManager />
      </div>
    </main>
  );
}
