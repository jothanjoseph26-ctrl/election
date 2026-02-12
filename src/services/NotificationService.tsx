import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { OfflineDatabase } from './OfflineDatabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationData {
  type: 'broadcast' | 'emergency' | 'report_acknowledged' | 'system';
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'normal' | 'high';
}

export class PushNotificationService {
  private offlineDB: OfflineDatabase;
  private pushToken: string | null = null;

  constructor(offlineDB: OfflineDatabase) {
    this.offlineDB = offlineDB;
  }

  // Initialize notifications
  async initialize(): Promise<void> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Push notification permissions not granted');
        return;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // Get from Expo
      });
      this.pushToken = tokenData.data;

      // Register token with server
      await this.registerPushToken();

      // Set up notification listeners
      this.setupNotificationListeners();

      console.log('Push notifications initialized');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  // Register push token with server
  private async registerPushToken(): Promise<void> {
    if (!this.pushToken) return;

    try {
      // Store token locally for offline support
      await this.offlineDB.addToSyncQueue('push_token_register', {
        token: this.pushToken,
        platform: Platform.OS,
        appVersion: '1.0.0', // Get from app config
      });

      // If online, register immediately
      const networkState = await this.getNetworkState();
      if (networkState.isConnected) {
        await this.syncPushToken();
      }
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  // Sync push token with server
  private async syncPushToken(): Promise<void> {
    if (!this.pushToken) return;

    try {
      // Get agent info from local storage
      const agentId = await this.getCurrentAgentId();
      if (!agentId) return;

      const { error } = await supabase
        .from('agent_push_tokens')
        .upsert({
          agent_id: agentId,
          push_token: this.pushToken,
          platform: Platform.OS,
          app_version: '1.0.0',
          last_active: new Date().toISOString(),
        });

      if (error) throw error;

      console.log('Push token registered successfully');
    } catch (error) {
      console.error('Failed to sync push token:', error);
    }
  }

  // Setup notification listeners
  private setupNotificationListeners(): void {
    // Handle notification received when app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      
      // Cache broadcast locally if it's a broadcast notification
      if (notification.request.content.data?.type === 'broadcast') {
        this.cacheBroadcastFromNotification(notification.request.content.data);
      }
    });

    // Handle notification when user taps it
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      
      // Handle navigation based on notification type
      const notificationData = response.notification.request.content.data;
      this.handleNotificationTap(notificationData);
    });
  }

  // Cache broadcast from notification
  private async cacheBroadcastFromNotification(data: any): Promise<void> {
    try {
      const broadcast = {
        id: data.broadcast_id,
        message: data.body,
        priority: data.priority || 'normal',
        sender_id: data.sender_id,
        created_at: data.created_at || new Date().toISOString(),
      };

      await this.offlineDB.cacheBroadcast(broadcast);
    } catch (error) {
      console.error('Failed to cache broadcast from notification:', error);
    }
  }

  // Handle notification tap
  private handleNotificationTap(data: any): void {
    switch (data.type) {
      case 'broadcast':
        // Navigate to broadcasts screen
        console.log('Navigate to broadcasts');
        break;
      case 'emergency':
        // Navigate to emergency screen or open report form
        console.log('Navigate to emergency response');
        break;
      case 'report_acknowledged':
        // Navigate to report history
        console.log('Navigate to report history');
        break;
      default:
        console.log('Default notification handling');
    }
  }

  // Send local notification (for testing and offline scenarios)
  async sendLocalNotification(notification: PushNotificationData): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.priority === 'high' ? 'default' : null,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  }

  // Send notification to specific agent
  static async sendNotificationToAgent(
    agentId: string,
    notification: PushNotificationData
  ): Promise<void> {
    try {
      // Get agent's push tokens
      const { data: tokens } = await supabase
        .from('agent_push_tokens')
        .select('push_token, platform')
        .eq('agent_id', agentId);

      if (!tokens?.length) {
        console.log('No push tokens found for agent:', agentId);
        return;
      }

      // Send push notification via Expo
      const messages = tokens.map(token => ({
        to: token.push_token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: notification.priority === 'high' ? 'default' : null,
        priority: notification.priority || 'normal',
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      console.log('Push notification sent:', result);

      // Log the notification
      await supabase.from('push_notification_logs').insert({
        agent_id: agentId,
        notification_type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        status: response.ok ? 'sent' : 'failed',
      });
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  // Send broadcast to all verified agents
  static async sendBroadcastToAllAgents(
    message: string,
    priority: 'normal' | 'urgent' = 'normal'
  ): Promise<void> {
    try {
      // Get all verified agents with push tokens
      const { data: tokens } = await supabase
        .from('agent_push_tokens')
        .select(`
          push_token,
          platform,
          agents!inner(
            id,
            full_name,
            verification_status
          )
        `)
        .eq('agents.verification_status', 'verified');

      if (!tokens?.length) {
        console.log('No agents found with push tokens');
        return;
      }

      const notification: PushNotificationData = {
        type: 'broadcast',
        title: priority === 'urgent' ? '🚨 URGENT Broadcast' : '📢 AMAC Broadcast',
        body: message,
        data: {
          type: 'broadcast',
          priority,
          message,
          timestamp: new Date().toISOString(),
        },
        priority,
      };

      const messages = tokens.map(token => ({
        to: token.push_token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: priority === 'urgent' ? 'default' : null,
        priority: priority,
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (response.ok) {
        console.log(`Broadcast sent to ${tokens.length} agents`);
      } else {
        throw new Error('Failed to send broadcast');
      }
    } catch (error) {
      console.error('Failed to send broadcast to agents:', error);
    }
  }

  // Get notification permissions status
  static async getNotificationPermissions(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  // Clear all notifications
  static async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  // Get notification badge count
  static async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  // Set notification badge count
  static async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Helper methods
  private async getCurrentAgentId(): Promise<string | null> {
    // This would get the current agent's ID from secure storage
    // For now, return null - implement based on your auth system
    return null;
  }

  private async getNetworkState(): Promise<any> {
    // This would check network connectivity
    // For now, assume online
    return { isConnected: true };
  }
}