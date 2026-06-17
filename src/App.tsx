import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import PatientsPlaceholder from "./routes/PatientsPlaceholder";
import InventoryPlaceholder from "./routes/InventoryPlaceholder";
import FundsPlaceholder from "./routes/FundsPlaceholder";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/patients" element={<PatientsPlaceholder />} />
        <Route path="/inventory" element={<InventoryPlaceholder />} />
        <Route path="/funds" element={<FundsPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
