import { useEffect, useRef } from "react";
import { Camera, CircleAlert } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { CRITICAL_CM, WARNING_CM, riskMeta } from "@/lib/collision";
import { DataScreen } from "@/components/DataScreen";

const COLORS = {
  CLEAR: "#34d399",
  WARNING: "#fbbf24",
  CRITICAL: "#ef4444",
} as const;

export function HUDStream() {
  const { telemetry, source, backendUrl, connection, activeVehicle } = useTelemetry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(telemetry);
  stateRef.current = telemetry;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;

    const draw = () => {
      const { width: w, height: h } = canvas;
      const tel = stateRef.current;
      const color = COLORS[tel.risk_level];
      t += 1;

      ctx.clearRect(0, 0, w, h);
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // range rings
      const cx = w / 2;
      const cy = h * 0.92;
      [WARNING_CM * 2.4, CRITICAL_CM * 2.4].forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.6, Math.PI, 2 * Math.PI);
        ctx.strokeStyle = i === 0 ? "rgba(251,191,36,0.45)" : "rgba(239,68,68,0.5)";
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // obstacle marker scaled by distance
      const norm = Math.min(1, Math.max(0, (260 - tel.distance_cm) / 260));
      const boxW = 60 + norm * 220;
      const boxH = 40 + norm * 150;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - boxW / 2, cy - boxH - 90 * (1 - norm) - 60, boxW, boxH);
      ctx.fillStyle = color;
      ctx.font = "600 12px monospace";
      ctx.fillText(
        `OBSTACLE  ${tel.distance_cm.toFixed(1)} cm`,
        cx - boxW / 2,
        cy - boxH - 90 * (1 - norm) - 68,
      );

      // scan sweep
      const sweepY = (t * 2) % h;
      ctx.fillStyle = "rgba(56,189,248,0.07)";
      ctx.fillRect(0, sweepY, w, 30);

      // corner ticks
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.lineWidth = 2;
      const c = 22;
      const corners: Array<[number, number, number, number]> = [
        [10, 10, 1, 1],
        [w - 10, 10, -1, 1],
        [10, h - 10, 1, -1],
        [w - 10, h - 10, -1, -1],
      ];
      corners.forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + sx * c, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * c);
        ctx.stroke();
      });


      // banner
      const label = riskMeta[tel.risk_level].label;
      const flash = tel.risk_level === "CRITICAL" && Math.floor(t / 15) % 2 === 0;
      ctx.fillStyle = flash ? color : `${color}33`;
      ctx.fillRect(0, 0, w, 34);
      ctx.fillStyle = flash ? "#0b1220" : color;
      ctx.font = "700 14px monospace";
      ctx.fillText(label, 16, 23);
      ctx.fillStyle = "rgba(226,232,240,0.85)";
      ctx.font = "500 12px monospace";
      ctx.fillText(`SPD ${tel.speed_pct}%`, w - 90, 22);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const showLive = source === "live" && connection === "connected";

  return (
    <section className="panel-glass overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Camera className="size-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">{activeVehicle.name} · live camera</h2>
        </div>
        <span
          className={`rounded border px-2 py-0.5 text-[11px] tracking-widest uppercase ${riskMeta[telemetry.risk_level].bg} ${riskMeta[telemetry.risk_level].text} ${telemetry.risk_level === "CRITICAL" ? "animate-pulse" : ""}`}
        >
          {telemetry.risk_level}
        </span>
      </div>
      <div className="relative aspect-video w-full bg-[#0b1220]">
        {showLive ? (
          <img
            src={`${backendUrl.replace(/\/$/, "")}/api/video_feed`}
            alt="Live vehicle camera stream with HUD overlays"
            className="size-full object-cover"
          />
        ) : (
          <DataScreen />
        )}
        {telemetry.emergency_brake && (
          <div className="glow-crit pointer-events-none absolute inset-0 animate-pulse border-4 border-destructive" />
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <CircleAlert className="size-3.5" />
        Brake threshold {CRITICAL_CM} cm · warning {WARNING_CM} cm · live data screen
      </div>
    </section>
  );
}
