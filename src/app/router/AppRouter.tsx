import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { HomePage } from "../../modules/home/pages/HomePage";
import { CertificatesPage } from "../../modules/certificates/pages/CertificatesPage";
import { CertificateTrackingPage } from "../../modules/certificates/pages/CertificateTrackingPage";
import { HiringRequestPage } from "../../modules/recruitment/pages/HiringRequestPage";
import { HiringStatusPage } from "../../modules/recruitment/pages/HiringStatusPage";
import { LoginPage } from "../../modules/auth/pages/LoginPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/solicitud-contrataciones" element={<HiringRequestPage />} />
        <Route path="/control-contrataciones" element={<HiringStatusPage />} />
        <Route path="/certificados" element={<CertificatesPage />} />
        <Route path="/seguimiento-certificados" element={<CertificateTrackingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
