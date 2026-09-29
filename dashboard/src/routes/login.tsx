import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoaderCircle, Lock, ShieldAlert, TriangleAlert, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Operator Login — Open-Cast Collision Avoidance Control" },
      {
        name: "description",
        content:
          "Secure operator access to the open-cast mine collision avoidance control system: live HUD stream, proximity telemetry and emergency braking.",
      },
      { property: "og:title", content: "Operator Login — Collision Avoidance Control" },
      {
        property: "og:description",
        content:
          "Admin portal for the ESP32-CAM haul vehicle collision avoidance system with live telemetry and incident logging.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, session, ready } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) void navigate({ to: "/dashboard", replace: true });
  }, [ready, session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Operator ID and access code are required");
      return;
    }
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if (res.ok) void navigate({ to: "/dashboard", replace: true });
    else setError(res.error ?? "Login failed");
  }

  return (
    <main className="grid-backdrop relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-[28rem] rounded-full bg-accent/10 blur-3xl" />

      <div className="panel-glass glow-cyan relative w-full max-w-md p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
            <ShieldAlert className="size-7 text-primary" />
          </div>
          <h1 className="font-display text-lg font-bold tracking-[0.18em] uppercase">
            Collision Avoidance
          </h1>
          <p className="mt-1 text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
            Open-Cast Mine · Control Portal
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Operator ID
            </label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-secondary/40 px-3 focus-within:border-primary">
              <User className="size-4 text-muted-foreground" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="admin"
                className="w-full bg-transparent py-2.5 font-mono text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Access Code
            </label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-secondary/40 px-3 focus-within:border-primary">
              <Lock className="size-4 text-muted-foreground" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent py-2.5 font-mono text-sm outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs text-destructive">
              <TriangleAlert className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/60 bg-primary/20 py-3 font-display text-xs font-bold tracking-[0.25em] text-primary uppercase transition-colors hover:bg-primary/30 disabled:opacity-60"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {busy ? "Authenticating" : "Authenticate"}
          </button>
        </form>

        <p className="mt-6 rounded-md border border-border bg-secondary/30 px-3 py-2 text-center font-mono text-[11px] text-muted-foreground">
          demo credentials — admin / admin123
        </p>
      </div>
    </main>
  );
}
