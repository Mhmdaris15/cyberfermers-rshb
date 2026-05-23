import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { FarmersPage } from "./pages/FarmersPage";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { CalendarPage } from "./pages/CalendarPage";
import { PlanPage } from "./pages/PlanPage";
import { ProductsPage } from "./pages/ProductsPage";
import { AiPage } from "./pages/AiPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StoriesPage } from "./pages/StoriesPage";
import { BlogsPage } from "./pages/BlogsPage";
import { RecipesPage } from "./pages/RecipesPage";
import { SocialPage } from "./pages/SocialPage";
import { PushPage } from "./pages/PushPage";
import { Login } from "./pages/Login";
import { Forbidden } from "./pages/Forbidden";
import { AdminUsers } from "./pages/AdminUsers";
import { AdminSessions } from "./pages/AdminSessions";
import { AdminMaintenancePage } from "./pages/AdminMaintenancePage";
import { MaintenanceScreen } from "./pages/MaintenanceScreen";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { AdminLayout } from "./components/auth/AdminLayout";
import { useMaintenance } from "./lib/maintenance";

// MaintenanceGate intercepts every route when the global gate is on.
// Two exceptions live above the gate:
//   1. /admin/maintenance     — the kill-switch surface itself
//   2. /login                 — needed to authenticate before reaching #1
// Everything else (Landing, farmer pages, other admin tools) is replaced
// by the public MaintenanceScreen until the toggle flips back.
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const state = useMaintenance();
  const loc = useLocation();
  const bypassPaths = ["/admin/maintenance", "/login"];
  const isBypass = bypassPaths.some((p) => loc.pathname.startsWith(p));
  if (state.maintenance && !isBypass) {
    return <MaintenanceScreen state={state} />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <MaintenanceGate>
    <Routes>
      {/* ── public ─────────────────────────────────────────────── */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />

      {/* ── authenticated app (layout route) ───────────────────── */}
      <Route element={<RequireAuth><Outlet /></RequireAuth>}>
        <Route path="/farmers" element={<FarmersPage />} />
        <Route path="/farmer/:farmerId" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="stories" element={<StoriesPage />} />
          <Route path="blogs" element={<BlogsPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="social" element={<SocialPage />} />
          <Route path="push" element={<PushPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* admin subtree — RequireAdmin nested inside RequireAuth */}
        <Route
          path="/admin"
          element={<RequireAdmin><AdminLayout /></RequireAdmin>}
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="sessions" element={<AdminSessions />} />
          <Route path="maintenance" element={<AdminMaintenancePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </MaintenanceGate>
  );
}
