import { useState, createContext, useContext, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Phone, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLoading } from "@/components/LoadingState";
import { AgentService } from "@/services/agent.service";

interface AgentContextType {
  agent: any;
  loading: boolean;
  loginByPhone: (phone: string) => Promise<{ success: boolean; error: string | null }>;
  loginByPin: (pin: string) => Promise<{ success: boolean; error: string | null }>;
  logout: () => void;
  refreshAgent: () => Promise<void>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgent = async () => {
      const storedAgent = localStorage.getItem("agent_session");
      if (storedAgent) {
        const parsed = JSON.parse(storedAgent);
        if (parsed.id) {
          const freshAgent = await AgentService.getAgentById(parsed.id);
          if (freshAgent) {
            setAgent(freshAgent);
            localStorage.setItem("agent_session", JSON.stringify(freshAgent));
          } else {
            localStorage.removeItem("agent_session");
          }
        }
      }
      setLoading(false);
    };
    loadAgent();
  }, []);

  const loginByPhone = async (phone: string): Promise<{ success: boolean; error: string | null }> => {
    setLoading(true);
    const { agent: foundAgent, error } = await AgentService.loginByPhone(phone);
    setLoading(false);

    if (error || !foundAgent) {
      return { success: false, error: error || "Agent not found" };
    }

    setAgent(foundAgent);
    localStorage.setItem("agent_session", JSON.stringify(foundAgent));
    return { success: true, error: null };
  };

  const loginByPin = async (pin: string): Promise<{ success: boolean; error: string | null }> => {
    setLoading(true);
    const { agent: foundAgent, error } = await AgentService.loginByPin(pin);
    setLoading(false);

    if (error || !foundAgent) {
      return { success: false, error: error || "Invalid PIN" };
    }

    setAgent(foundAgent);
    localStorage.setItem("agent_session", JSON.stringify(foundAgent));
    return { success: true, error: null };
  };

  const logout = () => {
    setAgent(null);
    localStorage.removeItem("agent_session");
  };

  const refreshAgent = async () => {
    if (agent?.id) {
      const refreshed = await AgentService.getAgentById(agent.id);
      if (refreshed) {
        setAgent(refreshed);
        localStorage.setItem("agent_session", JSON.stringify(refreshed));
      }
    }
  };

  return (
    <AgentContext.Provider value={{ agent, loading, loginByPhone, loginByPin, logout, refreshAgent }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

export default function AgentLogin() {
  const { loginByPhone, loginByPin, loading } = useAgent();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <PageLoading text="Loading..." />;
  }

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await loginByPhone(phone);
    if (result.success) {
      navigate("/agent/dashboard");
    } else {
      toast({ title: "Login failed", description: result.error, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await loginByPin(pin);
    if (result.success) {
      navigate("/agent/dashboard");
    } else {
      toast({ title: "Login failed", description: result.error, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3">
            <img src="/logo.png" alt="AMAC" className="h-16 w-auto mx-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">Agent Portal</CardTitle>
          <CardDescription>Login with phone number or PIN</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phone">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="phone">Phone Number</TabsTrigger>
              <TabsTrigger value="pin">PIN</TabsTrigger>
            </TabsList>
            <TabsContent value="phone">
              <form onSubmit={handlePhoneLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="phone" 
                      type="tel" 
                      placeholder="08012345678" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      className="pl-10"
                      required 
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {submitting ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="pin">
              <form onSubmit={handlePinLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="pin" 
                      type="password" 
                      placeholder="Enter your PIN" 
                      value={pin} 
                      onChange={(e) => setPin(e.target.value)} 
                      className="pl-10"
                      maxLength={6}
                      required 
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {submitting ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
