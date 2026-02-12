import { supabase } from '../lib/supabase';
import { OfflineDatabase } from './OfflineDatabase';
import NetInfo from '@react-native-community/netinfo';
import type { Report, Broadcast, Agent } from '../types';

export class SyncService {
  private offlineDB: OfflineDatabase;
  private isOnline: boolean = false;
  private syncInProgress: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(offlineDB: OfflineDatabase) {
    this.offlineDB = offlineDB;
    this.initializeNetworkListener();
  }

  private async initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected && state.isInternetReachable || false;
      
      if (this.isOnline && !this.syncInProgress) {
        this.syncAllData();
      }
    });

    // Initial network check
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected && state.isInternetReachable || false;
  }

  // Start periodic sync
  startPeriodicSync(intervalMinutes: number = 5) {
    this.stopPeriodicSync();
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncAllData();
      }
    }, intervalMinutes * 60 * 1000);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Main sync function
  async syncAllData(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log('Starting data synchronization...');

    try {
      // Sync unsynced reports
      await this.syncReports();
      
      // Sync agent data
      await this.syncAgentData();
      
      // Sync broadcasts
      await this.syncBroadcasts();

      // Process sync queue
      await this.processSyncQueue();

      console.log('Data synchronization completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync offline reports
  private async syncReports(): Promise<void> {
    const unsyncedReports = await this.offlineDB.getUnsyncedReports();
    
    for (const report of unsyncedReports) {
      try {
        const { error } = await supabase.from('reports').insert({
          agent_id: report.agent_id,
          operator_id: null, // Field agents don't specify operators
          report_type: report.report_type,
          details: report.details,
          ward_number: report.ward_number,
          location_lat: report.location_lat,
          location_lng: report.location_lng,
          created_at: report.created_at,
        });

        if (error) {
          throw error;
        }

        // Mark as synced
        await this.offlineDB.markReportSynced(report.id!);
        console.log('Report synced:', report.id);
      } catch (error) {
        console.error('Failed to sync report:', report.id, error);
        await this.offlineDB.updateReportSyncError(report.id!, error.message);
      }
    }
  }

  // Sync agent data
  private async syncAgentData(): Promise<void> {
    // This would sync agent data from server to local cache
    // For now, agents are cached during authentication
    console.log('Agent data sync completed');
  }

  // Sync broadcasts
  private async syncBroadcasts(): Promise<void> {
    try {
      const { data: broadcasts, error } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      for (const broadcast of broadcasts || []) {
        await this.offlineDB.cacheBroadcast(broadcast);
      }

      console.log('Broadcasts sync completed');
    } catch (error) {
      console.error('Failed to sync broadcasts:', error);
    }
  }

  // Process sync queue
  private async processSyncQueue(): Promise<void> {
    const queueItems = await this.offlineDB.getSyncQueue();
    
    for (const item of queueItems) {
      try {
        switch (item.type) {
          case 'report_update':
            await this.processReportUpdate(item.data);
            break;
          case 'agent_status_update':
            await this.processAgentStatusUpdate(item.data);
            break;
          default:
            console.warn('Unknown sync queue item type:', item.type);
        }

        await this.offlineDB.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error('Failed to process queue item:', item.id, error);
        await this.offlineDB.updateSyncQueueError(item.id, error.message);
      }
    }
  }

  private async processReportUpdate(data: any): Promise<void> {
    // Process report update from queue
    const { error } = await supabase
      .from('reports')
      .update(data.updates)
      .eq('id', data.reportId);

    if (error) throw error;
  }

  private async processAgentStatusUpdate(data: any): Promise<void> {
    // Process agent status update from queue
    const { error } = await supabase
      .from('agents')
      .update(data.updates)
      .eq('id', data.agentId);

    if (error) throw error;
  }

  // Manual sync trigger
  async forceSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('No internet connection available');
    }

    await this.syncAllData();
  }

  // Get sync status
  async getSyncStatus() {
    const stats = await this.offlineDB.getOfflineStats();
    const networkState = await NetInfo.fetch();

    return {
      isOnline: this.isOnline,
      isConnected: networkState.isConnected,
      isInternetReachable: networkState.isInternetReachable,
      syncInProgress: this.syncInProgress,
      unsyncedReports: stats.unsyncedReports,
      cachedBroadcasts: stats.cachedBroadcasts,
      queueSize: stats.queueSize,
      lastSyncTime: new Date().toISOString() // This could be stored in preferences
    };
  }

  // Cleanup
  destroy() {
    this.stopPeriodicSync();
    this.syncInProgress = false;
  }
}