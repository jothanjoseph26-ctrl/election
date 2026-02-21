import { useState, useRef } from "react";
import { createWorker } from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

export default function ResultScanner({ onExtract }: ResultScannerProps) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedResult | null>(null);
  const [manualInput, setManualInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseExtractedText = (text: string): ExtractedResult => {
    const result: ExtractedResult = {
      partyResults: {}
    };

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      
      if (upperLine.includes("REGISTERED") || upperLine.includes("TOTAL REGISTERED")) {
        const match = line.match(/\d+/);
        if (match) result.totalRegistered = parseInt(match[0].replace(/,/g, ""));
      }
      if (upperLine.includes("ACCREDITED")) {
        const match = line.match(/\d+/);
        if (match) result.totalAccredited = parseInt(match[0].replace(/,/g, ""));
      }
      if (upperLine.includes("VOTES CAST") || upperLine.includes("TOTAL VOTES")) {
        const match = line.match(/\d+/);
        if (match) result.totalVotesCast = parseInt(match[0].replace(/,/g, ""));
      }
      if (upperLine.includes("VALID")) {
        const match = line.match(/\d+/);
        if (match) result.validVotes = parseInt(match[0].replace(/,/g, ""));
      }
      if (upperLine.includes("INVALID") || upperLine.includes("REJECTED")) {
        const match = line.match(/\d+/);
        if (match) result.invalidVotes = parseInt(match[0].replace(/,/g, ""));
      }

      for (const party of NIGERIAN_PARTIES) {
        if (upperLine.includes(party.code) || upperLine.includes(party.name.toUpperCase())) {
          const matches = line.match(/\d+/g);
          if (matches && matches.length > 0) {
            const voteCount = parseInt(matches[matches.length - 1].replace(/,/g, ""));
            if (voteCount > 0 && voteCount < 1000000) {
              result.partyResults = result.partyResults || {};
              result.partyResults[party.code] = voteCount;
            }
          }
        }
      }
    }

    return result;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        setExtractedData(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!imagePreview) return;

    setScanning(true);
    setProgress(0);
    setStatus("Initializing OCR engine...");

    try {
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
            setStatus(`Scanning... ${Math.round(m.progress * 100)}%`);
          } else {
            setStatus(m.status);
          }
        },
      });

      setStatus("Processing image...");
      const { data: { text } } = await worker.recognize(imagePreview);
      
      setStatus("Parsing results...");
      const parsed = parseExtractedText(text);
      parsed.rawText = text;
      
      setExtractedData(parsed);
      setStatus("Scan complete!");

      if (Object.keys(parsed.partyResults || {}).length === 0 && !parsed.totalVotesCast) {
        toast({
          title: "Low confidence scan",
          description: "Could not automatically detect results. Please check the raw text or enter manually.",
        });
      } else {
        toast({
          title: "Scan complete",
          description: `Detected ${Object.keys(parsed.partyResults || {}).length} party results`,
        });
      }

      await worker.terminate();
    } catch (error) {
      console.error("OCR Error:", error);
      toast({
        title: "Scan failed",
        description: "Could not process the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const handleManualParse = () => {
    if (!manualInput.trim()) return;

    const extracted = parseExtractedText(manualInput);
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
    setProgress(0);
    setStatus("");
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
        <CardDescription>Upload an image or paste text to extract results using AI OCR</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {imagePreview ? (
                <div className="space-y-4">
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded" />
                  {scanning ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center text-primary">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>{status}</span>
                      </div>
                      <Progress value={progress} className="w-full" />
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

            {!scanning && imagePreview && (
              <Button onClick={handleScan} className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Scan with AI
              </Button>
            )}

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

                {extractedData.rawText && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500">View raw extracted text</summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto whitespace-pre-wrap">
                      {extractedData.rawText}
                    </pre>
                  </details>
                )}
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
