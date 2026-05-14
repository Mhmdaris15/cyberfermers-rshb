import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

// RequireAdmin chains AFTER RequireAuth (it assumes a user is loaded).
// Non-admin lands on /403; missing session lands on /login via the parent guard.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/403" replace />;

  return <>{children}</>;
}
