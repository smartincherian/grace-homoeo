import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AuthGuard from "./features/auth/AuthGuard";
import LoginPage from "./features/auth/LoginPage";
import PatientsPlaceholder from "./routes/PatientsPlaceholder";
import InventoryPlaceholder from "./routes/InventoryPlaceholder";
import FundsPlaceholder from "./routes/FundsPlaceholder";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/patients" element={<PatientsPlaceholder />} />
        <Route path="/inventory" element={<InventoryPlaceholder />} />
        <Route path="/funds" element={<FundsPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
