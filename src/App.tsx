import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import RequireFamily from "@/components/RequireFamily";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";
import ChildForm from "@/pages/ChildForm";
import ChildDetail from "@/pages/ChildDetail";
import Allergies from "@/pages/Allergies";
import NewSeries from "@/pages/NewSeries";
import Home from "@/pages/Home";
import AppointmentForm from "@/pages/AppointmentForm";
import Appointments from "@/pages/Appointments";
import ImportPinkBook from "@/pages/ImportPinkBook";
import Illnesses from "@/pages/Illnesses";
import IllnessForm from "@/pages/IllnessForm";
import IllnessDetail from "@/pages/IllnessDetail";
import VisitForm from "@/pages/VisitForm";
import MedicationForm from "@/pages/MedicationForm";
import Growth from "@/pages/Growth";
import GrowthForm from "@/pages/GrowthForm";
import MedicalReport from "@/pages/MedicalReport";
import Manual from "@/pages/Manual";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireFamily>
            <Layout />
          </RequireFamily>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/new" element={<AppointmentForm />} />
        <Route path="/appointments/:apptId/edit" element={<AppointmentForm />} />
        <Route path="/children/new" element={<ChildForm />} />
        <Route path="/children/:id" element={<ChildDetail />} />
        <Route path="/children/:id/edit" element={<ChildForm />} />
        <Route path="/children/:id/allergies" element={<Allergies />} />
        <Route path="/children/:id/series/new" element={<NewSeries />} />
        <Route path="/children/:id/import" element={<ImportPinkBook />} />
        <Route path="/children/:id/illnesses" element={<Illnesses />} />
        <Route path="/children/:id/illnesses/new" element={<IllnessForm />} />
        <Route path="/children/:id/illnesses/:illnessId" element={<IllnessDetail />} />
        <Route path="/children/:id/illnesses/:illnessId/edit" element={<IllnessForm />} />
        <Route path="/children/:id/visits/new" element={<VisitForm />} />
        <Route path="/children/:id/medications/new" element={<MedicationForm />} />
        <Route path="/children/:id/growth" element={<Growth />} />
        <Route path="/children/:id/growth/new" element={<GrowthForm />} />
        <Route path="/children/:id/report" element={<MedicalReport />} />
        <Route path="/manual" element={<Manual />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
