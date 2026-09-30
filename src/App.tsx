import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import RequireFamily from "@/components/RequireFamily";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";

function HomePlaceholder() {
  return <p>ยังไม่มีข้อมูล</p>;
}

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
        <Route path="/" element={<HomePlaceholder />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
