import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ElectionResultService, WardService } from "@/services/election-result.service";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Vote,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLoading } from "@/components/LoadingState";

type ResultRecord = {
  id: string;
  ward_id: string;
  polling_unit_id?: string | null;
  status: "pending" | "verified" | "rejected" | string;
  total_votes_cast: number;
  valid_votes: number;
  invalid_votes: number;
  party_results?: Record<string, number> | null;
  submitted_at: string | null;
  agents?: { full_name?: string | null } | null;
  polling_units?: { unit_name?: string | null } | null;
  wards?: { ward_number?: string | null; ward_name?: string | null } | null;
};

type WardRecord = {
  id: string;
  ward_number: string;
  ward_name: string;
};

type OverviewStats = {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  totalVotes: number;
  validVotes: number;
  invalidVotes: number;
  byWard: Record<string, { submitted: number; verified: number; votes: number }>;
};

type WardOpsSummary = {
  id: string;
  wardNumber: string;
  wardName: string;
  submitted: number;
  verified: number;
  pending: number;
  rejected: number;
  totalVotes: number;
  invalidVotes: number;
  invalidRatio: number;
  verificationRate: number;
  collectionRate: number;
  urgencyScore: number;
};

type PollingUnitProjection = {
  key: string;
  wardName: string;
  wardNumber: string;
  pollingUnitName: string;
  submittedAt: string | null;
  status: string;
  totalVotes: number;
  parties: Array<{ party: string; votes: number }>;
  leadingParty: string;
  leadingVotes: number;
  runnerUpVotes: number;
  margin: number;
};

