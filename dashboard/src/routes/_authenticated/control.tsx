import { createFileRoute } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Bell, Camera, Lightbulb, Power, RotateCcw, Siren, Terminal, Gauge, ShieldCheck, Video, Cpu, Radar, Flame, Ruler } from "lucide-react";
import { useTelemetry, type HardwareState } from "@/context/TelemetryContext";
import { Controls } from "@/components/Controls";
import { TruckPicker } from "@/components/TruckPicker";
import { formatTime, type DriveCommand } from "@/lib/collision";

export const Route = createFileRoute("/_authenticated/control")({
  head: () => ({
    meta: [
      { title: "Truck Control — Open-Cast Collision Avoidance" },
      { name: "description", content: "Step-by-step truck control: choose a truck, drive it, safety devices, lights and camera, sensors and maintenance." },
      { property: "og:title", content: "Truck Control — Collision Avoidance" },
      { property: "og:description", content: "Clear, sectioned control of each haul truck." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlPage,
});

function Section({ n, icon, title, desc, children }: { n: number; icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <section className="panel-glass p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-semibold text-primary-foreground">{n}</span>
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">{icon}{title}</h2>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, hint, icon, on, onChange }: { label: string; hint?: string; icon: ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm ${on ? "border-primary bg-accent" : "border-border bg-card"}`}>
      <span className="text-primary">{icon}</span>
      <span className="flex-1"><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
      <span className="text-xs text-muted-foreground">{on ? "On" : "Off"}</span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${on ? "bg-primary" : "bg-secondary"}`}>
        <span className={`block size-4 rounded-full bg-card shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}{unit}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
    </label>
  );
}

const KEYMAP: Record<string, DriveCommand> = { w: "FORWARD", s: "BACKWARD", a: "LEFT", d: "RIGHT", " ": "STOP", ArrowUp: "FORWARD", ArrowDown: "BACKWARD", ArrowLeft: "LEFT", ArrowRight: "RIGHT" };

function ControlPage() {
  const { hardware: hw, sendHardware, sendAction, sendCommand, commandLog, autoMode, activeVehicle, telemetry: t } = useTelemetry();
  const set = <K extends keyof HardwareState>(k: K) => (v: HardwareState[K]) => sendHardware(k, v);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const cmd = KEYMAP[e.key];
      if (cmd && (!autoMode || cmd === "STOP")) { e.preventDefault(); sendCommand(cmd); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoMode, sendCommand]);

  const btn = "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium";

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Control · {activeVehicle.name}</h2>
          <p className="text-sm text-muted-foreground">Follow the steps from top to bottom. Every command goes only to the selected truck.</p>
        </div>
        <span className="ml-auto rounded-full border border-border bg-card px-3 py-1 text-sm">
          {t.speed_kmh.toFixed(1)} km/h · <span className="capitalize">{t.cycle_state.toLowerCase()}</span>
        </span>
      </div>

      <Section n={1} icon={null} title="Choose truck" desc="Tap the truck you want to control.">
        <TruckPicker />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section n={2} icon={<Gauge className="size-4 text-primary" />} title="Drive" desc="Autonomous lets the truck run its haul cycle. Switch to Manual to drive with the pad or W A S D keys (Space = stop).">
          <Controls />
          <div className="mt-4"><Slider label="Speed limit" value={hw.speed_limit} min={0} max={100} unit="%" onChange={set("speed_limit")} /></div>
        </Section>

        <div className="space-y-4">
          <Section n={3} icon={<ShieldCheck className="size-4 text-primary" />} title="Safety devices" desc="Warn people nearby. The emergency stop is in the Drive panel.">
            <div className="space-y-2">
              <Toggle label="Proximity buzzer" hint="Beeps when something is inside 45 cm" icon={<Bell className="size-4" />} on={hw.buzzer_armed} onChange={set("buzzer_armed")} />
              <button onMouseDown={() => sendHardware("horn", true)} onMouseUp={() => sendHardware("horn", false)} onMouseLeave={() => hw.horn && sendHardware("horn", false)} className={`${btn} w-full border-status-warn bg-status-warn/10 text-foreground active:bg-status-warn/30`}>
                <Siren className="size-4" /> Press and hold for horn
              </button>
            </div>
          </Section>

          <Section n={4} icon={<Video className="size-4 text-primary" />} title="Lights & camera" desc="Headlights, camera light and where the camera points.">
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label="Headlights" icon={<Lightbulb className="size-4" />} on={hw.headlights} onChange={set("headlights")} />
              <Toggle label="Camera light" icon={<Camera className="size-4" />} on={hw.flash_led} onChange={set("flash_led")} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Slider label="Turn left / right" value={hw.pan} min={0} max={180} unit="°" onChange={set("pan")} />
              <Slider label="Tilt up / down" value={hw.tilt} min={0} max={180} unit="°" onChange={set("tilt")} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Picture size</span>
              {["QVGA", "VGA", "SVGA", "HD"].map((r) => (
                <button key={r} onClick={() => sendHardware("cam_resolution", r)} className={`rounded-full border px-3 py-1 text-xs ${hw.cam_resolution === r ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}>{r}</button>
              ))}
              <button onClick={() => { sendHardware("pan", 90); sendHardware("tilt", 90); }} className="ml-auto rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Centre camera</button>
            </div>
          </Section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section n={5} icon={<Cpu className="size-4 text-primary" />} title="Sensors & maintenance" desc="Turn individual sensors off only for testing or repair.">
          <div className="space-y-2">
            <Toggle label="Front distance sensor" hint="Needed for automatic braking" icon={<Ruler className="size-4" />} on={hw.ultrasonic_enabled} onChange={set("ultrasonic_enabled")} />
            <Toggle label="Person radar (mmWave)" icon={<Radar className="size-4" />} on={hw.mmwave_enabled} onChange={set("mmwave_enabled")} />
            <Toggle label="Heat camera" icon={<Flame className="size-4" />} on={hw.thermal_enabled} onChange={set("thermal_enabled")} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => sendAction("calibrate")} className={`${btn} border-border hover:border-primary hover:text-primary`}><RotateCcw className="size-4" /> Calibrate sensors</button>
            <button onClick={() => { if (confirm(`Restart the sensor board on ${activeVehicle.name}?`)) sendAction("reboot"); }} className={`${btn} border-destructive/50 text-destructive hover:bg-destructive/10`}><Power className="size-4" /> Restart board</button>
          </div>
        </Section>

        <Section n={6} icon={<Terminal className="size-4 text-primary" />} title="What was sent" desc="Every command, newest first.">
          <div className="max-h-[260px] space-y-1 overflow-auto text-sm">
            {commandLog.length === 0 && <p className="text-muted-foreground">No commands sent yet.</p>}
            {commandLog.map((c) => (
              <p key={c.id} className="flex gap-2 border-b border-border pb-1">
                <span className="text-muted-foreground">{formatTime(c.ts)}</span>
                <span className="font-medium text-primary">{c.vehicle}</span>
                <span>{c.action.toLowerCase().replace(/_/g, " ")}</span>
                <span className="ml-auto font-medium">{c.value}</span>
              </p>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
