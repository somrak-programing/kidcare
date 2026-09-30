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
        <Route path="/appointments/new" element={<AppointmentForm />} />
        <Route path="/appointments/:apptId/edit" element={<AppointmentForm />} />
        <Route path="/children/new" element={<ChildForm />} />
        <Route path="/children/:id" element={<ChildDetail />} />
        <Route path="/children/:id/edit" element={<ChildForm />} />
        <Route path="/children/:id/allergies" element={<Allergies />} />
        <Route path="/children/:id/series/new" element={<NewSeries />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
