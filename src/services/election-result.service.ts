import { supabase } from "@/integrations/supabase/client";

export class ElectionResultService {
  static async submitResult(data: {
    agent_id: string;
    polling_unit_id: string;
    ward_id: string;
    election_type: string;
    total_registered_voters: number;
    total_accredited_voters: number;
    total_votes_cast: number;
    valid_votes: number;
    invalid_votes: number;
    party_results: Record<string, number>;
    result_image_url?: string;
    result_image_public_id?: string;
    notes?: string;
  }): Promise<{ success: boolean; error: string | null; id?: string }> {
    const { data: result, error } = await (supabase as any)
      .from("election_results")
      .insert(data)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, error: null, id: result?.id };
  }

  static async getResultsByAgent(agentId: string): Promise<any[]> {
    const { data } = await (supabase as any)
      .from("election_results")
      .select("*")
      .eq("agent_id", agentId)
      .order("submitted_at", { ascending: false });
    
    return data || [];
  }

  static async getResultsByWard(wardId: string): Promise<any[]> {
    const { data } = await (supabase as any)
      .from("election_results")
      .select("*")
      .eq("ward_id", wardId)
      .order("submitted_at", { ascending: false });
    
    return data || [];
  }

  static async getAllResults(): Promise<any[]> {
    const { data } = await (supabase as any)
      .from("election_results")
      .select("*")
      .order("submitted_at", { ascending: false });
    
    return data || [];
  }

  static async getResultsWithDetails() {
    const { data, error } = await (supabase as any)
      .from("election_results")
      .select(`
        *,
        agents (
          id,
          full_name,
          phone_number,
          ward_name
        ),
        polling_units (
          id,
          unit_number,
          unit_name,
          location
        ),
        wards (
          id,
          ward_number,
          ward_name
        )
      `)
      .order("submitted_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  static async verifyResult(resultId: string, userId: string): Promise<{ success: boolean; error: string | null }> {
    const { error } = await (supabase as any)
      .from("election_results")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: userId
      })
      .eq("id", resultId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  }

  static async subscribeToResults(callback: (payload: any) => void) {
    return supabase
      .channel("election_results")
      .on("postgres_changes", { event: "*", schema: "public", table: "election_results" }, callback)
      .subscribe();
  }

  static async getWardStats(wardId: string) {
    const { data: results, error } = await (supabase as any)
      .from("election_results")
      .select("status, total_votes_cast, valid_votes, invalid_votes")
      .eq("ward_id", wardId);

    if (error) return { data: null, error: error.message };

    const stats = {
      total: results?.length || 0,
      pending: 0,
      verified: 0,
      rejected: 0,
      totalVotes: 0,
      validVotes: 0,
      invalidVotes: 0
    };

    results?.forEach((r: any) => {
      if (r.status === "pending") stats.pending++;
      else if (r.status === "verified") stats.verified++;
      else if (r.status === "rejected") stats.rejected++;
      stats.totalVotes += r.total_votes_cast || 0;
      stats.validVotes += r.valid_votes || 0;
      stats.invalidVotes += r.invalid_votes || 0;
    });

    return { data: stats, error: null };
  }

  static async getOverallStats() {
    const { data: results, error } = await (supabase as any)
      .from("election_results")
      .select("status, total_votes_cast, valid_votes, invalid_votes, ward_id");

    if (error) return { data: null, error: error.message };

    const stats = {
      total: results?.length || 0,
      pending: 0,
      verified: 0,
      rejected: 0,
      totalVotes: 0,
      validVotes: 0,
      invalidVotes: 0,
      byWard: {} as Record<string, { submitted: number; verified: number; votes: number }>
    };

    results?.forEach((r: any) => {
      if (r.status === "pending") stats.pending++;
      else if (r.status === "verified") stats.verified++;
      else if (r.status === "rejected") stats.rejected++;
      stats.totalVotes += r.total_votes_cast || 0;
      stats.validVotes += r.valid_votes || 0;
      stats.invalidVotes += r.invalid_votes || 0;

      if (r.ward_id) {
        if (!stats.byWard[r.ward_id]) {
          stats.byWard[r.ward_id] = { submitted: 0, verified: 0, votes: 0 };
        }
        stats.byWard[r.ward_id].submitted++;
        if (r.status === "verified") stats.byWard[r.ward_id].verified++;
        stats.byWard[r.ward_id].votes += r.total_votes_cast || 0;
      }
    });

    return { data: stats, error: null };
  }
}

export class WardService {
  static async getAllWards(): Promise<any[]> {
    const { data } = await (supabase as any)
      .from("wards")
      .select("*")
      .order("ward_number", { ascending: true });
    return data || [];
  }

  static async getWardById(wardId: string): Promise<any> {
    const { data } = await (supabase as any)
      .from("wards")
      .select("*")
      .eq("id", wardId)
      .maybeSingle();
    return data;
  }

  static async getWardByNumber(wardNumber: string): Promise<any> {
    const { data } = await (supabase as any)
      .from("wards")
      .select("*")
      .eq("ward_number", wardNumber)
      .maybeSingle();
    return data;
  }
}

export class PollingUnitService {
  static async getPollingUnitsByWard(wardId: string): Promise<any[]> {
    const { data } = await (supabase as any)
      .from("polling_units")
      .select("*")
      .eq("ward_id", wardId)
      .order("unit_number", { ascending: true });
    return data || [];
  }

  static async getAllPollingUnits(): Promise<any[]> {
    const { data } = await (supabase as any)
      .from("polling_units")
      .select(`
        *,
        wards (
          ward_number,
          ward_name
        )
      `)
      .order("unit_number", { ascending: true });
    return data || [];
  }

  static async getPollingUnitById(unitId: string): Promise<any> {
    const { data } = await (supabase as any)
      .from("polling_units")
      .select("*")
      .eq("id", unitId)
      .maybeSingle();
    return data;
  }
}
