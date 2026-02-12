import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { styles } from '../styles/styles';
import * as Location from 'expo-location';
import { format } from 'date-fns';

export default function DashboardScreen({ navigation }: any) {
  const { agent, refreshAgent } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAgent();
      await requestLocationPermission();
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const getTodayStats = () => {
    if (!agent) return { todayReports: 0, lastReportTime: null };
    
    // This would typically come from local storage or API
    // For now, we'll use placeholder data
    const lastReportTime = agent.last_report_at 
      ? format(new Date(agent.last_report_at), 'HH:mm')
      : null;
    
    return {
      todayReports: Math.floor(Math.random() * 5), // Placeholder
      lastReportTime
    };
  };

  const { todayReports, lastReportTime } = getTodayStats();

  if (!agent) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading agent data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.dashboardContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.agentName}>{agent.full_name}</Text>
          </View>
          {location && (
            <View>
              <Text style={{ color: '#ffffff', fontSize: 12 }}>
                📍 Location Active
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Reports</Text>
            <Text style={styles.statValue}>{todayReports}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Last Report</Text>
            <Text style={styles.statValue}>
              {lastReportTime || '--:--'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Ward</Text>
            <Text style={styles.statValue}>{agent.ward_number || 'N/A'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>
              {agent.verification_status === 'verified' ? '✅ Active' : '⏳ Pending'}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Report')}
            >
              <Text style={styles.actionButtonText}>📝</Text>
              <Text style={styles.actionButtonText}>New Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('History')}
            >
              <Text style={styles.actionButtonText}>📋</Text>
              <Text style={styles.actionButtonText}>Report History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Broadcasts')}
            >
              <Text style={styles.actionButtonText}>📢</Text>
              <Text style={styles.actionButtonText}>Broadcasts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.actionButtonText}>👤</Text>
              <Text style={styles.actionButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentReportsContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {/* This would show recent reports - placeholder for now */}
          <View style={styles.reportCard}>
            <Text style={styles.reportType}>Turnout Update</Text>
            <Text style={styles.reportContent}>
              Voter turnout is steady at 45% by 12 PM
            </Text>
            <Text style={styles.reportTime}>2 hours ago</Text>
          </View>
          <View style={[styles.reportCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={[styles.reportType, { color: '#ef4444' }]}>Incident</Text>
            <Text style={styles.reportContent}>
              Minor dispute resolved peacefully
            </Text>
            <Text style={styles.reportTime}>4 hours ago</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}