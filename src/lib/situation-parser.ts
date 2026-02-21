export type SituationIssueType =
  | "logistics_delay"
  | "official_absent"
  | "material_delay"
  | "security_threat"
  | "bvas_failure"
  | "turnout_update"
  | "operational_status"
  | "resolved"
  | "other";

export type SituationSeverity = "low" | "medium" | "high" | "critical";
export type SituationStatus = "new" | "in_progress" | "resolved";

export interface ParsedSituationRecord {
  wardNumber: string | null;
  wardLabel: string | null;
  pollingUnitNumber: string | null;
  timeLabel: string | null;
  issueType: SituationIssueType;
  severity: SituationSeverity;
  status: SituationStatus;
  reportType: "turnout_update" | "incident" | "material_shortage" | "emergency" | "other";
  confidence: number;
  note: string;
  rawText: string;
}

const ISSUE_KEYWORDS: Array<{ issue: SituationIssueType; terms: string[] }> = [
  { issue: "security_threat", terms: ["security", "violence", "fight", "threat", "attack", "snatch"] },
  { issue: "bvas_failure", terms: ["bvas", "machine failed", "device failed", "biometric"] },
  { issue: "official_absent", terms: ["no inec", "official not present", "no official", "official absent"] },
  { issue: "material_delay", terms: ["material delay", "materials delay", "materials not arrived", "ballot delay"] },
  { issue: "logistics_delay", terms: ["logistics", "vehicle", "transport", "delayed", "delay"] },
  { issue: "turnout_update", terms: ["turnout", "crowd", "voters coming", "peak", "accredited"] },
  { issue: "operational_status", terms: ["voting started", "started", "operational", "open", "officials arrived"] },
  { issue: "resolved", terms: ["resolved", "fixed", "restored", "normal now"] },
];

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractWardLabel(text: string): string | null {
  const afterWard = text.match(/\bward\b[\s:,-]*([a-z0-9 ]{1,30})/i);
  if (afterWard?.[1]) {
    const cleaned = normalizeText(afterWard[1]).replace(/[^\w ]/g, "");
    if (cleaned && !/^\d+$/.test(cleaned)) return toTitleCase(cleaned);
  }

  const beforeWard = text.match(/\b([a-z ]{3,30})\s+ward\b/i);
  if (beforeWard?.[1]) {
    const cleaned = normalizeText(beforeWard[1]).replace(/[^\w ]/g, "");
    if (cleaned) return toTitleCase(cleaned);
  }

  return null;
}

function extractWardNumber(text: string): string | null {
  const direct = text.match(/\bward\b[\s:,-]*(\d{1,2})\b/i);
  if (direct?.[1]) return direct[1].padStart(2, "0");

  const standalone = text.match(/\bwd[\s:,-]*(\d{1,2})\b/i);
  if (standalone?.[1]) return standalone[1].padStart(2, "0");

  return null;
}

function extractPollingUnitNumber(text: string): string | null {
  const puMatch = text.match(/\b(?:pu|polling unit|unit)\b[\s:,-]*(\d{1,3})\b/i);
  if (puMatch?.[1]) return puMatch[1].padStart(3, "0");
  return null;
}

function extractTime(text: string): string | null {
  const twelveHour = text.match(/\b(\d{1,2}:\d{2}\s?(?:am|pm))\b/i);
  if (twelveHour?.[1]) return twelveHour[1].toUpperCase().replace(/\s+/g, "");

  const twentyFourHour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) return `${twentyFourHour[1].padStart(2, "0")}:${twentyFourHour[2]}`;

  return null;
}

function detectIssueType(text: string): SituationIssueType {
  const normalized = text.toLowerCase();
  for (const entry of ISSUE_KEYWORDS) {
    if (entry.terms.some((term) => normalized.includes(term))) {
      return entry.issue;
    }
  }
  return "other";
}

