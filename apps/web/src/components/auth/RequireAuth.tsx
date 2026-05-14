import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

// RequireAuth — gates an entire route subtree on a valid session.
// On miss it redirects to /login with a ?next= param so the user lands
// back where they intended after authenticating. Renders a graceful
// loading state while the initial /me hydration is in flight.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3 text-ink-mute">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-leaf/40 border-t-leaf" />
          <div className="smallcaps text-[11px]">проверяем сессию</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
