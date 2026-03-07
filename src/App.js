import Home from "./routes/Home";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import InventoryManagement from "./routes/inventory/InventoryManagement";
import FundManagement from "./routes/fund/FundManagement";
import PatientManagement from "./routes/patientManagement/PatientManagement";
import PatientAdd from "./routes/patientManagement/PatientAdd";
import PatientSearch from "./routes/patientManagement/PatientSearch";
import { SnackbarProvider } from "./components/Snackbar";
import ConsultationAdd from "./routes/patientManagement/ConsultationAdd";
import BibleReadingPlan from "./routes/biy-helper";

function App() {
  return (
    <>
      <SnackbarProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />

            <Route path="/patientsManagement" element={<PatientManagement />} />
            <Route path="/patientsAdd" element={<PatientAdd />} />
            <Route path="/consultationAdd" element={<ConsultationAdd />} />
            <Route path="/patientsSearch" element={<PatientSearch />} />

            <Route path="/biy-helper" element={<BibleReadingPlan />} />

            <Route
              path="/inventoryManagement"
              element={<InventoryManagement />}
            />
            <Route path="/fundManagement" element={<FundManagement />} />
          </Routes>
        </BrowserRouter>
      </SnackbarProvider>
    </>
  );
}

export default App;