function detectStatus(text: string, issue: SituationIssueType): SituationStatus {
  const normalized = text.toLowerCase();
  if (issue === "resolved" || normalized.includes("resolved") || normalized.includes("fixed")) {
    return "resolved";
  }
  if (normalized.includes("ongoing") || normalized.includes("handling") || normalized.includes("in progress")) {
    return "in_progress";
  }
  return "new";
}

function detectSeverity(text: string, issue: SituationIssueType): SituationSeverity {
  const normalized = text.toLowerCase();
  if (
    issue === "security_threat" ||
    normalized.includes("attack") ||
    normalized.includes("violence") ||
    normalized.includes("critical")
  ) {
    return "critical";
  }
  if (issue === "bvas_failure" || issue === "official_absent" || normalized.includes("urgent")) {
    return "high";
  }
  if (issue === "material_delay" || issue === "logistics_delay" || issue === "operational_status") {
    return "medium";
  }
  return "low";
}

function toReportType(issue: SituationIssueType, severity: SituationSeverity): ParsedSituationRecord["reportType"] {
  if (issue === "turnout_update" || issue === "operational_status") return "turnout_update";
  if (issue === "material_delay" || issue === "logistics_delay") return "material_shortage";
  if (issue === "security_threat" || (issue === "bvas_failure" && severity === "critical")) return "emergency";
  if (issue === "other") return "other";
  return "incident";
}

function calculateConfidence(record: Omit<ParsedSituationRecord, "confidence" | "reportType">): number {
  let score = 20;
  if (record.wardNumber || record.wardLabel) score += 20;
  if (record.pollingUnitNumber) score += 15;
  if (record.timeLabel) score += 10;
  if (record.issueType !== "other") score += 20;
  if (record.status !== "new") score += 5;
  if (record.note.length >= 12) score += 10;
  return Math.min(score, 100);
}

function parseLine(line: string, wardContext: { number: string | null; label: string | null }): ParsedSituationRecord {
  const cleaned = normalizeText(line);
  const wardNumber = extractWardNumber(cleaned) || wardContext.number;
  const wardLabel = extractWardLabel(cleaned) || wardContext.label;
  const pollingUnitNumber = extractPollingUnitNumber(cleaned);
  const timeLabel = extractTime(cleaned);
  const issueType = detectIssueType(cleaned);
  const status = detectStatus(cleaned, issueType);
  const severity = detectSeverity(cleaned, issueType);

  const draft = {
    wardNumber,
    wardLabel,
    pollingUnitNumber,
    timeLabel,
    issueType,
    severity,
    status,
    note: cleaned,
    rawText: line,
  };

  return {
    ...draft,
    reportType: toReportType(issueType, severity),
    confidence: calculateConfidence(draft),
  };
}

export function parseSituationText(rawText: string, defaultWard?: string): ParsedSituationRecord[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length >= 4);

  const records: ParsedSituationRecord[] = [];
  const context = {
    number: defaultWard && /^\d{1,2}$/.test(defaultWard) ? defaultWard.padStart(2, "0") : null,
    label: defaultWard && !/^\d{1,2}$/.test(defaultWard) ? toTitleCase(defaultWard) : null,
  };

  for (const line of lines) {
    if (/^(total pu|operational|delayed|no officials|security|major concern)\b/i.test(line)) {
      continue;
    }

    const parsed = parseLine(line, context);
    if (!context.number && parsed.wardNumber) context.number = parsed.wardNumber;
    if (!context.label && parsed.wardLabel) context.label = parsed.wardLabel;
    records.push(parsed);
  }

  return records;
}

export function formatSituationDetails(record: ParsedSituationRecord): string {
  const metadata = [
    `[Situation Intake]`,
    `Issue: ${record.issueType}`,
    `Severity: ${record.severity}`,
    `Status: ${record.status}`,
    `Confidence: ${record.confidence}%`,
    record.wardNumber ? `Ward: ${record.wardNumber}` : null,
    record.wardLabel ? `Ward Label: ${record.wardLabel}` : null,
    record.pollingUnitNumber ? `PU: ${record.pollingUnitNumber}` : null,
    record.timeLabel ? `Time: ${record.timeLabel}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return `${metadata}\n${record.note}`;
}
