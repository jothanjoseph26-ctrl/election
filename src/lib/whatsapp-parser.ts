export interface ParsedResult {
  wardNumber?: string;
  pollingUnitNumber?: string;
  totalRegistered?: number;
  totalAccredited?: number;
  totalVotesCast?: number;
  validVotes?: number;
  invalidVotes?: number;
  partyResults: Record<string, number>;
  rawText: string;
  confidence: number;
}

const PARTY_PATTERNS = [
  { code: "APC", aliases: ["APC", "All Progressives Congress", "APC:"] },
  { code: "PDP", aliases: ["PDP", "People's Democratic Party", "PDP:"] },
  { code: "LP", aliases: ["LP", "Labour Party", "LP:"] },
  { code: "NNPP", aliases: ["NNPP", "New Nigeria People's Party", "NNPP:"] },
  { code: "APGA", aliases: ["APGA", "All Progressives Grand Alliance", "APGA:"] },
  { code: "ADC", aliases: ["ADC", "African Democratic Congress", "ADC:"] },
  { code: "SDP", aliases: ["SDP", "Social Democratic Party", "SDP:"] },
  { code: "AA", aliases: ["AA", "Action Alliance", "AA:"] },
];

function extractNumber(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1].replace(/,/g, "").replace(/\s/g, ""));
      if (!isNaN(num)) return num;
    }
  }
  return undefined;
}

function findPartyVotes(text: string): Record<string, number> {
  const results: Record<string, number> = {};
  const lines = text.split(/[\n\r]+/);

  for (const party of PARTY_PATTERNS) {
    for (const line of lines) {
      for (const alias of party.aliases) {
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`${escapedAlias}[\\s:]*([0-9,]+)`, "i");
        const match = line.match(pattern);
        if (match) {
          const votes = parseInt(match[1].replace(/,/g, ""));
          if (!isNaN(votes)) {
            results[party.code] = votes;
            break;
          }
        }
      }
      if (results[party.code]) break;
    }
  }

  return results;
}

function findWardAndPU(text: string): { ward?: string; pu?: string } {
  const result: { ward?: string; pu?: string } = {};
  
  const wardMatch = text.match(/(?:ward|WARD|Ward)[\s:]*(\d{1,2})/i);
  if (wardMatch) {
    result.ward = wardMatch[1].padStart(2, "0");
  } else {
    const standAloneWard = text.match(/^(\d{1,2})[\s:-]/m);
    if (standAloneWard) {
      result.ward = standAloneWard[1].padStart(2, "0");
    }
  }

  const puMatch = text.match(/(?:PU|Unit|Polling Unit)[\s:]*(\d{1,3})/i);
  if (puMatch) {
    result.pu = puMatch[1].padStart(3, "0");
  } else if (result.ward) {
    const combinedMatch = text.match(/(\d{2})[-](\d{3})/);
    if (combinedMatch) {
      result.ward = combinedMatch[1];
      result.pu = combinedMatch[2];
    }
  }

  return result;
}

export function parseWhatsAppMessage(text: string): ParsedResult {
  const cleanedText = text.trim();
  const result: ParsedResult = {
    partyResults: {},
    rawText: cleanedText,
    confidence: 0,
  };

  const location = findWardAndPU(cleanedText);
  if (location.ward) result.wardNumber = location.ward;
  if (location.pu) result.pollingUnitNumber = location.pu;

  const totalRegisteredPatterns = [
    /(?:total registered|reg\. voters|registered voters|reg voters)[\s:]*([0-9,]+)/i,
    /reg\.?\s*:?\s*([0-9,]+)/i,
  ];
  const regNum = extractNumber(cleanedText, totalRegisteredPatterns);
  if (regNum) result.totalRegistered = regNum;

  const accreditedPatterns = [
    /(?:total accredited|accredited voters|acc\. voters)[\s:]*([0-9,]+)/i,
    /acc\.?\s*:?\s*([0-9,]+)/i,
  ];
  const accNum = extractNumber(cleanedText, accreditedPatterns);
  if (accNum) result.totalAccredited = accNum;

  const totalVotesPatterns = [
    /(?:total votes cast|total votes|votes cast|total ballot)[\s:]*([0-9,]+)/i,
    /(?:ballot papers)[\s:]*([0-9,]+)/i,
  ];
  const totalVotesNum = extractNumber(cleanedText, totalVotesPatterns);
  if (totalVotesNum) result.totalVotesCast = totalVotesNum;

  const validVotesPatterns = [
    /(?:valid votes|valid ballots)[\s:]*([0-9,]+)/i,
    /valid\s*:?\s*([0-9,]+)/i,
  ];
  const validNum = extractNumber(cleanedText, validVotesPatterns);
  if (validNum) result.validVotes = validNum;

  const invalidVotesPatterns = [
    /(?:invalid votes|rejected ballots|invalid ballots)[\s:]*([0-9,]+)/i,
    /invalid\s*:?\s*([0,9,]+)/i,
    /rejected\s*:?\s*([0,9,]+)/i,
  ];
  const invalidNum = extractNumber(cleanedText, invalidVotesPatterns);
  if (invalidNum) result.invalidVotes = invalidNum;

  result.partyResults = findPartyVotes(cleanedText);

  let confidencePoints = 0;
  if (result.wardNumber) confidencePoints += 25;
  if (result.pollingUnitNumber) confidencePoints += 15;
  if (result.totalRegistered) confidencePoints += 10;
  if (result.totalAccredited) confidencePoints += 10;
  if (result.totalVotesCast) confidencePoints += 10;
  if (result.validVotes) confidencePoints += 10;
  if (result.invalidVotes) confidencePoints += 5;
  const partyCount = Object.keys(result.partyResults).length;
  confidencePoints += Math.min(partyCount * 10, 15);

  result.confidence = confidencePoints;

  return result;
}

export function getPollingUnitId(wardNumber: string, unitNumber: string): string {
  return `${wardNumber.padStart(2, "0")}-${unitNumber.padStart(3, "0")}`;
}
