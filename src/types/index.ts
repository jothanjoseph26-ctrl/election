// Type definitions for the mobile app
export interface Agent {
  id: string;
  full_name: string;
  phone_number: string | null;
  pin: string;
  ward_name: string | null;
  ward_number: string | null;
  verification_status: string;
  payment_status: string;
  last_report_at: string | null;
}

export interface Report {
  id: string;
  agent_id: string;
  operator_id: string | null;
  report_type: string;
  details: string;
  ward_number: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  created_at: string;
}

export interface Broadcast {
  id: string;
  message: string;
  priority: string;
  sender_id: string;
  created_at: string;
  read?: boolean;
}

export interface ReportType {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingSyncs: number;
  syncInProgress: boolean;
}

export interface NetworkInfo {
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean;
}