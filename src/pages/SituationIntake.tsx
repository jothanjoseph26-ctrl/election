import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { parseSituationText, type ParsedSituationRecord } from "@/lib/situation-parser";
import { SituationIntakeService } from "@/services/situation-intake.service";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardPaste, UploadCloud, Wand2 } from "lucide-react";

interface AgentOption {
  id: string;
  full_name: string;
  ward_number: string | null;
}

export default function SituationIntake() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rawText, setRawText] = useState("");
  const [defaultWard, setDefaultWard] = useState("");
  const [records, setRecords] = useState<ParsedSituationRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [fallbackAgentId, setFallbackAgentId] = useState("");
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  const issueCounts = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const record of records) {
      grouped.set(record.issueType, (grouped.get(record.issueType) || 0) + 1);
    }
    return Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const lowConfidenceCount = useMemo(() => records.filter((r) => r.confidence < 60).length, [records]);

  const loadAgents = async () => {
    if (agentsLoaded) return;
    const { data, error } = await supabase
      .from("agents")
      .select("id, full_name, ward_number")
      .order("ward_number", { ascending: true })
      .order("full_name", { ascending: true });

    if (error) {
      toast({ title: "Failed to load agents", description: error.message, variant: "destructive" });
      return;
    }

    const loaded = (data || []) as AgentOption[];
    setAgents(loaded);
    if (loaded.length && !fallbackAgentId) {
      setFallbackAgentId(loaded[0].id);
    }
    setAgentsLoaded(true);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText(text);
      toast({ title: "Pasted", description: "Raw text copied from clipboard." });
    } catch {
      toast({ title: "Paste failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  };

  const handleParse = () => {
    if (!rawText.trim()) {
      toast({ title: "No input", description: "Paste your ward updates first.", variant: "destructive" });
      return;
    }
    const parsed = parseSituationText(rawText, defaultWard || undefined);
    setRecords(parsed);
    toast({
      title: "Parsing complete",
      description: `${parsed.length} records extracted from pasted updates.`,
    });
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast({ title: "Sign-in required", description: "Please login as operator/admin.", variant: "destructive" });
      return;
    }
    if (!records.length) {
      toast({ title: "Nothing to submit", description: "Parse raw text first.", variant: "destructive" });
      return;
    }
    if (!fallbackAgentId) {
      toast({
        title: "Select fallback agent",
        description: "Choose an agent to attribute records without ward match.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const result = await SituationIntakeService.submitRecords({
      records,
      operatorId: user.id,
      fallbackAgentId,
    });
    setSubmitting(false);

    if (result.errors.length) {
      toast({
        title: "Submit failed",
        description: result.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Situation reports saved",
      description: `${result.inserted} records inserted into live reports.`,
    });
    setRecords([]);
    setRawText("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Situation Intake</h1>
        <p className="text-sm text-muted-foreground">
          Paste raw ward updates. The system classifies issues and pushes structured records to the live dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raw Text Intake</CardTitle>
          <CardDescription>Use one message per line. Messy text is accepted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-ward">Default Ward (optional)</Label>
              <Input
                id="default-ward"
                placeholder="e.g. 01 or Garki"
                value={defaultWard}
                onChange={(e) => setDefaultWard(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fallback Agent (required for submit)</Label>
              <Select
                value={fallbackAgentId}
                onOpenChange={(open) => open && loadAgents()}
                onValueChange={setFallbackAgentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fallback agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name} {agent.ward_number ? `(Ward ${agent.ward_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="min-h-[240px] font-mono text-sm"
            placeholder="PU 163 no INEC yet, 11:15am
Olympia Estate officials just arrived
Ward 03 materials delayed at Unit 021"
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePaste}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Paste
            </Button>
            <Button onClick={handleParse}>
              <Wand2 className="mr-2 h-4 w-4" />
              Parse Text
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !records.length}>
              <UploadCloud className="mr-2 h-4 w-4" />
              {submitting ? "Submitting..." : "Submit to Live Reports"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Parsed Preview</TabsTrigger>
          <TabsTrigger value="summary">Issue Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Structured Records</CardTitle>
              <CardDescription>
                {records.length} extracted record(s). {lowConfidenceCount} need manual review (confidence under 60%).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parsed records yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ward</TableHead>
                      <TableHead>PU</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record, index) => (
                      <TableRow key={`${record.note}-${index}`}>
                        <TableCell>{record.wardNumber || record.wardLabel || "-"}</TableCell>
                        <TableCell>{record.pollingUnitNumber || "-"}</TableCell>
                        <TableCell className="font-medium">{record.issueType}</TableCell>
                        <TableCell>
                          <Badge variant={record.severity === "critical" ? "destructive" : "outline"}>{record.severity}</Badge>
                        </TableCell>
                        <TableCell>{record.status}</TableCell>
                        <TableCell>
                          <Badge variant={record.confidence >= 60 ? "secondary" : "destructive"}>{record.confidence}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Classification Summary</CardTitle>
              <CardDescription>Quick aggregate before submission.</CardDescription>
            </CardHeader>
            <CardContent>
              {issueCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No issue classifications yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {issueCounts.map(([issue, count]) => (
                    <Badge key={issue} variant="secondary">
                      {issue}: {count}
                    </Badge>
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
