import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AgentProvider } from "@/pages/AgentLogin";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AgentDirectory from "./pages/AgentDirectory";
import ImportAgents from "./pages/ImportAgents";
import Reports from "./pages/Reports";
import Payments from "./pages/Payments";
import Broadcasts from "./pages/Broadcasts";
import NotFound from "./pages/NotFound";
import Search from "./pages/Search";
import WhatsApp from "./pages/WhatsApp";
import AgentLogin from "./pages/AgentLogin";
import AgentDashboard from "./pages/AgentDashboard";
import ElectionResults from "./pages/ElectionResults";
import WardPortal from "./pages/WardPortal";
import EmergencyResultInput from "./pages/EmergencyResultInput";
import AdminImpersonateAgent from "./pages/AdminImpersonateAgent";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AgentProvider>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/agents" element={<AgentDirectory />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/election-results" element={<ElectionResults />} />
                <Route path="/ward-portal" element={<WardPortal />} />
                <Route path="/search" element={<Search />} />
              </Route>
              <Route path="/agent/login" element={<AgentLogin />} />
              <Route path="/agent/dashboard" element={<AgentDashboard />} />
              <Route path="/emergency-result" element={<EmergencyResultInput />} />
              <Route path="/admin/impersonate-agent" element={<AdminImpersonateAgent />} />
              <Route path="/admin/import" element={<ImportAgents />} />
              <Route path="/admin/payments" element={<Payments />} />
              <Route path="/admin/broadcasts" element={<Broadcasts />} />
              <Route path="/admin/whatsapp" element={<WhatsApp />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </AgentProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
