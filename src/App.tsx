import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AuthGuard from "./features/auth/AuthGuard";
import LoginPage from "./features/auth/LoginPage";
import PatientListPage from "./features/patients/PatientListPage";
import PatientDetailPage from "./features/patients/PatientDetailPage";
import PatientFormPage from "./features/patients/PatientFormPage";
import ConsultationFormPage from "./features/consultations/ConsultationFormPage";
import InventoryListPage from "./features/inventory/InventoryListPage";
import InventoryFormPage from "./features/inventory/InventoryFormPage";
import FundsPage from "./features/funds/FundsPage";
import ExpenseFormPage from "./features/funds/ExpenseFormPage";
import CalculatorPage from "./features/rateCalculator/CalculatorPage";

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
        <Route path="/patients" element={<PatientListPage />} />
        <Route path="/patients/new" element={<PatientFormPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/patients/:id/edit" element={<PatientFormPage />} />
        <Route
          path="/patients/:patientId/consultations/new"
          element={<ConsultationFormPage />}
        />
        <Route
          path="/patients/:patientId/consultations/:cid/edit"
          element={<ConsultationFormPage />}
        />
        <Route path="/inventory" element={<InventoryListPage />} />
        <Route path="/inventory/new" element={<InventoryFormPage />} />
        <Route path="/inventory/:id/edit" element={<InventoryFormPage />} />
        <Route path="/funds" element={<FundsPage />} />
        <Route path="/funds/expenses/new" element={<ExpenseFormPage />} />
        <Route path="/funds/expenses/:id/edit" element={<ExpenseFormPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
