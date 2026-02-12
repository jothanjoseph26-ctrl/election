import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentService } from "@/services/agent.service";
import { WardService, ElectionResultService } from "@/services/election-result.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, Users, Vote, CheckCircle, Clock, MapPin, Search, Phone, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLoading } from "@/components/LoadingState";

export default function WardPortal() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [wardStats, setWardStats] = useState<any>(null);

  useEffect(() => {
    loadWards();
  }, []);

  useEffect(() => {
    if (selectedWard) {
      loadWardData(selectedWard);
    }
  }, [selectedWard]);

  const loadWards = async () => {
    setLoading(true);
    try {
      const wardsData = await WardService.getAllWards();
      setWards(wardsData);
      if (wardsData.length > 0) {
        setSelectedWard(wardsData[0].ward_number);
      }
    } catch (error) {
      console.error("Error loading wards:", error);
    }
    setLoading(false);
  };

  const loadWardData = async (wardNumber: string) => {
    setLoading(true);
    try {
      const ward = await WardService.getWardByNumber(wardNumber);
      const [agentsData, resultsData, statsData] = await Promise.all([
        AgentService.getAgentsByWard(wardNumber),
        ward ? ElectionResultService.getResultsByWard(ward.id) : Promise.resolve([]),
        ward ? ElectionResultService.getWardStats(ward.id) : Promise.resolve({ data: null }),
      ]);

      setAgents(agentsData);
      setResults(resultsData);
      setWardStats(statsData.data);
    } catch (error) {
      console.error("Error loading ward data:", error);
    }
    setLoading(false);
  };

  const filteredAgents = agents.filter(agent => {
    const search = searchTerm.toLowerCase();
    return (
      agent.full_name?.toLowerCase().includes(search) ||
      agent.phone_number?.includes(search) ||
      agent.ward_name?.toLowerCase().includes(search)
    );
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-NG').format(num || 0);
  };

  if (loading) return <PageLoading text="Loading ward portal..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Ward Portal</h1>
          <p className="text-muted-foreground">Manage agents and monitor results</p>
        </div>
        <Select value={selectedWard || ""} onValueChange={setSelectedWard}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select Ward" />
          </SelectTrigger>
          <SelectContent>
            {wards.map(ward => (
              <SelectItem key={ward.id} value={ward.ward_number}>
                {ward.ward_name} (Ward {ward.ward_number})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedWard && wardStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Agents</CardDescription>
              <CardTitle className="text-3xl">{agents.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-muted-foreground">
                <Users className="w-4 h-4 mr-2" />
                <span className="text-sm">Registered</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Results Submitted</CardDescription>
              <CardTitle className="text-3xl">{wardStats.total || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-muted-foreground">
                <Vote className="w-4 h-4 mr-2" />
                <span className="text-sm">From polling units</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Verified</CardDescription>
              <CardTitle className="text-3xl text-green-600">{wardStats.verified || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">Confirmed</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Votes</CardDescription>
              <CardTitle className="text-3xl">{formatNumber(wardStats.totalVotes)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-muted-foreground">
                <Vote className="w-4 h-4 mr-2" />
                <span className="text-sm">Cast</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Ward Agents</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search agents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Ward</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No agents found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAgents.map(agent => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <User className="mr-2 h-4 w-4" />
                            {agent.full_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Phone className="mr-2 h-4 w-4" />
                            {agent.phone_number || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4" />
                            Ward {agent.ward_number} - {agent.ward_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(agent as any).is_active !== false ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.payment_status === "paid" ? (
                            <Badge className="bg-green-500">Paid</Badge>
                          ) : agent.payment_status === "pending" ? (
                            <Badge className="bg-yellow-500">Pending</Badge>
                          ) : (
                            <Badge variant="outline">Not Paid</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Election Results</CardTitle>
              <CardDescription>Results submitted from this ward</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Polling Unit</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Votes</TableHead>
                    <TableHead>Valid</TableHead>
                    <TableHead>Invalid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No results submitted yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    results.map(result => (
                      <TableRow key={result.id}>
                        <TableCell>{result.polling_unit_id || "-"}</TableCell>
                        <TableCell>{result.agent_id || "-"}</TableCell>
                        <TableCell className="font-medium">{formatNumber(result.total_votes_cast)}</TableCell>
                        <TableCell>{formatNumber(result.valid_votes)}</TableCell>
                        <TableCell>{formatNumber(result.invalid_votes)}</TableCell>
                        <TableCell>
                          {result.status === "verified" ? (
                            <Badge className="bg-green-500">Verified</Badge>
                          ) : result.status === "pending" ? (
                            <Badge className="bg-yellow-500">Pending</Badge>
                          ) : (
                            <Badge className="bg-red-500">Rejected</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {result.submitted_at ? new Date(result.submitted_at).toLocaleString() : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
