import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { FarmersPage } from "./pages/FarmersPage";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { CalendarPage } from "./pages/CalendarPage";
import { PlanPage } from "./pages/PlanPage";
import { ProductsPage } from "./pages/ProductsPage";
import { AiPage } from "./pages/AiPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Login } from "./pages/Login";
import { Forbidden } from "./pages/Forbidden";
import { AdminUsers } from "./pages/AdminUsers";
import { AdminSessions } from "./pages/AdminSessions";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { AdminLayout } from "./components/auth/AdminLayout";

export function App() {
  return (
    <Routes>
      {/* ── public ─────────────────────────────────────────────── */}
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />

      {/* ── authenticated app (layout route) ───────────────────── */}
      <Route element={<RequireAuth><Outlet /></RequireAuth>}>
        <Route path="/" element={<Landing />} />
        <Route path="/farmers" element={<FarmersPage />} />
        <Route path="/farmer/:farmerId" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="plan" element={<PlanPage />} />
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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
