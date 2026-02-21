import { supabase } from "@/integrations/supabase/client";
import { formatSituationDetails, type ParsedSituationRecord } from "@/lib/situation-parser";

interface SubmitSituationPayload {
  records: ParsedSituationRecord[];
  operatorId: string;
  fallbackAgentId: string;
}

interface SubmitSituationResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export class SituationIntakeService {
  static async submitRecords(payload: SubmitSituationPayload): Promise<SubmitSituationResult> {
    const { records, operatorId, fallbackAgentId } = payload;
    if (!records.length) {
      return { inserted: 0, skipped: 0, errors: ["No parsed records to submit."] };
    }

    const wardNumbers = Array.from(
      new Set(records.map((record) => record.wardNumber).filter((ward): ward is string => Boolean(ward))),
    );

    let wardAgentMap = new Map<string, string>();
    if (wardNumbers.length) {
      const { data: agents, error } = await supabase
        .from("agents")
        .select("id, ward_number")
        .in("ward_number", wardNumbers)
        .order("created_at", { ascending: true });

      if (!error && agents) {
        wardAgentMap = new Map<string, string>();
        for (const agent of agents) {
          if (agent.ward_number && !wardAgentMap.has(agent.ward_number)) {
            wardAgentMap.set(agent.ward_number, agent.id);
          }
        }
      }
    }

    const rows = records.map((record) => ({
      agent_id: (record.wardNumber && wardAgentMap.get(record.wardNumber)) || fallbackAgentId,
      operator_id: operatorId,
      report_type: record.reportType,
      details: formatSituationDetails(record),
      ward_number: record.wardNumber,
    }));

    const { error } = await supabase.from("reports").insert(rows);
    if (error) {
      return { inserted: 0, skipped: records.length, errors: [error.message] };
    }

    return { inserted: rows.length, skipped: 0, errors: [] };
  }
}
