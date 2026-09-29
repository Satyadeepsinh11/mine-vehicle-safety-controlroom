import { useState } from "react";
import { Plug, Cpu } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";

export function SourcePanel() {
  const { source, setSource, backendUrl, setBackendUrl, connection } = useTelemetry();
  const [draft, setDraft] = useState(backendUrl);

  return (
    <section className="panel-glass p-4">
      <h2 className="font-display mb-3 text-xs tracking-[0.2em] uppercase">Data Source</h2>
      <div className="flex rounded-md border border-border p-0.5">
        <button
          onClick={() => setSource("simulator")}
          className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-[11px] tracking-widest uppercase ${source === "simulator" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
        >
          <Cpu className="size-3.5" /> Simulator
        </button>
        <button
          onClick={() => setSource("live")}
          className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-[11px] tracking-widest uppercase ${source === "live" ? "bg-accent/20 text-primary" : "text-muted-foreground"}`}
        >
          <Plug className="size-3.5" /> Live backend
        </button>
      </div>

      {source === "live" && (
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] tracking-widest text-muted-foreground uppercase">
            Python server URL
          </label>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="http://localhost:8000"
              className="min-w-0 flex-1 rounded-md border border-input bg-secondary/40 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
            />
            <button
              onClick={() => setBackendUrl(draft.trim())}
              className="rounded-md border border-primary/50 bg-primary/15 px-3 py-2 text-[11px] tracking-widest text-primary uppercase hover:bg-primary/25"
            >
              Connect
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {connection === "connected"
              ? "Receiving live telemetry from the vehicle node."
              : "Waiting for the server — the simulator stays available as fallback."}
          </p>
        </div>
      )}
    </section>
  );
}
