import { Fragment, useMemo, useState } from "react";
import { Check, Download, ListFilter, Search, StickyNote, Trash2, X } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { formatTime, incidentsToCsv, type Severity } from "@/lib/collision";

const SEVS: ("ALL" | Severity)[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const sevTone: Record<Severity, string> = {
  CRITICAL: "text-status-crit border-status-crit/50 bg-status-crit/10",
  HIGH: "text-destructive border-destructive/40 bg-destructive/5",
  MEDIUM: "text-status-warn border-status-warn/50 bg-status-warn/10",
  LOW: "text-status-clear border-status-clear/40 bg-status-clear/10",
};

export function EventLogsTable({ full = false }: { full?: boolean }) {
  const { incidents, clearIncidents, acknowledgeIncident, annotateIncident, deleteIncident, vehicles } = useTelemetry();
  const [type, setType] = useState("ALL");
  const [sev, setSev] = useState<(typeof SEVS)[number]>("ALL");
  const [veh, setVeh] = useState("ALL");
  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const types = useMemo(() => ["ALL", ...Array.from(new Set(incidents.map((i) => i.event_type)))], [incidents]);

  const rows = useMemo(
    () =>
      incidents.filter(
        (i) =>
          (type === "ALL" || i.event_type === type) &&
          (sev === "ALL" || i.severity === sev) &&
          (veh === "ALL" || i.vehicle_id === veh) &&
          (!openOnly || !i.acknowledged) &&
          (!q || `${i.event_type} ${i.action_taken} ${i.note}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [incidents, type, sev, veh, openOnly, q],
  );

  const exportFile = (kind: "csv" | "json") => {
    const blob = kind === "csv"
      ? new Blob([incidentsToCsv(rows)], { type: "text/csv" })
      : new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident_log_${Date.now()}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sel = "rounded border border-border bg-secondary/40 px-2 py-1 text-[10px] tracking-widest uppercase outline-none";
  const btn = "flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[10px] tracking-widest uppercase";

  return (
    <section className="panel-glass flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <ListFilter className="size-4 text-primary" />
        <h2 className="font-display text-xs tracking-[0.2em] uppercase">Incident Log ({rows.length})</h2>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {full && (
            <>
              <span className="flex items-center gap-1 rounded border border-border px-2 py-1">
                <Search className="size-3 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-24 bg-transparent text-[11px] outline-none" />
              </span>
              <select className={sel} value={sev} onChange={(e) => setSev(e.target.value as typeof sev)}>
                {SEVS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className={sel} value={veh} onChange={(e) => setVeh(e.target.value)}>
                <option>ALL</option>
                {vehicles.map((v) => <option key={v.id}>{v.id}</option>)}
              </select>
              <button onClick={() => setOpenOnly(!openOnly)} className={`${btn} ${openOnly ? "border-primary/60 text-primary" : ""}`}>Unacknowledged</button>
            </>
          )}
          <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={() => exportFile("csv")} className={`${btn} hover:text-primary`}><Download className="size-3" /> CSV</button>
          {full && <button onClick={() => exportFile("json")} className={`${btn} hover:text-primary`}><Download className="size-3" /> JSON</button>}
          <button onClick={() => { if (confirm("Clear all incidents?")) clearIncidents(); }} className={`${btn} hover:text-destructive`}><Trash2 className="size-3" /> Clear</button>
        </div>
      </div>

      <div className={`${full ? "max-h-[560px]" : "max-h-[320px]"} overflow-auto`}>
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card/95 text-[10px] tracking-[0.18em] text-muted-foreground uppercase backdrop-blur">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Range</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No events recorded</td></tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={`cursor-pointer border-t border-border/60 hover:bg-secondary/40 ${r.acknowledged ? "opacity-60" : ""}`} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td className="px-3 py-2 text-muted-foreground">{formatTime(r.timestamp)}</td>
                  <td className="px-3 py-2">{r.vehicle_id}</td>
                  <td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[9px] ${sevTone[r.severity]}`}>{r.severity}</span></td>
                  <td className="px-3 py-2 font-semibold">{r.event_type}{r.note && <StickyNote className="ml-1 inline size-3 text-primary" />}</td>
                  <td className="px-3 py-2">{r.distance_at_brake.toFixed(1)} cm</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.action_taken}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); acknowledgeIncident(r.id, !r.acknowledged); }}
                      className={`rounded border px-1.5 py-0.5 text-[9px] tracking-widest uppercase ${r.acknowledged ? "border-status-clear/50 text-status-clear" : "border-status-warn/50 text-status-warn"}`}
                    >
                      {r.acknowledged ? <><Check className="inline size-3" /> ACK</> : "OPEN"}
                    </button>
                  </td>
                </tr>
                {open === r.id && (
                  <tr className="bg-secondary/30">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <textarea
                          defaultValue={r.note}
                          onBlur={(e) => annotateIncident(r.id, e.target.value)}
                          placeholder="Add operator notes / root cause…"
                          className="min-h-[60px] flex-1 rounded border border-border bg-background/60 p-2 font-sans text-xs outline-none focus:border-primary"
                        />
                        <div className="space-y-1 text-[11px] text-muted-foreground">
                          <p>{new Date(r.timestamp).toLocaleString("en-GB")}</p>
                          <p>ID {r.id}</p>
                          <button onClick={() => deleteIncident(r.id)} className="flex items-center gap-1 text-destructive"><X className="size-3" /> Delete</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
