import * as SQLite from 'expo-sqlite';
import type { Report, Agent, Broadcast } from './types';

export class OfflineDatabase {
  private db: SQLite.SQLiteDatabase | null = null;

  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync('amac_field_agent.db');
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

    // Create offline reports table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_reports (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        report_type TEXT NOT NULL,
        details TEXT NOT NULL,
        ward_number TEXT,
        location_lat REAL,
        location_lng REAL,
        created_at TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        sync_error TEXT,
        attempts INTEGER DEFAULT 0
      );
    `);

    // Create cached agent data table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS cached_agents (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone_number TEXT,
        pin TEXT,
        ward_name TEXT,
        ward_number TEXT,
        verification_status TEXT,
        payment_status TEXT,
        last_report_at TEXT,
        cached_at TEXT NOT NULL
      );
    `);

    // Create cached broadcasts table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS cached_broadcasts (
        id TEXT PRIMARY KEY,
        message TEXT NOT NULL,
        priority TEXT NOT NULL,
        sender_id TEXT,
        created_at TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        read INTEGER DEFAULT 0
      );
    `);

    // Create sync queue table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt TEXT,
        error TEXT
      );
    `);

    // Create indexes for performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_offline_reports_synced ON offline_reports(synced);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(type);
      CREATE INDEX IF NOT EXISTS idx_cached_broadcasts_read ON cached_broadcasts(read);
    `);
  }

  // Offline Reports Management
  async saveOfflineReport(report: Partial<Report>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const reportId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.runAsync(
      `INSERT INTO offline_reports (
        id, agent_id, report_type, details, ward_number, 
        location_lat, location_lng, created_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        reportId,
        report.agent_id,
        report.report_type,
        report.details,
        report.ward_number,
        report.location_lat || null,
        report.location_lng || null,
        new Date().toISOString()
      ]
    );
  }

  async getUnsyncedReports(): Promise<Partial<Report>[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync(
      `SELECT * FROM offline_reports WHERE synced = 0 ORDER BY created_at ASC`
    );

    return rows.map(row => ({
      ...row,
      synced: Boolean(row.synced),
      created_at: new Date(row.created_at)
    }));
  }

  async markReportSynced(reportId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE offline_reports SET synced = 1, synced_at = ? WHERE id = ?`,
      [new Date().toISOString(), reportId]
    );
  }

  async updateReportSyncError(reportId: string, error: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE offline_reports 
       SET sync_error = ?, attempts = attempts + 1, last_attempt = ? 
       WHERE id = ?`,
      [error, new Date().toISOString(), reportId]
    );
  }

  // Cached Data Management
  async cacheAgent(agent: Agent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO cached_agents (
        id, full_name, phone_number, pin, ward_name, ward_number,
        verification_status, payment_status, last_report_at, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent.id,
        agent.full_name,
        agent.phone_number,
        agent.pin,
        agent.ward_name,
        agent.ward_number,
        agent.verification_status,
        agent.payment_status,
        agent.last_report_at,
        new Date().toISOString()
      ]
    );
  }

  async getCachedAgent(agentId: string): Promise<Agent | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.getFirstAsync(
      `SELECT * FROM cached_agents WHERE id = ?`,
      [agentId]
    );

    return row ? {
      ...row,
      last_report_at: row.last_report_at ? new Date(row.last_report_at) : null
    } : null;
  }

  async cacheBroadcast(broadcast: Broadcast): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO cached_broadcasts (
        id, message, priority, sender_id, created_at, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        broadcast.id,
        broadcast.message,
        broadcast.priority,
        broadcast.sender_id,
        broadcast.created_at,
        new Date().toISOString()
      ]
    );
  }

  async getCachedBroadcasts(): Promise<Broadcast[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync(
      `SELECT * FROM cached_broadcasts ORDER BY created_at DESC`
    );

    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      cached_at: new Date(row.cached_at),
      read: Boolean(row.read)
    }));
  }

  async markBroadcastRead(broadcastId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE cached_broadcasts SET read = 1 WHERE id = ?`,
      [broadcastId]
    );
  }

  // Sync Queue Management
  async addToSyncQueue(type: string, data: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const itemId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.runAsync(
      `INSERT INTO sync_queue (id, type, data, created_at) VALUES (?, ?, ?, ?)`,
      [itemId, type, JSON.stringify(data), new Date().toISOString()]
    );
  }

  async getSyncQueue(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync(
      `SELECT * FROM sync_queue ORDER BY created_at ASC`
    );

    return rows.map(row => ({
      ...row,
      data: JSON.parse(row.data),
      created_at: new Date(row.created_at),
      last_attempt: row.last_attempt ? new Date(row.last_attempt) : null
    }));
  }

  async removeFromSyncQueue(itemId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `DELETE FROM sync_queue WHERE id = ?`,
      [itemId]
    );
  }

  async updateSyncQueueError(itemId: string, error: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE sync_queue 
       SET error = ?, attempts = attempts + 1, last_attempt = ? 
       WHERE id = ?`,
      [error, new Date().toISOString(), itemId]
    );
  }

  // Cleanup and Maintenance
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffString = cutoffDate.toISOString();

    // Clean up old synced reports
    await this.db.runAsync(
      `DELETE FROM offline_reports 
       WHERE synced = 1 AND created_at < ?`,
      [cutoffString]
    );

    // Clean up old cache data
    await this.db.runAsync(
      `DELETE FROM cached_broadcasts WHERE cached_at < ?`,
      [cutoffString]
    );

    // Clean up old sync queue items with too many attempts
    await this.db.runAsync(
      `DELETE FROM sync_queue WHERE attempts > 5 AND last_attempt < ?`,
      [cutoffString]
    );
  }

  // Statistics
  async getOfflineStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const [unsyncedReports, cachedBroadcasts, queueSize] = await Promise.all([
      this.db.getFirstAsync(`SELECT COUNT(*) as count FROM offline_reports WHERE synced = 0`),
      this.db.getFirstAsync(`SELECT COUNT(*) as count FROM cached_broadcasts`),
      this.db.getFirstAsync(`SELECT COUNT(*) as count FROM sync_queue`)
    ]);

    return {
      unsyncedReports: unsyncedReports.count,
      cachedBroadcasts: cachedBroadcasts.count,
      queueSize: queueSize.count
    };
  }
}