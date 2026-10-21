import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AuthGuard from "./features/auth/AuthGuard";
import ClinicLayout from "./features/auth/ClinicLayout";
import HomeRedirect from "./features/auth/HomeRedirect";
import LoginPage from "./features/auth/LoginPage";
import VerifyEmailPage from "./features/auth/VerifyEmailPage";
import SetupPage from "./features/signup/SetupPage";
import PatientListPage from "./features/patients/PatientListPage";
import PatientDetailPage from "./features/patients/PatientDetailPage";
import PatientFormPage from "./features/patients/PatientFormPage";
import GeneralsHistoryPage from "./features/patients/GeneralsHistoryPage";
import ConsultationFormPage from "./features/consultations/ConsultationFormPage";
import ConsultationDetailPage from "./features/consultations/ConsultationDetailPage";
import BookingsPage from "./features/bookings/BookingsPage";
import InventoryListPage from "./features/inventory/InventoryListPage";
import InventoryFormPage from "./features/inventory/InventoryFormPage";
import FundsPage from "./features/funds/FundsPage";
import ExpenseFormPage from "./features/funds/ExpenseFormPage";
import CalculatorPage from "./features/rateCalculator/CalculatorPage";
import OwnerOnly from "./features/auth/OwnerOnly";
import PeoplePage from "./features/people/PeoplePage";
import SettingsPage from "./features/settings/SettingsPage";
import StaffListPage from "./features/staff/StaffListPage";
import StaffFormPage from "./features/staff/StaffFormPage";
import StaffDetailPage from "./features/staff/StaffDetailPage";
import LeaveFormPage from "./features/staff/LeaveFormPage";
import PayrollPage from "./features/staff/PayrollPage";
import AccessPage from "./features/access/AccessPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/admin" element={<AccessPage />} />
        <Route path="/:clinicSlug" element={<ClinicLayout />}>
          <Route index element={<Navigate to="patients" replace />} />
          <Route path="patients" element={<PatientListPage />} />
          <Route path="patients/new" element={<PatientFormPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="patients/:id/edit" element={<PatientFormPage />} />
          <Route
            path="patients/:id/generals"
            element={<GeneralsHistoryPage />}
          />
          <Route
            path="patients/:patientId/consultations/new"
            element={<ConsultationFormPage />}
          />
          <Route
            path="patients/:patientId/consultations/:cid"
            element={<ConsultationDetailPage />}
          />
          <Route
            path="patients/:patientId/consultations/:cid/edit"
            element={<ConsultationFormPage />}
          />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="inventory" element={<InventoryListPage />} />
          <Route path="inventory/new" element={<InventoryFormPage />} />
          <Route path="inventory/:id/edit" element={<InventoryFormPage />} />
          <Route path="funds" element={<FundsPage />} />
          <Route path="funds/expenses/new" element={<ExpenseFormPage />} />
          <Route path="funds/expenses/:id/edit" element={<ExpenseFormPage />} />
          <Route path="calculator" element={<CalculatorPage />} />
          <Route
            path="people"
            element={
              <OwnerOnly>
                <PeoplePage />
              </OwnerOnly>
            }
          />
          <Route
            path="staff"
            element={
              <OwnerOnly>
                <StaffListPage />
              </OwnerOnly>
            }
          />
          <Route
            path="staff/payroll"
            element={
              <OwnerOnly>
                <PayrollPage />
              </OwnerOnly>
            }
          />
          <Route
            path="staff/new"
            element={
              <OwnerOnly>
                <StaffFormPage />
              </OwnerOnly>
            }
          />
          <Route
            path="staff/:id/edit"
            element={
              <OwnerOnly>
                <StaffFormPage />
              </OwnerOnly>
            }
          />
          <Route
            path="staff/:id"
            element={
              <OwnerOnly>
                <StaffDetailPage />
              </OwnerOnly>
            }
          />
          <Route
            path="staff/:id/leaves/new"
            element={
              <OwnerOnly>
                <LeaveFormPage />
              </OwnerOnly>
            }
          />
          <Route
            path="staff/:id/leaves/:leaveId/edit"
            element={
              <OwnerOnly>
                <LeaveFormPage />
              </OwnerOnly>
            }
          />
          <Route
            path="settings"
            element={
              <OwnerOnly>
                <SettingsPage />
              </OwnerOnly>
            }
          />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}
