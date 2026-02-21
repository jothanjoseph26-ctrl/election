import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  CheckCircle, 
  Copy, 
  Clipboard, 
  FileText, 
  ArrowRight,
  Loader2,
  Send,
  Wand2,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseWhatsAppMessage, getPollingUnitId, type ParsedResult } from "@/lib/whatsapp-parser";
import { ElectionResultService } from "@/services/election-result.service";
import { AgentService } from "@/services/agent.service";
import { WARDS_DATA, getWardOptions, getPollingUnitsForWard } from "@/data/wards";

const NIGERIAN_PARTIES = [
  { code: "APC", name: "All Progressives Congress" },
  { code: "PDP", name: "People's Democratic Party" },
  { code: "LP", name: "Labour Party" },
  { code: "NNPP", name: "New Nigeria People's Party" },
  { code: "APGA", name: "All Progressives Grand Alliance" },
  { code: "ADC", name: "African Democratic Congress" },
  { code: "SDP", name: "Social Democratic Party" },
  { code: "AA", name: "Action Alliance" },
];

interface Agent {
  id: string;
  full_name: string;
  ward_number: string;
  ward_name: string;
  polling_unit_id: string;
  phone_number: string;
}

export default function EmergencyResultInput() {
  const { toast } = useToast();
  const [pasteText, setPasteText] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    ward_number: "",
    polling_unit_id: "",
    election_type: "governor",
    total_registered_voters: 0,
    total_accredited_voters: 0,
    total_votes_cast: 0,
    valid_votes: 0,
    invalid_votes: 0,
    notes: "",
  });

  const [partyResults, setPartyResults] = useState<Record<string, string>>({});

  const wardOptions = getWardOptions();

  const loadAgents = async (wardNumber?: string) => {
    setLoading(true);
    try {
      let allAgents: Agent[];
      if (wardNumber) {
        allAgents = await AgentService.getAgentsByWard(wardNumber);
      } else {
        allAgents = await AgentService.getAllAgents();
      }
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
      agent.ward_number?.includes(query) ||
      agent.phone_number?.includes(query)
    );
  });

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasteText(text);
      const parsed = parseWhatsAppMessage(text);
      setParsedResult(parsed);

      if (parsed.wardNumber) {
        setFormData(prev => ({ ...prev, ward_number: parsed.wardNumber! }));
      }
      if (parsed.pollingUnitNumber) {
        const puId = getPollingUnitId(parsed.wardNumber || "01", parsed.pollingUnitNumber);
        setFormData(prev => ({ ...prev, polling_unit_id: puId }));
      }
      if (parsed.totalRegistered) {
        setFormData(prev => ({ ...prev, total_registered_voters: parsed.totalRegistered! }));
      }
      if (parsed.totalAccredited) {
        setFormData(prev => ({ ...prev, total_accredited_voters: parsed.totalAccredited! }));
      }
      if (parsed.totalVotesCast) {
        setFormData(prev => ({ ...prev, total_votes_cast: parsed.totalVotesCast! }));
      }
      if (parsed.validVotes) {
        setFormData(prev => ({ ...prev, valid_votes: parsed.validVotes! }));
      }
      if (parsed.invalidVotes) {
        setFormData(prev => ({ ...prev, invalid_votes: parsed.invalidVotes! }));
      }
      setPartyResults(parsed.partyResults);

      toast({
        title: "Message parsed",
        description: `Extracted data with ${parsedResult?.confidence || parsed.confidence}% confidence`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to read clipboard",
        variant: "destructive",
      });
    }
  };

  const handleParse = () => {
    if (!pasteText.trim()) {
      toast({
        title: "Error",
        description: "Please paste a WhatsApp message first",
        variant: "destructive",
      });
      return;
    }

    const parsed = parseWhatsAppMessage(pasteText);
    setParsedResult(parsed);

    if (parsed.wardNumber) {
      setFormData(prev => ({ ...prev, ward_number: parsed.wardNumber! }));
    }
    if (parsed.pollingUnitNumber) {
      const puId = getPollingUnitId(parsed.wardNumber || "01", parsed.pollingUnitNumber);
      setFormData(prev => ({ ...prev, polling_unit_id: puId }));
    }
    if (parsed.totalRegistered) {
      setFormData(prev => ({ ...prev, total_registered_voters: parsed.totalRegistered! }));
    }
    if (parsed.totalAccredited) {
      setFormData(prev => ({ ...prev, total_accredited_voters: parsed.totalAccredited! }));
    }
    if (parsed.totalVotesCast) {
      setFormData(prev => ({ ...prev, total_votes_cast: parsed.totalVotesCast! }));
    }
    if (parsed.validVotes) {
      setFormData(prev => ({ ...prev, valid_votes: parsed.validVotes! }));
    }
    if (parsed.invalidVotes) {
      setFormData(prev => ({ ...prev, invalid_votes: parsed.invalidVotes! }));
    }
    setPartyResults(parsed.partyResults);

    toast({
      title: "Message parsed",
      description: `Extracted data with ${parsed.confidence}% confidence`,
    });
  };

  const selectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setFormData(prev => ({
      ...prev,
      ward_number: agent.ward_number || "",
      polling_unit_id: agent.polling_unit_id || "",
    }));
    toast({
      title: "Agent selected",
      description: `Selected: ${agent.full_name} - Ward ${agent.ward_number}`,
    });
  };

  const handleSubmit = async () => {
    if (!formData.ward_number || !formData.polling_unit_id) {
      toast({
        title: "Error",
        description: "Please select ward and polling unit",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const agentId = selectedAgent?.id || "admin-manual-entry";

    const partyVotes: Record<string, number> = {};
    NIGERIAN_PARTIES.forEach(party => {
      const votes = partyResults[party.code];
      if (votes && parseInt(votes) > 0) {
        partyVotes[party.code] = parseInt(votes);
      }
    });

    const { success, error } = await ElectionResultService.submitResult({
      agent_id: agentId,
      polling_unit_id: formData.polling_unit_id,
      ward_id: formData.ward_number,
      election_type: formData.election_type,
      total_registered_voters: formData.total_registered_voters,
      total_accredited_voters: formData.total_accredited_voters,
      total_votes_cast: formData.total_votes_cast,
      valid_votes: formData.valid_votes,
      invalid_votes: formData.invalid_votes,
      party_results: partyVotes,
      notes: selectedAgent ? formData.notes : `Admin manual entry for ${formData.ward_number}/${formData.polling_unit_id}`,
    });

    if (success) {
      toast({
        title: "Result submitted",
        description: selectedAgent ? `Successfully submitted for ${selectedAgent.full_name}` : "Successfully submitted (admin manual entry)",
      });
      setFormData({
        ward_number: "",
        polling_unit_id: "",
        election_type: "governor",
        total_registered_voters: 0,
        total_accredited_voters: 0,
        total_votes_cast: 0,
        valid_votes: 0,
        invalid_votes: 0,
        notes: "",
      });
      setPartyResults({});
      setPasteText("");
      setParsedResult(null);
      setSelectedAgent(null);
    } else {
      toast({
        title: "Submission failed",
        description: error,
        variant: "destructive",
      });
    }

    setSubmitting(false);
  };

  const pollingUnits = formData.ward_number ? getPollingUnitsForWard(formData.ward_number) : [];

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "bg-green-500";
    if (confidence >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Result Entry</h1>
            <p className="text-gray-600">Paste WhatsApp results or select agent manually</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clipboard className="h-5 w-5" />
                  Paste WhatsApp Message
                </CardTitle>
                <CardDescription>
                  Copy result from WhatsApp and paste here. The system will auto-extract the data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste WhatsApp message here...&#10;&#10;Example:&#10;Ward 01 PU 001&#10;Registered: 500&#10;Accredited: 350&#10;APC: 200&#10;PDP: 120&#10;LP: 30"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={handlePaste} variant="outline" className="flex-1">
                    <Clipboard className="mr-2 h-4 w-4" />
                    Paste from Clipboard
                  </Button>
                  <Button onClick={handleParse} className="flex-1 bg-orange-600 hover:bg-orange-700">
                    <Wand2 className="mr-2 h-4 w-4" />
                    Parse Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            {parsedResult && (
              <Card className="border-orange-200">
                <CardHeader className="bg-orange-50">
                  <CardTitle className="flex items-center justify-between">
                    <span>Parsed Result</span>
                    <Badge className={getConfidenceColor(parsedResult.confidence)}>
                      {parsedResult.confidence}% confidence
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {parsedResult.wardNumber && (
                      <div>
                        <span className="text-muted-foreground">Ward:</span>
                        <p className="font-medium">{parsedResult.wardNumber}</p>
                      </div>
                    )}
                    {parsedResult.pollingUnitNumber && (
                      <div>
                        <span className="text-muted-foreground">PU:</span>
                        <p className="font-medium">{parsedResult.pollingUnitNumber}</p>
                      </div>
                    )}
                    {parsedResult.totalRegistered && (
                      <div>
                        <span className="text-muted-foreground">Registered:</span>
                        <p className="font-medium">{parsedResult.totalRegistered}</p>
                      </div>
                    )}
                    {parsedResult.totalAccredited && (
                      <div>
                        <span className="text-muted-foreground">Accredited:</span>
                        <p className="font-medium">{parsedResult.totalAccredited}</p>
                      </div>
                    )}
                    {parsedResult.totalVotesCast && (
                      <div>
                        <span className="text-muted-foreground">Total Votes:</span>
                        <p className="font-medium">{parsedResult.totalVotesCast}</p>
                      </div>
                    )}
                    {parsedResult.validVotes && (
                      <div>
                        <span className="text-muted-foreground">Valid:</span>
                        <p className="font-medium">{parsedResult.validVotes}</p>
                      </div>
                    )}
                    {parsedResult.invalidVotes && (
                      <div>
                        <span className="text-muted-foreground">Invalid:</span>
                        <p className="font-medium">{parsedResult.invalidVotes}</p>
                      </div>
                    )}
                  </div>
                  {Object.keys(parsedResult.partyResults).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Party Results:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(parsedResult.partyResults).map(([party, votes]) => (
                          <Badge key={party} variant="outline" className="text-sm">
                            {party}: {votes}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Result Details
                </CardTitle>
                <CardDescription>
                  Verify and adjust the extracted data before submission
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ward</Label>
                    <Select 
                      value={formData.ward_number} 
                      onValueChange={(v) => {
                        setFormData(prev => ({ ...prev, ward_number: v, polling_unit_id: "" }));
                        loadAgents(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Ward" />
                      </SelectTrigger>
                      <SelectContent>
                        {wardOptions.map(ward => (
                          <SelectItem key={ward.value} value={ward.value}>
                            {ward.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Polling Unit</Label>
                    <Select 
                      value={formData.polling_unit_id} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, polling_unit_id: v }))}
                      disabled={!formData.ward_number}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Polling Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {pollingUnits.map(pu => (
                          <SelectItem key={pu.value} value={pu.value}>
                            {pu.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Registered</Label>
                    <Input
                      type="number"
                      value={formData.total_registered_voters}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_registered_voters: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Accredited</Label>
                    <Input
                      type="number"
                      value={formData.total_accredited_voters}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_accredited_voters: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Votes</Label>
                    <Input
                      type="number"
                      value={formData.total_votes_cast}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_votes_cast: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valid</Label>
                    <Input
                      type="number"
                      value={formData.valid_votes}
                      onChange={(e) => setFormData(prev => ({ ...prev, valid_votes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Invalid</Label>
                    <Input
                      type="number"
                      value={formData.invalid_votes}
                      onChange={(e) => setFormData(prev => ({ ...prev, invalid_votes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium mb-3 block">Party Results</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {NIGERIAN_PARTIES.map(party => (
                      <div key={party.code} className="flex items-center gap-2">
                        <Label className="w-20 font-medium">{party.code}</Label>
                        <Input
                          type="number"
                          placeholder="Votes"
                          value={partyResults[party.code] || ""}
                          onChange={(e) => setPartyResults(p => ({ ...p, [party.code]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any observations..."
                  />
                </div>

                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Result
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Select Agent
                </CardTitle>
                <CardDescription>
                  Select the ward agent to submit result for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search by name, ward or phone..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.length >= 2 && agents.length === 0) {
                      loadAgents();
                    }
                  }}
                />
                
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredAgents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {searchQuery ? "No agents found" : "Search for agents to select"}
                      </p>
                    ) : (
                      filteredAgents.slice(0, 50).map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => selectAgent(agent)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedAgent?.id === agent.id
                              ? "border-green-500 bg-green-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <p className="font-medium">{agent.full_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">Ward {agent.ward_number}</Badge>
                            {agent.phone_number && (
                              <span className="text-xs text-muted-foreground">{agent.phone_number}</span>
                            )}
                          </div>
                          {agent.polling_unit_id && (
                            <p className="text-xs text-muted-foreground mt-1">{agent.polling_unit_id}</p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedAgent && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-800">Selected Agent</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{selectedAgent.full_name}</p>
                  <p className="text-sm text-green-700">Ward {selectedAgent.ward_number}</p>
                  {selectedAgent.polling_unit_id && (
                    <p className="text-sm text-green-700">{selectedAgent.polling_unit_id}</p>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setSelectedAgent(null)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Selection
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
