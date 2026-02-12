import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AgentsRow = Tables<"agents">;

export class AgentService {
  static async loginByPhone(phoneNumber: string): Promise<{ agent: any; error: string | null }> {
    const { data, error } = await supabase
      .from("agents")
      .select("*, polling_unit_id, account_number, bank_name")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (error) return { agent: null, error: error.message };
    if (!data) return { agent: null, error: "Agent not found with this phone number" };
    
    return { agent: data, error: null };
  }

  static async loginByPin(pin: string): Promise<{ agent: any; error: string | null }> {
    const { data, error } = await supabase
      .from("agents")
      .select("*, polling_unit_id, account_number, bank_name")
      .eq("pin", pin)
      .maybeSingle();

    if (error) return { agent: null, error: error.message };
    if (!data) return { agent: null, error: "Invalid PIN" };
    
    return { agent: data, error: null };
  }

  static async updateProfile(
    agentId: string, 
    updates: {
      full_name?: string;
      ward_number?: string | null;
      ward_name?: string | null;
      polling_unit_id?: string | null;
      account_number?: string | null;
      bank_name?: string | null;
      phone_number?: string | null;
    }
  ): Promise<{ success: boolean; error: string | null }> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    
    if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
    if (updates.ward_number !== undefined) updateData.ward_number = updates.ward_number;
    if (updates.ward_name !== undefined) updateData.ward_name = updates.ward_name;
    if (updates.phone_number !== undefined) updateData.phone_number = updates.phone_number;
    if (updates.polling_unit_id !== undefined) updateData.polling_unit_id = updates.polling_unit_id;
    if (updates.account_number !== undefined) updateData.account_number = updates.account_number;
    if (updates.bank_name !== undefined) updateData.bank_name = updates.bank_name;

    const { error } = await supabase
      .from("agents")
      .update(updateData)
      .eq("id", agentId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  }

  static async getAgentById(agentId: string): Promise<any | null> {
    const { data } = await supabase
      .from("agents")
      .select("*, polling_unit_id, account_number, bank_name")
      .eq("id", agentId)
      .maybeSingle();
    
    return data;
  }

  static async getAllAgents(): Promise<any[]> {
    const { data } = await supabase
      .from("agents")
      .select("*, polling_unit_id, account_number, bank_name")
      .order("ward_name", { ascending: true })
      .order("full_name", { ascending: true });
    
    return data || [];
  }

  static async getAgentsByWard(wardNumber: string): Promise<any[]> {
    const { data } = await supabase
      .from("agents")
      .select("*, polling_unit_id, account_number, bank_name")
      .eq("ward_number", wardNumber)
      .order("full_name", { ascending: true });
    
    return data || [];
  }

  static async getAgentWithDetails(agentId: string) {
    const { data, error } = await supabase
      .from("agents")
      .select(`
        *,
        polling_units (
          id,
          unit_number,
          unit_name,
          location,
          ward_id,
          wards (
            id,
            ward_number,
            ward_name
          )
        )
      `)
      .eq("id", agentId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }
}
