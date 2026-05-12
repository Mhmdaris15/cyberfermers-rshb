import { Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { FarmersPage } from "./pages/FarmersPage";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { CalendarPage } from "./pages/CalendarPage";
import { PlanPage } from "./pages/PlanPage";
import { ProductsPage } from "./pages/ProductsPage";
import { AiPage } from "./pages/AiPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <Routes>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
