import {
  LogOut,
  Radio,
  ShieldAlert,
  Activity,
  Gauge,
  Camera,
  Cpu,
  Joystick,
  Map,
  AlertTriangle,
  BarChart3,
  Settings,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { useTelemetry } from "@/context/TelemetryContext";

const NAV = [
  ["/dashboard", "Live", Gauge],
  ["/feed", "Camera", Camera],
  ["/sensors", "Sensors", Cpu],
  ["/control", "Control", Joystick],
  ["/map", "Map", Map],
  ["/incidents", "Incidents", AlertTriangle],
  ["/analytics", "Analytics", BarChart3],
  ["/system", "System", Settings],
] as const;

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldAlert className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-base font-semibold text-foreground">OpenCast</p>
          <p className="text-xs text-muted-foreground">Collision Avoidance</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 text-sm">
        {NAV.map(([to, label, Icon]) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground" }}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function Header({ onLogout }: { onLogout: () => void }) {
  const { session } = useAuth();
  const { connection, telemetry, autoMode, source, activeVehicle } = useTelemetry();

  const connColor =
    connection === "connected"
      ? "bg-status-clear"
      : connection === "connecting"
        ? "bg-status-warn"
        : "bg-status-crit";

  const chip = "flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">{activeVehicle.name}</h1>
          <p className="text-xs text-muted-foreground">Control centre</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className={chip}>
            <span className={`size-2 rounded-full ${connColor}`} />
            <span className="capitalize">
              {connection} · {source}
            </span>
          </span>
          <span className={chip}>
            <Activity className="size-3.5 text-primary" />
            <span>{telemetry.latency_ms} ms</span>
          </span>
          <span className={chip}>
            <Radio className="size-3.5 text-primary" />
            <span>{autoMode ? "Autonomous" : "Manual"}</span>
          </span>
          <span className="hidden text-muted-foreground sm:inline">{session?.username}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-3.5" /> Logout
          </button>
        </div>
      </div>
      <nav className="mt-3 flex gap-1 overflow-x-auto text-xs font-medium lg:hidden">
        {NAV.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className="shrink-0 rounded-full px-3 py-1.5 text-muted-foreground"
            activeProps={{ className: "!bg-accent !text-accent-foreground" }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
