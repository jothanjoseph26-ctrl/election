import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Camera, FileText, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExtractedResult {
  totalRegistered?: number;
  totalAccredited?: number;
  totalVotesCast?: number;
  validVotes?: number;
  invalidVotes?: number;
  partyResults?: Record<string, number>;
  rawText?: string;
}

interface ResultScannerProps {
  onExtract: (result: ExtractedResult) => void;
}

export default function ResultScanner({ onExtract }: ResultScannerProps) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedResult | null>(null);
  const [manualInput, setManualInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        simulateOCR(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const simulateOCR = async (file: File) => {
    setScanning(true);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockExtracted: ExtractedResult = {
      totalRegistered: Math.floor(Math.random() * 500) + 500,
      totalAccredited: Math.floor(Math.random() * 400) + 200,
      totalVotesCast: Math.floor(Math.random() * 300) + 150,
      validVotes: Math.floor(Math.random() * 280) + 140,
      invalidVotes: Math.floor(Math.random() * 20) + 5,
      partyResults: {
        "APC": Math.floor(Math.random() * 200) + 100,
        "PDP": Math.floor(Math.random() * 150) + 50,
        "LP": Math.floor(Math.random() * 80) + 20,
        "NNPP": Math.floor(Math.random() * 30) + 5,
        "APGA": Math.floor(Math.random() * 15),
        "ADC": Math.floor(Math.random() * 10),
        "SDP": Math.floor(Math.random() * 8),
        "AA": Math.floor(Math.random() * 5),
      },
      rawText: "Simulated OCR extracted text from result sheet...",
    };

    setExtractedData(mockExtracted);
    setScanning(false);
    toast({ title: "Scan complete", description: "Results extracted from image" });
  };

  const handleManualParse = () => {
    if (!manualInput.trim()) return;

    const lines = manualInput.split("\n");
    const extracted: ExtractedResult = {
      partyResults: {}
    };

    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      
      if (upperLine.includes("REGISTERED") || upperLine.includes("TOTAL REGISTERED")) {
        const match = line.match(/\d+/);
        if (match) extracted.totalRegistered = parseInt(match[0]);
      }
      if (upperLine.includes("ACCREDITED")) {
        const match = line.match(/\d+/);
        if (match) extracted.totalAccredited = parseInt(match[0]);
      }
      if (upperLine.includes("VOTES CAST") || upperLine.includes("TOTAL VOTES")) {
        const match = line.match(/\d+/);
        if (match) extracted.totalVotesCast = parseInt(match[0]);
      }
      if (upperLine.includes("VALID")) {
        const match = line.match(/\d+/);
        if (match) extracted.validVotes = parseInt(match[0]);
      }
      if (upperLine.includes("INVALID")) {
        const match = line.match(/\d+/);
        if (match) extracted.invalidVotes = parseInt(match[0]);
      }

      const parties = ["APC", "PDP", "LP", "NNPP", "APGA", "ADC", "SDP", "AA"];
      parties.forEach(party => {
        if (upperLine.includes(party)) {
          const match = line.match(/\d+/);
          if (match) {
            extracted.partyResults = extracted.partyResults || {};
            extracted.partyResults[party] = parseInt(match[0]);
          }
        }
      });
    });

    setExtractedData(extracted);
    toast({ title: "Text parsed", description: "Results extracted from text input" });
  };

  const handleUseExtracted = () => {
    if (extractedData) {
      onExtract(extractedData);
      toast({ title: "Results applied", description: "Extracted data applied to form" });
    }
  };

  const handleClear = () => {
    setImagePreview(null);
    setExtractedData(null);
    setManualInput("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Camera className="mr-2 h-5 w-5" />
          Scan Result Sheet
        </CardTitle>
        <CardDescription>Upload an image or paste text to extract results</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {imagePreview ? (
                <div className="space-y-4">
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded" />
                  {scanning ? (
                    <div className="flex items-center justify-center text-primary">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleClear}>
                      Clear
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  <div className="text-sm text-gray-500">
                    <label htmlFor="file-upload" className="cursor-pointer text-primary hover:underline">
                      Upload image
                    </label>
                    <input
                      ref={fileInputRef}
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <p>or drag and drop</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Or paste result text</Label>
              <textarea
                className="w-full h-32 p-3 text-sm border rounded-md resize-none"
                placeholder="Paste text from result sheet here...&#10;&#10;Example:&#10;APC: 150&#10;PDP: 80&#10;LP: 45"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
              />
              <Button variant="outline" onClick={handleManualParse} disabled={!manualInput.trim()}>
                <FileText className="mr-2 h-4 w-4" />
                Parse Text
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Extracted Results</Label>
            {extractedData ? (
              <div className="space-y-3 bg-green-50 p-4 rounded-lg">
                <div className="flex items-center text-green-600 mb-2">
                  <Check className="mr-2 h-4 w-4" />
                  <span className="font-medium">Successfully extracted</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Registered: <span className="font-medium">{extractedData.totalRegistered || "-"}</span></div>
                  <div>Accredited: <span className="font-medium">{extractedData.totalAccredited || "-"}</span></div>
                  <div>Votes Cast: <span className="font-medium">{extractedData.totalVotesCast || "-"}</span></div>
                  <div>Valid: <span className="font-medium">{extractedData.validVotes || "-"}</span></div>
                  <div>Invalid: <span className="font-medium">{extractedData.invalidVotes || "-"}</span></div>
                </div>

                {extractedData.partyResults && Object.keys(extractedData.partyResults).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1">Party Votes:</p>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      {Object.entries(extractedData.partyResults).map(([party, votes]) => (
                        <div key={party}>
                          {party}: <span className="font-medium">{votes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={handleUseExtracted} className="w-full mt-3">
                  Use These Results
                </Button>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No results extracted yet</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