export default function ElectionResultsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [wards, setWards] = useState<WardRecord[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [subscription, setSubscription] = useState<ReturnType<typeof supabase.channel> | null>(null);

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

      if (resultsData.data) setResults(resultsData.data as ResultRecord[]);
      if (wardsData) setWards(wardsData);
      if (statsData.data) setStats(statsData.data as OverviewStats);
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

  const recentResults = useMemo(
    () =>
      [...results]
        .sort((a, b) => {
          const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 8),
    [results]
  );

  const wardSummaries = useMemo(() => {
    const rows: WardOpsSummary[] = wards.map((ward) => {
      const wardResults = results.filter((result) => result.ward_id === ward.id);
      const submitted = wardResults.length;
      const verified = wardResults.filter((result) => result.status === "verified").length;
      const pending = wardResults.filter((result) => result.status === "pending").length;
      const rejected = wardResults.filter((result) => result.status === "rejected").length;
      const totalVotes = wardResults.reduce((sum, result) => sum + (result.total_votes_cast || 0), 0);
      const invalidVotes = wardResults.reduce((sum, result) => sum + (result.invalid_votes || 0), 0);
      const invalidRatio = totalVotes > 0 ? (invalidVotes / totalVotes) * 100 : 0;
      const verificationRate = submitted > 0 ? (verified / submitted) * 100 : 0;
      const collectionRate = results.length > 0 ? (submitted / results.length) * 100 : 0;
      const urgencyScore = pending * 2 + rejected * 2 + Math.min(20, invalidRatio) + (100 - verificationRate) * 0.35;

      return {
        id: ward.id,
        wardNumber: ward.ward_number,
        wardName: ward.ward_name,
        submitted,
        verified,
        pending,
        rejected,
        totalVotes,
        invalidVotes,
        invalidRatio,
        verificationRate,
        collectionRate,
        urgencyScore,
      };
    });

    return rows.sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [results, wards]);

  const pollingUnitProjections = useMemo(() => {
    const latestByPu = new Map<string, ResultRecord>();

    [...results]
      .filter((result) => result.status !== "rejected")
      .sort((a, b) => {
        const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return bTime - aTime;
      })
      .forEach((result) => {
        const key = result.polling_unit_id || result.polling_units?.unit_name || result.id;
        if (!latestByPu.has(key)) latestByPu.set(key, result);
      });

    const projections: PollingUnitProjection[] = Array.from(latestByPu.entries()).map(([key, result]) => {
      const parties = Object.entries(result.party_results || {})
        .map(([party, votes]) => ({
          party,
          votes: Number(votes) || 0,
        }))
        .sort((a, b) => b.votes - a.votes);

      const leadingVotes = parties[0]?.votes || 0;
      const runnerUpVotes = parties[1]?.votes || 0;

      return {
        key,
        wardName: result.wards?.ward_name || "Unknown Ward",
        wardNumber: result.wards?.ward_number || "-",
        pollingUnitName: result.polling_units?.unit_name || "Unknown Polling Unit",
        submittedAt: result.submitted_at,
        status: result.status,
        totalVotes: result.total_votes_cast || 0,
        parties,
        leadingParty: parties[0]?.party || "N/A",
        leadingVotes,
        runnerUpVotes,
        margin: Math.max(0, leadingVotes - runnerUpVotes),
      };
    });

    return projections.sort((a, b) => b.totalVotes - a.totalVotes);
  }, [results]);

  const partyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const projection of pollingUnitProjections) {
      for (const party of projection.parties) {
        totals.set(party.party, (totals.get(party.party) || 0) + party.votes);
      }
    }
    return Array.from(totals.entries())
      .map(([party, votes]) => ({ party, votes }))
      .sort((a, b) => b.votes - a.votes);
  }, [pollingUnitProjections]);

  const projectedWinner = partyTotals[0] || null;
  const projectedRunnerUp = partyTotals[1] || null;

  const overview = useMemo(() => {
    const totalSubmissions = stats?.total || 0;
    const pending = stats?.pending || 0;
    const verified = stats?.verified || 0;
    const rejected = stats?.rejected || 0;
    const totalVotes = stats?.totalVotes || 0;
    const invalidVotes = stats?.invalidVotes || 0;
    const validVotes = stats?.validVotes || 0;
    const verificationRate = totalSubmissions > 0 ? (verified / totalSubmissions) * 100 : 0;
    const backlogRate = totalSubmissions > 0 ? (pending / totalSubmissions) * 100 : 0;
    const invalidRate = totalVotes > 0 ? (invalidVotes / totalVotes) * 100 : 0;
    const wardsWithSubmission = wardSummaries.filter((ward) => ward.submitted > 0).length;
    const wardCoverage = wards.length > 0 ? (wardsWithSubmission / wards.length) * 100 : 0;
    const lastSubmissionAt = recentResults[0]?.submitted_at || null;
    const staleWards = wardSummaries.filter((ward) => ward.submitted === 0).length;

    return {
      totalSubmissions,
      pending,
      verified,
      rejected,
      totalVotes,
      validVotes,
      invalidVotes,
      verificationRate,
      backlogRate,
      invalidRate,
      wardCoverage,
      wardsWithSubmission,
      staleWards,
      lastSubmissionAt,
    };
  }, [recentResults, stats, wardSummaries, wards.length]);

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

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "No timestamp";
    const ms = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getUrgencyLabel = (ward: WardOpsSummary) => {
    if (ward.pending >= 3 || ward.verificationRate < 50 || ward.invalidRatio >= 10) return "critical";
    if (ward.pending > 0 || ward.invalidRatio >= 5) return "watch";
    return "stable";
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collection Coverage</CardDescription>
            <CardTitle className="text-3xl">{overview.wardCoverage.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overview.wardCoverage} className="mb-2 h-2" />
            <span className="text-sm text-muted-foreground">
              {overview.wardsWithSubmission}/{wards.length} wards reporting
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Verification Completion</CardDescription>
            <CardTitle className="text-3xl text-green-600">{overview.verificationRate.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span>{overview.verified} of {overview.totalSubmissions} submissions verified</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Verification Backlog</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{overview.pending}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-yellow-600">
              <Clock className="w-4 h-4 mr-2" />
              <span>{overview.backlogRate.toFixed(1)}% of submitted results pending</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Data Quality Risk</CardDescription>
            <CardTitle className="text-3xl">{overview.invalidRate.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>
                Invalid {formatNumber(overview.invalidVotes)} / Total {formatNumber(overview.totalVotes)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="results">All Results</TabsTrigger>
          <TabsTrigger value="by-ward">By Ward</TabsTrigger>
          <TabsTrigger value="party-totals">Party Totals</TabsTrigger>
          <TabsTrigger value="analytics">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  God&apos;s-Eye Ward Priority Board
                </CardTitle>
                <CardDescription>Wards ranked by collection, pending load, and invalid-vote risk</CardDescription>
              </CardHeader>
              <CardContent>
                {wardSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ward data available.</p>
                ) : (
                  <div className="space-y-3">
                    {wardSummaries.slice(0, 8).map((ward) => {
                      const urgency = getUrgencyLabel(ward);
                      return (
                        <div key={ward.id} className="rounded-lg border p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{ward.wardName}</p>
                              <p className="text-xs text-muted-foreground">Ward {ward.wardNumber}</p>
                            </div>
                            <Badge
                              variant={
                                urgency === "critical" ? "destructive" : urgency === "watch" ? "secondary" : "outline"
                              }
                            >
                              {urgency}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                            <div>
                              <p className="text-muted-foreground">Submitted</p>
                              <p className="font-semibold">{ward.submitted}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Pending</p>
                              <p className="font-semibold text-yellow-600">{ward.pending}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Verification</p>
                              <p className="font-semibold">{ward.verificationRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Invalid Ratio</p>
                              <p className="font-semibold">{ward.invalidRatio.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Command Snapshot</CardTitle>
                <CardDescription>Current status at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Last submission</p>
                  <p className="text-sm font-medium">{formatRelativeTime(overview.lastSubmissionAt)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total submissions</p>
                  <p className="text-sm font-medium">{overview.totalSubmissions}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Wards with no submissions</p>
                  <p className="text-sm font-medium">{overview.staleWards}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Rejected results</p>
                  <p className="text-sm font-medium">{overview.rejected}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                    filteredResults.map((result: ResultRecord) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {wardSummaries.map((ward) => {
              return (
                <Card key={ward.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{ward.wardName}</CardTitle>
                    <CardDescription>Ward {ward.wardNumber}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3">
                      <p className="mb-1 text-xs text-muted-foreground">Verification Progress</p>
                      <Progress value={ward.verificationRate} className="h-2" />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Submitted</span>
                        <span className="font-medium">{ward.submitted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Verified</span>
                        <span className="font-medium text-green-600">{ward.verified}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-medium text-yellow-600">{ward.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rejected</span>
                        <span className="font-medium text-red-600">{ward.rejected}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Votes</span>
                        <span className="font-medium">{formatNumber(ward.totalVotes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invalid Ratio</span>
                        <span className="font-medium">{ward.invalidRatio.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="party-totals">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Vote className="h-5 w-5" />
                  Total Votes by Party
                </CardTitle>
                <CardDescription>Aggregated from latest valid submission per polling unit</CardDescription>
              </CardHeader>
              <CardContent>
                {partyTotals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No party result data submitted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {partyTotals.map((party, index) => (
                      <div key={party.party} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={index === 0 ? "default" : "outline"}>{index + 1}</Badge>
                          <span className="font-medium">{party.party}</span>
                        </div>
                        <span className="font-semibold">{formatNumber(party.votes)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Projected Winner</CardTitle>
                <CardDescription>Based on current polling-unit submissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {projectedWinner ? (
                  <>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Leading Party</p>
                      <p className="text-lg font-semibold">{projectedWinner.party}</p>
                      <p className="text-sm text-muted-foreground">{formatNumber(projectedWinner.votes)} votes</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Lead Margin</p>
                      <p className="text-lg font-semibold">
                        {formatNumber(projectedWinner.votes - (projectedRunnerUp?.votes || 0))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        vs {projectedRunnerUp?.party || "next party"}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No winner projection available yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Polling Unit Winner Projection</CardTitle>
              <CardDescription>Leading party and margin for each polling unit</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ward</TableHead>
                    <TableHead>Polling Unit</TableHead>
                    <TableHead>Possible Winner</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Party Breakdown</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pollingUnitProjections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No polling-unit projections yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pollingUnitProjections.map((pu) => (
                      <TableRow key={pu.key}>
                        <TableCell>{pu.wardName}</TableCell>
                        <TableCell>{pu.pollingUnitName}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{pu.leadingParty}</p>
                            <p className="text-xs text-muted-foreground">{formatNumber(pu.leadingVotes)} votes</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatNumber(pu.margin)}</TableCell>
                        <TableCell className="max-w-[360px]">
                          <div className="flex flex-wrap gap-1">
                            {pu.parties.slice(0, 5).map((party) => (
                              <Badge key={`${pu.key}-${party.party}`} variant="outline">
                                {party.party}: {formatNumber(party.votes)}
                              </Badge>
                            ))}
                            {pu.parties.length === 0 && <span className="text-xs text-muted-foreground">No party data</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeTime(pu.submittedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Deployment Insights
              </CardTitle>
              <CardDescription>Collection speed, verification pressure, and quality posture</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Submission Throughput</p>
                  <p className="mt-1 text-xl font-semibold">{overview.totalSubmissions}</p>
                  <p className="text-xs text-muted-foreground">Total results currently in the pipeline</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Vote Integrity</p>
                  <p className="mt-1 text-xl font-semibold">{overview.invalidRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Invalid-to-total vote ratio</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Verification Readiness</p>
                  <p className="mt-1 text-xl font-semibold">{overview.verificationRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Portion of results cleared for final collation</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Live Collection Feed
              </CardTitle>
              <CardDescription>Latest submitted results for rapid deployment decisions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentResults.map((result) => (
                    <div key={result.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {result.wards?.ward_name || "Unknown Ward"} / {result.polling_units?.unit_name || "Unknown Polling Unit"}
                        </p>
                        {getStatusBadge(result.status)}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                        <p>Agent: {result.agents?.full_name || "Unknown"}</p>
                        <p>Total Votes: {formatNumber(result.total_votes_cast)}</p>
                        <p>Submitted: {formatRelativeTime(result.submitted_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
