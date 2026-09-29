import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { TelemetryProvider } from "@/context/TelemetryContext";
import { Header, Sidebar } from "@/components/Header";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, ready, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/login", replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-xs tracking-[0.3em] text-muted-foreground uppercase">
        Verifying operator session…
      </div>
    );
  }

  return (
    <TelemetryProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Header
            onLogout={() => {
              logout();
              void navigate({ to: "/login", replace: true });
            }}
          />
          <Outlet />
        </div>
      </div>
    </TelemetryProvider>
  );
}
