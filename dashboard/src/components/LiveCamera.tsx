import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CircleDot,
  Download,
  Flame,
  Maximize,
  RefreshCw,
  ScanEye,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { riskMeta } from "@/lib/collision";
import { HUDStream } from "@/components/HUDStream";
import { DataScreen } from "@/components/DataScreen";
import { CameraOverlays } from "@/components/CameraOverlays";

const COLORS = { CLEAR: "#34d399", WARNING: "#fbbf24", CRITICAL: "#ef4444" } as const;

function captureUrl(streamUrl: string) {
  // ESP32-CAM: http://ip:81/stream -> http://ip/capture
  try {
    const u = new URL(streamUrl);
    if (u.port === "81") return `${u.protocol}//${u.hostname}/capture`;
  } catch {
    /* ignore */
  }
  return streamUrl;
}

export function LiveCamera() {
  const { activeVehicle, backendUrl, telemetry } = useTelemetry();
  const cam = activeVehicle.camera;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const telRef = useRef(telemetry);
  telRef.current = telemetry;
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const [cv, setCv] = useState(true);
  const [thermal, setThermal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [recording, setRecording] = useState(false);
  const [fps, setFps] = useState(0);
  const [motion, setMotion] = useState(0);
  const cvRef = useRef({ cv, thermal });
  cvRef.current = { cv, thermal };

  const streamSrc =
    cam.kind === "backend_cv"
      ? `${backendUrl.replace(/\/$/, "")}/api/video_feed`
      : cam.kind === "esp32" || cam.kind === "ip_mjpeg"
        ? cam.url
        : "";
  const isFile = cam.kind === "recorded" || /\.(mp4|webm|ogv|m3u8|mov)(\?|$)/i.test(streamSrc);
  const videoSrc = cam.kind === "recorded" ? "" : isFile ? streamSrc : "";
  const mixed =
    typeof window !== "undefined" && window.location.protocol === "https:" && streamSrc.startsWith("http:");

  // USB / laptop webcam
  useEffect(() => {
    if (cam.kind !== "usb") return;
    let stream: MediaStream | null = null;
    setErr(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: cam.deviceId ? { deviceId: { exact: cam.deviceId } } : true })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e: Error) => setErr(`Camera blocked or not found: ${e.message}`));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [cam.kind, cam.deviceId, nonce]);

  // Overlay + CV loop (motion detection by frame differencing on USB feeds)
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const small = document.createElement("canvas");
    small.width = 64;
    small.height = 36;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    let prev: Uint8ClampedArray | null = null;
    let raf = 0;
    let frames = 0;
    let last = performance.now();

    const draw = () => {
      const { width: w, height: h } = canvas;
      const t = telRef.current;
      const color = COLORS[t.risk_level];
      ctx.clearRect(0, 0, w, h);
      frames++;
      const now = performance.now();
      if (now - last > 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }

      if (cvRef.current.thermal) {
        const cw = w / 8, ch = h / 8;
        t.thermal_grid.forEach((v, i) => {
          const n = Math.min(1, Math.max(0, (v - 20) / 50));
          ctx.fillStyle = `hsla(${240 - n * 240}, 90%, 50%, 0.28)`;
          ctx.fillRect((i % 8) * cw, Math.floor(i / 8) * ch, cw, ch);
        });
      }

      if (cvRef.current.cv) {
        // motion detection
        const src = videoRef.current;
        if (sctx && src && src.readyState >= 2) {
          sctx.drawImage(src, 0, 0, 64, 36);
          const cur = sctx.getImageData(0, 0, 64, 36).data;
          if (prev) {
            let minX = 64, minY = 36, maxX = -1, maxY = -1, count = 0;
            for (let i = 0; i < cur.length; i += 4) {
              const d = Math.abs((cur[i] ?? 0) - (prev[i] ?? 0)) + Math.abs((cur[i + 1] ?? 0) - (prev[i + 1] ?? 0));
              if (d > 60) {
                const p = i / 4, x = p % 64, y = Math.floor(p / 64);
                count++;
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
              }
            }
            setMotion(Math.round((count / (64 * 36)) * 100));
            if (count > 20) {
              const sx = w / 64, sy = h / 36;
              ctx.strokeStyle = "#38bdf8";
              ctx.lineWidth = 2;
              ctx.strokeRect(minX * sx, minY * sy, (maxX - minX + 1) * sx, (maxY - minY + 1) * sy);
              ctx.fillStyle = "#38bdf8";
              ctx.font = "600 13px monospace";
              ctx.fillText("MOTION", minX * sx + 4, minY * sy - 6);
            }
          }
          prev = new Uint8ClampedArray(cur);
        }

        // crosshair + range reticle
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 30, h / 2); ctx.lineTo(w / 2 + 30, h / 2);
        ctx.moveTo(w / 2, h / 2 - 30); ctx.lineTo(w / 2, h / 2 + 30);
        ctx.stroke();
        const norm = Math.min(1, Math.max(0, (260 - t.distance_cm) / 260));
        const bw = 80 + norm * 300, bh = 60 + norm * 200;
        ctx.strokeRect(w / 2 - bw / 2, h / 2 - bh / 2, bw, bh);
        ctx.fillStyle = color;
        ctx.font = "600 14px monospace";
        ctx.fillText(`${t.distance_cm.toFixed(1)} cm`, w / 2 - bw / 2 + 4, h / 2 - bh / 2 - 6);

        // top banner
        ctx.fillStyle = `${color}40`;
        ctx.fillRect(0, 0, w, 32);
        ctx.fillStyle = color;
        ctx.font = "700 14px monospace";
        ctx.fillText(riskMeta[t.risk_level].label, 12, 21);
        ctx.fillStyle = "rgba(226,232,240,0.9)";
        ctx.font = "500 12px monospace";
        ctx.fillText(
          `SPD ${t.speed_pct}%  BAT ${t.battery_pct}%  THM ${t.thermal_c}°C  ${t.mmwave_presence ? "PRESENCE!" : ""}`,
          w - 420,
          21,
        );
        ctx.fillText(new Date().toLocaleTimeString("en-GB"), 12, h - 12);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const snapshot = useCallback(() => {
    const out = document.createElement("canvas");
    out.width = 1280;
    out.height = 720;
    const c = out.getContext("2d");
    if (!c) return;
    try {
      const src = cam.kind === "usb" || videoSrc ? videoRef.current : imgRef.current;
      if (src) c.drawImage(src, 0, 0, 1280, 720);
      if (overlayRef.current) c.drawImage(overlayRef.current, 0, 0, 1280, 720);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/jpeg", 0.92);
      a.download = `${activeVehicle.id}_snapshot_${Date.now()}.jpg`;
      a.click();
    } catch {
      // Cross-origin stream: open the camera's own capture endpoint instead
      window.open(captureUrl(streamSrc), "_blank");
    }
  }, [cam.kind, activeVehicle.id, streamSrc, videoSrc]);

  const toggleRecord = () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const s = videoRef.current?.srcObject as MediaStream | null;
    if (!s) return;
    const rec = new MediaRecorder(s);
    chunks.current = [];
    rec.ondataavailable = (e) => chunks.current.push(e.data);
    rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks.current, { type: "video/webm" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeVehicle.id}_rec_${Date.now()}.webm`;
      a.click();
      setRecording(false);
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  };

  const tool = "flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] tracking-widest uppercase transition-colors";
  const on = "border-primary/60 bg-primary/15 text-primary";
  const off = "border-border text-muted-foreground hover:text-foreground";

  if (cam.kind === "simulated") {
    return (
      <div className="space-y-2">
        <HUDStream />
        <p className="text-[11px] text-muted-foreground">
          This vehicle uses the simulated camera. Open <b>Camera setup</b> and pick ESP32-CAM, IP camera or USB webcam to show your hardware.
        </p>
      </div>
    );
  }

  return (
    <section className="panel-glass overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <Camera className="size-4 text-primary" />
        <h2 className="font-display text-xs tracking-[0.2em] uppercase">
          {activeVehicle.name} · {cam.kind === "recorded" ? "data screen" : cam.kind.replace("_", " ")}
        </h2>
        <span className="flex items-center gap-1 text-[10px] text-status-clear">
          <CircleDot className="size-3 animate-pulse" /> LIVE
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button onClick={() => setCv(!cv)} className={`${tool} ${cv ? on : off}`}><ScanEye className="size-3" /> CV overlay</button>
          <button onClick={snapshot} className={`${tool} ${off}`}><Download className="size-3" /> Snapshot</button>
          {cam.kind === "usb" && (
            <button onClick={toggleRecord} className={`${tool} ${recording ? "border-destructive text-destructive" : off}`}>
              {recording ? <Square className="size-3" /> : <CircleDot className="size-3" />} {recording ? "Stop" : "Record"}
            </button>
          )}
          <button onClick={() => { setErr(null); setNonce((n) => n + 1); }} className={`${tool} ${off}`}><RefreshCw className="size-3" /> Reconnect</button>
          <button onClick={() => void wrapRef.current?.requestFullscreen()} className={`${tool} ${off}`}><Maximize className="size-3" /></button>
        </div>
      </div>

      <div ref={wrapRef} className="relative aspect-video w-full bg-background">
        {cam.kind === "recorded" ? (
          <DataScreen />
        ) : videoSrc ? (
          <video
            key={`${videoSrc}-${nonce}`}
            ref={videoRef}
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
            onError={() => setErr("Could not play this video source")}
            onPlaying={() => setErr(null)}
            className="size-full object-cover"
            style={{ transform: `${cam.mirror ? "scaleX(-1)" : ""} ${cam.flip ? "scaleY(-1)" : ""}` }}
          />
        ) : cam.kind === "usb" ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="size-full object-cover"
            style={{ transform: `${cam.mirror ? "scaleX(-1)" : ""} ${cam.flip ? "scaleY(-1)" : ""}` }}
          />
        ) : (
          <img
            key={`${streamSrc}-${nonce}`}
            ref={imgRef}
            src={`${streamSrc}${streamSrc.includes("?") ? "&" : "?"}_=${nonce}`}
            alt={`Live camera from ${activeVehicle.name}`}
            onError={() => setErr("No signal from camera stream")}
            onLoad={() => setErr(null)}
            className="size-full object-cover"
            style={{ transform: `${cam.mirror ? "scaleX(-1)" : ""} ${cam.flip ? "scaleY(-1)" : ""}` }}
          />
        )}
        {cam.kind !== "recorded" && <canvas ref={overlayRef} width={1280} height={720} className="pointer-events-none absolute inset-0 size-full" />}
        {cam.kind !== "recorded" && <CameraOverlays />}
        {telemetry.emergency_brake && (
          <div className="glow-crit pointer-events-none absolute inset-0 animate-pulse border-4 border-destructive" />
        )}
        {(err || mixed) && (
          <div className="absolute inset-0 grid place-items-center bg-background/85 p-6 text-center">
            <div className="max-w-md space-y-2">
              <TriangleAlert className="mx-auto size-8 text-status-warn" />
              <p className="font-display text-sm tracking-widest uppercase">{err ?? "Browser is blocking this stream"}</p>
              <p className="text-xs text-muted-foreground">
                {mixed
                  ? "This dashboard is on a secure (https) address and your camera streams over plain http, so the browser blocks it. Run the dashboard on your local network, or put the camera behind an https tunnel."
                  : `Check that ${streamSrc || "the camera"} is powered, on the same Wi-Fi as this computer, and the URL is correct.`}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
        <span className="truncate">SRC {cam.kind === "recorded" ? "live data screen" : streamSrc || "local webcam"}</span>
        <span>RES {cam.resolution}</span>
        <span>Q {cam.quality}</span>
        <span>OVERLAY {fps} FPS</span>
        {(cam.kind === "usb" || videoSrc) && <span>MOTION {motion}%</span>}
      </div>
    </section>
  );
}
