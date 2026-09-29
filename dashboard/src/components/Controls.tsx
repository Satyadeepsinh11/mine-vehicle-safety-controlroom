import {
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
  ArrowBigUp,
  OctagonX,
  Cpu,
  Hand,
} from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import type { DriveCommand } from "@/lib/collision";

export function Controls() {
  const { sendCommand, lastCommand, autoMode, setAutoMode, telemetry } = useTelemetry();
  const locked = autoMode || telemetry.risk_level === "CRITICAL";

  const Btn = ({ cmd, icon }: { cmd: DriveCommand; icon: React.ReactNode }) => (
    <button
      disabled={locked}
      onClick={() => sendCommand(cmd)}
      aria-label={cmd}
      className={`flex aspect-square items-center justify-center rounded-md border transition-all ${
        lastCommand === cmd && !locked
          ? "glow-cyan border-primary bg-primary/20 text-primary"
          : "border-border bg-secondary/50 text-foreground hover:border-primary/60 hover:bg-primary/10"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {icon}
    </button>
  );

  return (
    <section className="panel-glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xs tracking-[0.2em] uppercase">Drive Control</h2>
        <div className="flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setAutoMode(true)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] tracking-widest uppercase ${autoMode ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
          >
            <Cpu className="size-3.5" /> Auto
          </button>
          <button
            onClick={() => setAutoMode(false)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] tracking-widest uppercase ${!autoMode ? "bg-accent/20 text-primary" : "text-muted-foreground"}`}
          >
            <Hand className="size-3.5" /> Manual
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[220px] grid-cols-3 gap-2">
        <div />
        <Btn cmd="FORWARD" icon={<ArrowBigUp className="size-6" />} />
        <div />
        <Btn cmd="LEFT" icon={<ArrowBigLeft className="size-6" />} />
        <Btn cmd="STOP" icon={<span className="font-mono text-xs tracking-widest">HOLD</span>} />
        <Btn cmd="RIGHT" icon={<ArrowBigRight className="size-6" />} />
        <div />
        <Btn cmd="BACKWARD" icon={<ArrowBigDown className="size-6" />} />
        <div />
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {autoMode
          ? "Autonomous mode — manual pad disabled"
          : telemetry.risk_level === "CRITICAL"
            ? "Drive locked out by collision interlock"
            : `Last command: ${lastCommand}`}
      </p>

      <button
        onClick={() => sendCommand("STOP")}
        className="glow-crit mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-destructive bg-destructive/20 py-4 font-display text-sm font-bold tracking-[0.25em] text-destructive uppercase transition-colors hover:bg-destructive/35"
      >
        <OctagonX className="size-5" /> Emergency Stop
      </button>
    </section>
  );
}
