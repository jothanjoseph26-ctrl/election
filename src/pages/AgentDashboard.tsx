import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAgent } from "./AgentLogin";
import { AgentService } from "@/services/agent.service";
import { ElectionResultService } from "@/services/election-result.service";
import { WARDS_DATA, getWardOptions, getPollingUnitsForWard } from "@/data/wards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, MapPin, Vote, Save, LogOut, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageLoading } from "@/components/LoadingState";

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

export default function AgentDashboard() {
  const { agent, logout, refreshAgent } = useAgent();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const wardOptions = getWardOptions();

  const [profile, setProfile] = useState({
    full_name: "",
    phone_number: "",
    ward_number: "",
    ward_name: "",
    polling_unit_id: "",
    account_number: "",
    bank_name: "",
  });

  const [result, setResult] = useState({
    election_type: "governor",
    total_registered_voters: 0,
    total_accredited_voters: 0,
    total_votes_cast: 0,
    valid_votes: 0,
    invalid_votes: 0,
    notes: "",
  });

  const [partyResults, setPartyResults] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!agent) {
      navigate("/agent/login");
      return;
    }
    loadData();
  }, [agent]);

  const loadData = () => {
    setLoading(true);
    try {
      const ward = WARDS_DATA.find(w => w.wardNumber === agent?.ward_number);
      
      setProfile({
        full_name: agent?.full_name || "",
        phone_number: agent?.phone_number || "",
        ward_number: agent?.ward_number || "",
        ward_name: agent?.ward_name || ward?.wardName || "",
        polling_unit_id: agent?.polling_unit_id || "",
        account_number: agent?.account_number || "",
        bank_name: agent?.bank_name || "",
      });
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const handleWardChange = (wardNumber: string) => {
    const ward = WARDS_DATA.find(w => w.wardNumber === wardNumber);
    setProfile(prev => ({
      ...prev,
      ward_number: wardNumber,
      ward_name: ward?.wardName || "",
      polling_unit_id: ""
    }));
  };

  const handleSaveProfile = async () => {
    if (!agent?.id) return;
    setSaving(true);

    const { success, error } = await AgentService.updateProfile(agent.id, {
      full_name: profile.full_name,
      phone_number: profile.phone_number,
      ward_number: profile.ward_number,
      ward_name: profile.ward_name,
      polling_unit_id: profile.polling_unit_id || null,
      account_number: profile.account_number || null,
      bank_name: profile.bank_name || null,
    });

    if (success) {
      await refreshAgent();
      setTimeout(async () => {
        await refreshAgent();
        window.location.reload();
      }, 500);
      toast({ title: "Profile updated", description: "Profile saved successfully. Reloading..." });
    } else {
      toast({ title: "Update failed", description: error, variant: "destructive" });
    }
    setSaving(false);
  };

  // Check if profile is complete - use profile state which is updated by loadData
  const isProfileComplete = !!(profile.ward_number && profile.polling_unit_id);

  const handleSubmitResult = async () => {
    console.log("Submit result - profile:", profile, "isComplete:", isProfileComplete);
    if (!agent?.id || !isProfileComplete) {
      toast({ 
        title: "Cannot submit", 
        description: "Please ensure you have selected a ward and polling unit first.", 
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);

    const partyVotes: Record<string, number> = {};
    NIGERIAN_PARTIES.forEach(party => {
      const votes = partyResults[party.code];
      if (votes && parseInt(votes) > 0) {
        partyVotes[party.code] = parseInt(votes);
      }
    });

    const ward = WARDS_DATA.find(w => w.wardNumber === agent.ward_number);
    const pollingUnit = ward?.pollingUnits.find(pu => `${ward.wardNumber}-${pu.unitNumber}` === agent.polling_unit_id);

    const { success, error } = await ElectionResultService.submitResult({
      agent_id: agent.id,
      polling_unit_id: agent.polling_unit_id,
      ward_id: agent.ward_number || "",
      election_type: result.election_type,
      total_registered_voters: result.total_registered_voters,
      total_accredited_voters: result.total_accredited_voters,
      total_votes_cast: result.total_votes_cast,
      valid_votes: result.valid_votes,
      invalid_votes: result.invalid_votes,
      party_results: partyVotes,
      notes: result.notes,
    });

    if (success) {
      toast({ title: "Result submitted", description: "Election result has been submitted successfully." });
      setResult({
        election_type: "governor",
        total_registered_voters: 0,
        total_accredited_voters: 0,
        total_votes_cast: 0,
        valid_votes: 0,
        invalid_votes: 0,
        notes: "",
      });
      setPartyResults({});
    } else {
      toast({ title: "Submission failed", description: error, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/agent/login");
  };

  const pollingUnits = profile.ward_number ? getPollingUnitsForWard(profile.ward_number) : [];

  const getSelectedPollingUnitName = () => {
    if (!profile.polling_unit_id) return "";
    const ward = WARDS_DATA.find(w => w.wardNumber === profile.ward_number);
    const pu = ward?.pollingUnits.find(p => `${ward.wardNumber}-${p.unitNumber}` === profile.polling_unit_id);
    return pu ? `PU ${pu.unitNumber}: ${pu.unitName}` : "";
  };

  if (loading) return <PageLoading text="Loading..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
            <p className="text-gray-600">Welcome, {agent?.full_name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="results">Submit Results</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Update Your Information
                </CardTitle>
                <CardDescription>Keep your details up to date for payment and communication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input 
                      id="full_name" 
                      value={profile.full_name}
                      onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      type="tel"
                      value={profile.phone_number}
                      onChange={(e) => setProfile(p => ({ ...p, phone_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ward">Ward</Label>
                    <Select value={profile.ward_number} onValueChange={handleWardChange}>
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
                    <Label htmlFor="polling_unit">Polling Unit</Label>
                    <Select 
                      value={profile.polling_unit_id} 
                      onValueChange={(v) => setProfile(p => ({ ...p, polling_unit_id: v }))}
                      disabled={!profile.ward_number}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={profile.ward_number ? "Select Polling Unit" : "Select Ward first"} />
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
                  <div className="space-y-2">
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input 
                      id="account_number" 
                      value={profile.account_number}
                      onChange={(e) => setProfile(p => ({ ...p, account_number: e.target.value }))}
                      maxLength={10}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Select value={profile.bank_name} onValueChange={(v) => setProfile(p => ({ ...p, bank_name: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Access Bank">Access Bank</SelectItem>
                        <SelectItem value="Fidelity Bank">Fidelity Bank</SelectItem>
                        <SelectItem value="First Bank">First Bank</SelectItem>
                        <SelectItem value="GTBank">GTBank</SelectItem>
                        <SelectItem value="Keystone Bank">Keystone Bank</SelectItem>
                        <SelectItem value="Sterling Bank">Sterling Bank</SelectItem>
                        <SelectItem value="UBA">UBA</SelectItem>
                        <SelectItem value="Union Bank">Union Bank</SelectItem>
                        <SelectItem value="Zenith Bank">Zenith Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Vote className="mr-2 h-5 w-5" />
                  Submit Election Result
                </CardTitle>
                <CardDescription>Enter the results from your polling unit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : !isProfileComplete ? (
                  <div className="text-center py-8 text-amber-600">
                    <MapPin className="mx-auto h-12 w-12 mb-4" />
                    <p className="font-medium">Please complete your profile first</p>
                    <p className="text-sm">Select your Ward and Polling Unit in the Profile tab before submitting results.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-blue-800">
                        Submitting for: {agent?.ward_name || profile.ward_name} - {(agent as any)?.polling_unit_id || profile.polling_unit_id}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="space-y-2">
                          <Label>Registered Voters</Label>
                          <Input 
                            type="number"
                            value={result.total_registered_voters}
                            onChange={(e) => setResult(r => ({ ...r, total_registered_voters: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Accredited Voters</Label>
                          <Input 
                            type="number"
                            value={result.total_accredited_voters}
                            onChange={(e) => setResult(r => ({ ...r, total_accredited_voters: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total Votes Cast</Label>
                          <Input 
                            type="number"
                            value={result.total_votes_cast}
                            onChange={(e) => setResult(r => ({ ...r, total_votes_cast: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valid Votes</Label>
                          <Input 
                            type="number"
                            value={result.valid_votes}
                            onChange={(e) => setResult(r => ({ ...r, valid_votes: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Invalid Votes</Label>
                          <Input 
                            type="number"
                            value={result.invalid_votes}
                            onChange={(e) => setResult(r => ({ ...r, invalid_votes: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-base font-medium mb-3 block">Party Results</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {NIGERIAN_PARTIES.map(party => (
                            <div key={party.code} className="flex items-center gap-2">
                              <Label className="w-24 font-medium">{party.code}</Label>
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
                        <Label>Notes (Optional)</Label>
                        <Input 
                          value={result.notes}
                          onChange={(e) => setResult(r => ({ ...r, notes: e.target.value }))}
                          placeholder="Any observations or issues..."
                        />
                      </div>

                      <Button onClick={handleSubmitResult} disabled={saving} className="w-full">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {saving ? "Submitting..." : "Submit Result"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
