import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import ReceptionistDashboard from "./pages/ReceptionistDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorConsultationPage from "./pages/DoctorConsultationPage";
import AdminDashboard from "./pages/AdminDashboard";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import Settings from "./pages/Settings";
import TemplatesPage from "./pages/TemplatesPage";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, profile, loading } = useAuth();
  const [clinicReady, setClinicReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (profile?.clinic_id) {
      supabase
        .from("clinics")
        .select("onboarding_complete")
        .eq("id", profile.clinic_id)
        .single()
        .then(({ data }) => {
          setClinicReady(data?.onboarding_complete ?? false);
        });
    } else if (profile && !profile.clinic_id) {
      setClinicReady(false);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  // Waiting for clinic check
  if (clinicReady === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Needs onboarding
  if (!clinicReady) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // Role-based dashboard
  const role = profile?.role;
  const DashboardComponent = role === "receptionist" ? ReceptionistDashboard : (role === "doctor" || role === "admin") ? DoctorDashboard : AdminDashboard;

  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardComponent />} />
      <Route path="/dashboard/consultation/:visitId" element={
        role === "doctor" || role === "admin" ? <DoctorConsultationPage /> : <Navigate to="/dashboard" replace />
      } />
      <Route path="/dashboard/patients" element={<PatientsPage />} />
      <Route path="/dashboard/patients/:patientId" element={<PatientDetailPage />} />
      <Route path="/dashboard/templates" element={<TemplatesPage />} />
      <Route path="/dashboard/settings" element={<Settings />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
