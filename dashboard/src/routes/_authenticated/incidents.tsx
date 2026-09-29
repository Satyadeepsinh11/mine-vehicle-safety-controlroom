import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FilePlus2, Printer } from "lucide-react";
import { EventLogsTable } from "@/components/EventLogsTable";
import { useTelemetry } from "@/context/TelemetryContext";
import type { Severity } from "@/lib/collision";

export const Route = createFileRoute("/_authenticated/incidents")({
  head: () => ({
    meta: [
      { title: "Incident Reports — Open-Cast Collision Avoidance" },
      { name: "description", content: "Incident history with severity, acknowledgement, notes, manual reports, trends and CSV/JSON export." },
      { property: "og:title", content: "Incident Reports — Collision Avoidance" },
      { property: "og:description", content: "Searchable record of every braking, thermal, presence and warning event." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Incidents,
});

const TYPES = ["MANUAL_REPORT", "NEAR_MISS", "EQUIPMENT_FAULT", "PERSON_IN_ZONE", "ROAD_HAZARD"];

function Incidents() {
  const { incidents, reportIncident } = useTelemetry();
  const [type, setType] = useState(TYPES[0] ?? "MANUAL_REPORT");
  const [sev, setSev] = useState<Severity>("MEDIUM");
  const [note, setNote] = useState("");

  const by = (t: string) => incidents.filter((i) => i.event_type === t).length;
  const open = incidents.filter((i) => !i.acknowledged).length;
  const cards = [
    { label: "Emergency brakes", v: by("EMERGENCY_BRAKE"), tone: "text-status-crit" },
    { label: "Presence detections", v: by("PRESENCE_DETECTED"), tone: "text-status-crit" },
    { label: "Thermal alarms", v: by("THERMAL_HIGH"), tone: "text-status-warn" },
    { label: "Obstacle warnings", v: by("OBSTACLE_CLOSE"), tone: "text-status-warn" },
    { label: "Unacknowledged", v: open, tone: open ? "text-destructive" : "text-status-clear" },
    { label: "Total events", v: incidents.length, tone: "text-primary" },
  ];

  const buckets = useMemo(() => {
    const now = Date.now();
    const arr = Array.from({ length: 12 }, () => 0);
    incidents.forEach((i) => {
      const idx = 11 - Math.floor((now - i.timestamp) / (5 * 60_000));
      if (idx >= 0 && idx < 12) arr[idx] = (arr[idx] ?? 0) + 1;
    });
    return arr;
  }, [incidents]);
  const maxB = Math.max(1, ...buckets);

  const sevCount = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map((s) => ({ s, n: incidents.filter((i) => i.severity === s).length }));
  const total = Math.max(1, incidents.length);

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold tracking-[0.18em] uppercase">Incident Reports</h2>
          <p className="text-sm text-muted-foreground">Risk-zone, thermal, presence, battery and link events are logged automatically. Click a row to add notes.</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs tracking-widest uppercase hover:text-primary">
          <Printer className="size-3.5" /> Print shift report
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="panel-glass p-4">
            <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">{c.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${c.tone}`}>{c.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel-glass p-4">
          <p className="mb-3 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Events · last 60 min (5-min bins)</p>
          <div className="flex h-28 items-end gap-1">
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 rounded-t bg-primary/60" style={{ height: `${(b / maxB) * 100}%`, minHeight: 2 }} title={`${b} events`} />
            ))}
          </div>
        </section>
        <section className="panel-glass space-y-2 p-4">
          <p className="mb-1 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">By severity</p>
          {sevCount.map(({ s, n }) => (
            <div key={s} className="text-xs">
              <div className="flex justify-between"><span>{s}</span><span className="font-mono">{n}</span></div>
              <div className="h-1.5 rounded bg-secondary">
                <div className={`h-full rounded ${s === "CRITICAL" ? "bg-status-crit" : s === "HIGH" ? "bg-destructive" : s === "MEDIUM" ? "bg-status-warn" : "bg-status-clear"}`} style={{ width: `${(n / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>
        <section className="panel-glass space-y-2 p-4">
          <p className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-muted-foreground uppercase"><FilePlus2 className="size-3.5" /> File a manual report</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-border bg-secondary/40 px-2 py-1.5 text-xs">
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={sev} onChange={(e) => setSev(e.target.value as Severity)} className="rounded border border-border bg-secondary/40 px-2 py-1.5 text-xs">
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" className="min-h-[60px] w-full rounded border border-border bg-secondary/40 p-2 text-xs outline-none focus:border-primary" />
          <button
            disabled={!note.trim()}
            onClick={() => { reportIncident(type, note.trim(), sev); setNote(""); }}
            className="w-full rounded-md border border-primary bg-primary/20 py-2 text-xs tracking-widest text-primary uppercase disabled:opacity-40"
          >
            Submit report
          </button>
        </section>
      </div>

      <EventLogsTable full />
    </main>
  );
}
