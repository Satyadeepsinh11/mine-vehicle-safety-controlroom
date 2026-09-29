import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, Camera, Cpu, Gauge, Octagon, Radio, ShieldAlert, Server, FileText } from "lucide-react";
import { CRITICAL_CM, WARNING_CM } from "@/lib/collision";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Open-Cast Mine Collision Avoidance System" },
      { name: "description", content: "Ultrasonic + camera collision avoidance for open-cast haul vehicles, with automatic emergency braking and a live control dashboard." },
      { property: "og:title", content: "Open-Cast Mine Collision Avoidance System" },
      { property: "og:description", content: "Automatic braking, live HUD video and incident logging for mine haul vehicles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Octagon, t: "Automatic emergency braking", d: `Vehicle stops on its own when an obstacle is within ${CRITICAL_CM} cm — no operator reaction needed.` },
  { icon: Camera, t: "Live HUD video", d: "Camera feed with distance, risk zone and braking status drawn on top in real time." },
  { icon: Gauge, t: "Proximity telemetry", d: "Distance, speed and link latency updated several times per second." },
  { icon: FileText, t: "Incident logging", d: "Every brake and warning is recorded with time and distance, exportable to CSV." },
  { icon: BarChart3, t: "Analytics", d: "Trends of closest approaches and time spent in each risk zone." },
  { icon: Radio, t: "Manual & autonomous modes", d: "Drive remotely from the pad, or let the vehicle patrol with safety locks active." },
];

const flow = [
  { icon: Cpu, t: "Vehicle node", d: "ESP32-CAM reads the ultrasonic sensor and streams video." },
  { icon: Server, t: "Control server", d: "Python server scores risk, draws the HUD and stores incidents." },
  { icon: Activity, t: "Dashboard", d: "Operators watch, drive and review from any browser." },
];

function Landing() {
  return (
    <div className="grid-backdrop min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 md:px-6">
        <div className="flex size-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
          <ShieldAlert className="size-5 text-primary" />
        </div>
        <span className="font-display text-sm font-bold tracking-[0.18em] uppercase">OCMS</span>
        <Link to="/login" className="ml-auto rounded-md border border-primary/60 bg-primary/20 px-4 py-2 font-display text-xs font-bold tracking-[0.2em] text-primary uppercase hover:bg-primary/30">
          Operator Login
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:px-6">
        <p className="mb-4 text-xs tracking-[0.35em] text-primary uppercase">Open-cast mine safety</p>
        <h1 className="max-w-3xl font-display text-3xl leading-tight font-bold tracking-wide uppercase md:text-5xl">
          Stop haul vehicle collisions <span className="text-primary">before they happen.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          A sensor-equipped vehicle node, a control server and a live dashboard working together to detect obstacles, brake automatically and keep a full safety record.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" className="rounded-md border border-primary/60 bg-primary/20 px-6 py-3 font-display text-xs font-bold tracking-[0.25em] text-primary uppercase hover:bg-primary/30">
            Open control dashboard
          </Link>
          <a href="#zones" className="rounded-md border border-border bg-secondary/40 px-6 py-3 font-display text-xs font-bold tracking-[0.25em] uppercase hover:bg-secondary/70">
            How braking works
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="panel-glass p-6">
            <f.icon className="mb-3 size-6 text-primary" />
            <h3 className="font-display text-sm font-bold tracking-widest uppercase">{f.t}</h3>
            <p className="mt-2 text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>

      <section id="zones" className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <h2 className="mb-6 font-display text-xl font-bold tracking-[0.18em] uppercase">Three risk zones</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel-glass border-status-clear/50 p-6">
            <p className="font-display text-2xl font-bold text-status-clear">&gt; {WARNING_CM} cm</p>
            <p className="mt-1 tracking-widest uppercase">Clear</p>
            <p className="mt-2 text-sm text-muted-foreground">Normal driving. Full speed allowed.</p>
          </div>
          <div className="panel-glass border-status-warn/50 p-6">
            <p className="font-display text-2xl font-bold text-status-warn">{CRITICAL_CM}–{WARNING_CM} cm</p>
            <p className="mt-1 tracking-widest uppercase">Warning</p>
            <p className="mt-2 text-sm text-muted-foreground">Operator alerted, amber banner, speed reduced.</p>
          </div>
          <div className="panel-glass glow-crit border-status-crit/60 p-6">
            <p className="font-display text-2xl font-bold text-status-crit">≤ {CRITICAL_CM} cm</p>
            <p className="mt-1 tracking-widest uppercase">Critical</p>
            <p className="mt-2 text-sm text-muted-foreground">Automatic stop, flashing red banner, incident saved.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
        <h2 className="mb-6 font-display text-xl font-bold tracking-[0.18em] uppercase">How it fits together</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {flow.map((s, i) => (
            <div key={s.t} className="panel-glass p-6">
              <p className="font-mono text-xs text-primary">STEP 0{i + 1}</p>
              <s.icon className="my-3 size-6 text-primary" />
              <h3 className="font-display text-sm font-bold tracking-widest uppercase">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs tracking-widest text-muted-foreground uppercase">
        Open-Cast Collision Avoidance · Control System
      </footer>
    </div>
  );
}
