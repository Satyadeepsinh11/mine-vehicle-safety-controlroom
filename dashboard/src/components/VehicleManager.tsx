import { useEffect, useState } from "react";
import { Plus, Save, Settings2, Trash2, Truck } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import type { CameraKind, Vehicle } from "@/lib/collision";

const KINDS: { v: CameraKind; l: string; hint: string }[] = [
  { v: "recorded", l: "Data screen (no camera)", hint: "Shows the truck's live readings in place of video" },
  { v: "esp32", l: "ESP32-CAM", hint: "Board stream, usually http://<ip>:81/stream" },
  { v: "ip_mjpeg", l: "IP / MJPEG camera", hint: "MJPEG/snapshot URL or a video link (.mp4, .webm)" },
  { v: "usb", l: "USB / laptop webcam", hint: "Camera plugged into this computer" },
  { v: "backend_cv", l: "Server CV stream", hint: "Processed feed from your Python server" },
  { v: "simulated", l: "Simulated", hint: "No hardware needed" },
];

const input = "w-full rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-sm outline-none focus:border-primary";

export function VehicleManager() {
  const { vehicles, activeVehicle, selectVehicle, saveVehicle, removeVehicle } = useTelemetry();
  const [draft, setDraft] = useState<Vehicle>(activeVehicle);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(activeVehicle), [activeVehicle]);

  useEffect(() => {
    if (draft.camera.kind !== "usb") return;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((s) => {
        s.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((d) => setDevices(d.filter((x) => x.kind === "videoinput")))
      .catch(() => setDevices([]));
  }, [draft.camera.kind]);

  const setCam = (patch: Partial<Vehicle["camera"]>) => setDraft((d) => ({ ...d, camera: { ...d.camera, ...patch } }));

  const addNew = () => {
    const id = `NODE-${String(vehicles.length + 1).padStart(2, "0")}`;
    const v: Vehicle = { ...activeVehicle, id, name: `New Vehicle ${vehicles.length + 1}`, ip: "192.168.1.", camera: { ...activeVehicle.camera, kind: "esp32", url: "http://192.168.1.x:81/stream" } };
    saveVehicle(v);
    selectVehicle(id);
  };

  const save = () => {
    saveVehicle(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <section className="panel-glass p-4">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="size-4 text-primary" />
        <h2 className="font-display text-xs tracking-[0.2em] uppercase">Vehicle & camera setup</h2>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {vehicles.map((v) => (
          <button
            key={v.id}
            onClick={() => selectVehicle(v.id)}
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] tracking-widest uppercase ${v.id === activeVehicle.id ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
          >
            <Truck className="size-3" /> {v.id}
          </button>
        ))}
        <button onClick={addNew} className="flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-[11px] tracking-widest text-muted-foreground uppercase hover:text-primary">
          <Plus className="size-3" /> Add
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1"><span className="text-muted-foreground">Name</span>
          <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="space-y-1"><span className="text-muted-foreground">Type</span>
          <select className={input} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Vehicle["kind"] })}>
            {["Car model", "Haul truck", "Dozer", "Loader", "Rover"].map((k) => <option key={k}>{k}</option>)}
          </select></label>
        <label className="col-span-2 space-y-1"><span className="text-muted-foreground">Board IP address</span>
          <input className={input} value={draft.ip} onChange={(e) => setDraft({ ...draft, ip: e.target.value, camera: draft.camera.kind === "esp32" ? { ...draft.camera, url: `http://${e.target.value}:81/stream` } : draft.camera })} /></label>
      </div>

      <p className="mt-4 mb-2 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Camera source</p>
      <div className="grid gap-1.5">
        {KINDS.map((k) => (
          <label key={k.v} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs ${draft.camera.kind === k.v ? "border-primary/60 bg-primary/10" : "border-border"}`}>
            <input type="radio" className="mt-0.5 accent-[var(--color-primary)]" checked={draft.camera.kind === k.v} onChange={() => setCam({ kind: k.v })} />
            <span><b>{k.l}</b><br /><span className="text-muted-foreground">{k.hint}</span></span>
          </label>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {(draft.camera.kind === "esp32" || draft.camera.kind === "ip_mjpeg") && (
          <label className="col-span-2 space-y-1"><span className="text-muted-foreground">Stream or video URL (MJPEG, .mp4, .webm)</span>
            <input className={`${input} font-mono`} value={draft.camera.url} onChange={(e) => setCam({ url: e.target.value })} /></label>
        )}
        {draft.camera.kind === "usb" && (
          <label className="col-span-2 space-y-1"><span className="text-muted-foreground">Webcam</span>
            <select className={input} value={draft.camera.deviceId} onChange={(e) => setCam({ deviceId: e.target.value })}>
              <option value="">Default camera</option>
              {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </select></label>
        )}
        <label className="space-y-1"><span className="text-muted-foreground">Resolution</span>
          <select className={input} value={draft.camera.resolution} onChange={(e) => setCam({ resolution: e.target.value as Vehicle["camera"]["resolution"] })}>
            {["QVGA", "VGA", "SVGA", "HD"].map((r) => <option key={r}>{r}</option>)}
          </select></label>
        <label className="space-y-1"><span className="text-muted-foreground">JPEG quality ({draft.camera.quality})</span>
          <input type="range" min={10} max={63} value={draft.camera.quality} onChange={(e) => setCam({ quality: Number(e.target.value) })} className="w-full accent-[var(--color-primary)]" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.camera.flip} onChange={(e) => setCam({ flip: e.target.checked })} /> Flip vertical</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.camera.mirror} onChange={(e) => setCam({ mirror: e.target.checked })} /> Mirror</label>
      </div>

      <p className="mt-4 mb-2 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Fitted sensors</p>
      <div className="grid grid-cols-2 gap-1 text-xs">
        {(Object.keys(draft.sensors) as (keyof Vehicle["sensors"])[]).map((s) => (
          <label key={s} className="flex items-center gap-2 capitalize">
            <input type="checkbox" checked={draft.sensors[s]} onChange={(e) => setDraft({ ...draft, sensors: { ...draft.sensors, [s]: e.target.checked } })} /> {s}
          </label>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={save} className="flex flex-1 items-center justify-center gap-2 rounded-md border border-primary bg-primary/20 py-2 text-xs tracking-widest text-primary uppercase hover:bg-primary/30">
          <Save className="size-3.5" /> {saved ? "Saved" : "Save & apply"}
        </button>
        <button onClick={() => removeVehicle(draft.id)} aria-label="Remove vehicle" className="rounded-md border border-destructive/50 px-3 text-destructive hover:bg-destructive/15">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </section>
  );
}
