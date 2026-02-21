import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  User, 
  LogIn, 
  ArrowLeft,
  Loader2,
  Shield,
  Building,
  Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AgentService } from "@/services/agent.service";
import { useAgent } from "@/pages/AgentLogin";

interface Agent {
  id: string;
  full_name: string;
  ward_number: string;
  ward_name: string;
  polling_unit_id: string;
  phone_number: string;
}

export default function AdminImpersonateAgent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const allAgents = await AgentService.getAllAgents();
      setAgents(allAgents);
    } catch (error) {
      console.error("Error loading agents:", error);
    }
    setLoading(false);
  };

  const filteredAgents = agents.filter(agent => {
    const query = searchQuery.toLowerCase();
    return (
      agent.full_name.toLowerCase().includes(query) ||
      agent.ward_number?.toLowerCase().includes(query) ||
      agent.ward_name?.toLowerCase().includes(query) ||
      agent.phone_number?.includes(query)
    );
  });

  const handleImpersonate = async (agent: Agent) => {
    setImpersonating(true);
    
    localStorage.setItem("agent_session", JSON.stringify(agent));
    localStorage.setItem("impersonating_admin", "true");
    
    toast({
      title: "Switched to agent",
      description: `Now viewing as ${agent.full_name}`,
    });
    
    navigate("/agent/dashboard");
  };

  const wards = [...new Set(agents.map(a => a.ward_number).filter(Boolean))].sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-3 bg-indigo-100 rounded-lg">
            <Shield className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin - Agent Impersonation</h1>
            <p className="text-gray-600">Select an agent to login as them and submit results</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Agent
            </CardTitle>
            <CardDescription>
              Search for an agent by name, ward, or phone number
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    variant={searchQuery === "" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchQuery("")}
                  >
                    All ({agents.length})
                  </Button>
                  {wards.slice(0, 10).map(ward => {
                    const count = agents.filter(a => a.ward_number === ward).length;
                    return (
                      <Button
                        key={ward}
                        variant={searchQuery === ward ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSearchQuery(ward)}
                      >
                        Ward {ward} ({count})
                      </Button>
                    );
                  })}
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredAgents.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No agents found matching your search
                    </p>
                  ) : (
                    filteredAgents.map(agent => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                            <User className="h-6 w-6 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium">{agent.full_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                <Building className="h-3 w-3 mr-1" />
                                Ward {agent.ward_number}
                              </Badge>
                              {agent.ward_name && (
                                <span className="text-xs text-muted-foreground">{agent.ward_name}</span>
                              )}
                            </div>
                            {agent.phone_number && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {agent.phone_number}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleImpersonate(agent)}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          <LogIn className="mr-2 h-4 w-4" />
                          Login as Agent
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Admin Impersonation Mode</p>
                <p className="text-sm text-amber-700">
                  When you login as an agent, you'll be able to submit results on their behalf. 
                  All submissions will be attributed to the selected agent.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
