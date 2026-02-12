import { useState, useEffect } from "react";
import { ElectionResultService, WardService } from "@/services/election-result.service";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Clock, XCircle, RefreshCw, BarChart3, TrendingUp, Users, Vote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLoading } from "@/components/LoadingState";

export default function ElectionResultsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    loadData();
    setupSubscription();
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resultsData, wardsData, statsData] = await Promise.all([
        ElectionResultService.getResultsWithDetails(),
        WardService.getAllWards(),
        ElectionResultService.getOverallStats()
      ]);

      if (resultsData.data) setResults(resultsData.data);
      if (wardsData) setWards(wardsData);
      if (statsData.data) setStats(statsData.data);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const setupSubscription = async () => {
    const sub = await ElectionResultService.subscribeToResults((payload) => {
      loadData();
      toast({
        title: "New Result",
        description: `New election result submitted${payload.new?.agents?.full_name ? ` by ${payload.new.agents.full_name}` : ''}`,
      });
    });
    setSubscription(sub);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleVerify = async (resultId: string) => {
    if (!user) return;
    const { success, error } = await ElectionResultService.verifyResult(resultId, user.id);
    if (success) {
      toast({ title: "Result verified" });
      loadData();
    } else {
      toast({ title: "Verification failed", description: error, variant: "destructive" });
    }
  };

  const filteredResults = selectedWard === "all" 
    ? results 
    : results.filter(r => r.wards?.ward_number === selectedWard);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-NG').format(num || 0);
  };

  if (loading) return <PageLoading text="Loading election results..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Election Results Dashboard</h1>
          <p className="text-muted-foreground">Real-time results collection</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Submissions</CardDescription>
            <CardTitle className="text-3xl">{stats?.total || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground">
              <Users className="w-4 h-4 mr-2" />
              <span className="text-sm">From all wards</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Verified</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats?.verified || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">{stats?.total ? Math.round((stats.verified / stats.total) * 100) : 0}% verified</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats?.pending || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-yellow-600">
              <Clock className="w-4 h-4 mr-2" />
              <span className="text-sm">Awaiting verification</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Votes</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(stats?.totalVotes)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-muted-foreground">
              <Vote className="w-4 h-4 mr-2" />
              <span className="text-sm">Valid: {formatNumber(stats?.validVotes)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">All Results</TabsTrigger>
          <TabsTrigger value="by-ward">By Ward</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>All Submissions</CardTitle>
                <Select value={selectedWard} onValueChange={setSelectedWard}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by Ward" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wards</SelectItem>
                    {wards.map(ward => (
                      <SelectItem key={ward.id} value={ward.ward_number}>
                        {ward.ward_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ward</TableHead>
                    <TableHead>Polling Unit</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Votes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No results submitted yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((result: any) => (
                      <TableRow key={result.id}>
                        <TableCell>{result.wards?.ward_name || result.ward_id}</TableCell>
                        <TableCell>{result.polling_units?.unit_name || result.polling_unit_id}</TableCell>
                        <TableCell>{result.agents?.full_name || "Unknown"}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            <div className="font-medium">{formatNumber(result.total_votes_cast)}</div>
                            <div className="text-xs text-muted-foreground">
                              Valid: {formatNumber(result.valid_votes)} | Invalid: {formatNumber(result.invalid_votes)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(result.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {result.submitted_at ? new Date(result.submitted_at).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          {result.status === "pending" && (
                            <Button size="sm" onClick={() => handleVerify(result.id)}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verify
                            </Button>
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

        <TabsContent value="by-ward">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {wards.map(ward => {
              const wardStats = stats?.byWard?.[ward.id] || { submitted: 0, verified: 0, votes: 0 };
              return (
                <Card key={ward.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{ward.ward_name}</CardTitle>
                    <CardDescription>Ward {ward.ward_number}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Submitted</span>
                        <span className="font-medium">{wardStats.submitted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Verified</span>
                        <span className="font-medium text-green-600">{wardStats.verified}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Votes</span>
                        <span className="font-medium">{formatNumber(wardStats.votes)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Results Analytics
              </CardTitle>
              <CardDescription>Overview of election results across all wards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="mx-auto h-12 w-12 mb-4" />
                <p>Detailed analytics coming soon</p>
                <p className="text-sm">Charts and graphs will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";
