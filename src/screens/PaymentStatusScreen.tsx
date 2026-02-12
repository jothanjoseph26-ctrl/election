import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { styles } from '../styles/styles';

interface PaymentStatus {
  id: string;
  agent_id: string;
  amount: number;
  payment_method: string;
  status: string;
  priority: string;
  reference_number?: string;
  payment_date?: string;
  expected_delivery_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface PaymentStatusProps {
  className?: string;
}

export function PaymentStatusScreen({ className }: PaymentStatusProps) {
  const { agent } = useAuth();
  const [payments, setPayments] = useState<PaymentStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentStatus | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Load payment history
  const loadPayments = async () => {
    if (!agent) return;

    setLoading(true);
    try {
      // Mock data for demo
      const mockPayments: PaymentStatus[] = [
        {
          id: '1',
          agent_id: agent.id,
          amount: 5000,
          payment_method: 'bank_transfer',
          status: 'delivered',
          priority: 'normal',
          reference_number: 'REF001',
          payment_date: '2024-02-10',
          expected_delivery_date: '2024-02-12',
          notes: 'Payment for January services',
          created_at: '2024-02-10T10:30:00Z',
          updated_at: '2024-02-12T15:45:00Z'
        },
        {
          id: '2',
          agent_id: agent.id,
          amount: 7500,
          payment_method: 'mobile_money',
          status: 'sent',
          priority: 'normal',
          reference_number: 'REF002',
          payment_date: '2024-02-08',
          expected_delivery_date: '2024-02-10',
          notes: 'February payment',
          created_at: '2024-02-08T14:20:00Z',
          updated_at: '2024-02-09T09:15:00Z'
        },
        {
          id: '3',
          agent_id: agent.id,
          amount: 3000,
          payment_method: 'cash',
          status: 'pending',
          priority: 'high',
          payment_date: '2024-02-12',
          expected_delivery_date: '2024-02-15',
          notes: 'Additional payment for special duties',
          created_at: '2024-02-12T16:00:00Z',
          updated_at: '2024-02-12T16:00:00Z'
        }
      ];

      setPayments(mockPayments);
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }
    } catch (error) {
      console.error('Location permission denied:', error);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    await getCurrentLocation();
    setRefreshing(false);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return { backgroundColor: '#22c55e' };
      case 'sent':
        return { backgroundColor: '#3b82f6' };
      case 'approved':
        return { backgroundColor: '#8b5cf6' };
      case 'verified':
        return { backgroundColor: '#06b6d4' };
      case 'pending':
        return { backgroundColor: '#f59e0b' };
      case 'failed':
        return { backgroundColor: '#ef4444' };
      case 'cancelled':
        return { backgroundColor: '#6b7280' };
      default:
        return { backgroundColor: '#d1d5db' };
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'Payment has been successfully delivered';
      case 'sent':
        return 'Payment is on the way';
      case 'approved':
        return 'Payment has been approved';
      case 'verified':
        return 'Payment has been verified';
      case 'pending':
        return 'Payment is being processed';
      case 'failed':
        return 'Payment failed. Please contact support';
      case 'cancelled':
        return 'Payment was cancelled';
      default:
        return 'Status unknown';
    }
  };

  useEffect(() => {
    loadPayments();
    getCurrentLocation();
  }, [agent]);

  return (
    <ScrollView 
      style={[styles.container, className]} 
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Payments</Text>
          <Text style={styles.subtitle}>Track your payment status in real-time</Text>
        </View>
        {location && (
          <View style={localStyles.locationBadge}>
            <Text style={localStyles.locationText}>📍 Location Available</Text>
          </View>
        )}
      </View>

      {/* Summary Cards */}
      <View style={localStyles.summarySection}>
        <View style={localStyles.summaryCard}>
          <Text style={localStyles.summaryLabel}>Total Payments</Text>
          <Text style={localStyles.summaryValue}>{payments.length}</Text>
        </View>
        <View style={localStyles.summaryCard}>
          <Text style={localStyles.summaryLabel}>Total Amount</Text>
          <Text style={localStyles.summaryValue}>
            ₦{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
          </Text>
        </View>
        <View style={localStyles.summaryCard}>
          <Text style={localStyles.summaryLabel}>Delivered</Text>
          <Text style={localStyles.summaryValue}>
            {payments.filter(p => p.status === 'delivered').length}
          </Text>
        </View>
        <View style={localStyles.summaryCard}>
          <Text style={localStyles.summaryLabel}>Pending</Text>
          <Text style={localStyles.summaryValue}>
            {payments.filter(p => p.status === 'pending').length}
          </Text>
        </View>
      </View>

      {/* Payment List */}
      <View style={localStyles.paymentList}>
        {loading ? (
          <View style={localStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={localStyles.loadingText}>Loading payments...</Text>
          </View>
        ) : payments.length === 0 ? (
          <View style={localStyles.emptyState}>
            <Text style={localStyles.emptyText}>💰 No payments found</Text>
            <Text style={localStyles.emptySubtext}>
              Your payment history will appear here once payments are processed
            </Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment.id} style={localStyles.paymentCard}>
              <TouchableOpacity
                style={localStyles.paymentTouchable}
                onPress={() => setSelectedPayment(payment)}
              >
                <View style={localStyles.paymentHeader}>
                  <View style={localStyles.paymentInfo}>
                    <Text style={localStyles.paymentAmount}>₦{payment.amount.toLocaleString()}</Text>
                    <Text style={localStyles.paymentReference}>
                      Ref: {payment.reference_number || 'N/A'}
                    </Text>
                  </View>
                  <View style={localStyles.paymentMeta}>
                    <View style={localStyles.metaItem}>
                      <Text style={localStyles.metaText}>{payment.payment_method.replace('_', ' ')}</Text>
                    </View>
                    <View style={[localStyles.priorityBadge, { 
                      backgroundColor: payment.priority === 'high' ? '#ef4444' : '#3b82f6' 
                    }]}>
                      <Text style={localStyles.priorityText}>{payment.priority.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                <View style={localStyles.paymentStatus}>
                  <View style={[localStyles.statusBadge, getStatusColor(payment.status)]}>
                    <Text style={localStyles.statusIcon}>●</Text>
                  </View>
                  <View style={localStyles.statusText}>
                    <Text style={localStyles.statusTextMain}>{payment.status.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={localStyles.statusTextSub}>{getStatusText(payment.status)}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={localStyles.paymentDetails}>
                <Text style={localStyles.detailsLabel}>Payment Date:</Text>
                <Text style={localStyles.detailsValue}>
                  {payment.payment_date ? format(new Date(payment.payment_date), 'MMM d, yyyy') : 'N/A'}
                </Text>
              </View>

              {payment.expected_delivery_date && (
                <View style={localStyles.detailsItem}>
                  <Text style={localStyles.detailsLabel}>Expected:</Text>
                  <Text style={localStyles.detailsValue}>
                    {format(new Date(payment.expected_delivery_date), 'MMM d, yyyy')}
                  </Text>
                </View>
              )}

              {payment.status === 'delivered' && (
                <View style={localStyles.paymentSuccess}>
                  <Text style={localStyles.successText}>✅ Payment Delivered</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContainer}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Payment Details</Text>
              <TouchableOpacity
                style={localStyles.modalClose}
                onPress={() => setSelectedPayment(null)}
              >
                <Text style={localStyles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={localStyles.modalContent}>
              <View style={localStyles.detailSection}>
                <Text style={localStyles.detailSectionTitle}>Payment Information</Text>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>Amount:</Text>
                  <Text style={localStyles.detailValue}>₦{selectedPayment.amount.toLocaleString()}</Text>
                </View>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>Reference:</Text>
                  <Text style={localStyles.detailValue}>{selectedPayment.reference_number || 'N/A'}</Text>
                </View>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>Method:</Text>
                  <Text style={localStyles.detailValue}>{selectedPayment.payment_method.replace('_', ' ')}</Text>
                </View>
              </View>

              <View style={localStyles.detailSection}>
                <Text style={localStyles.detailSectionTitle}>Status Information</Text>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>Status:</Text>
                  <Text style={localStyles.detailValue}>
                    {selectedPayment.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>Last Updated:</Text>
                  <Text style={localStyles.detailValue}>
                    {format(new Date(selectedPayment.updated_at), 'MMM d, yyyy HH:mm')}
                  </Text>
                </View>
              </View>

              {selectedPayment.notes && (
                <View style={localStyles.detailSection}>
                  <Text style={localStyles.detailSectionTitle}>Additional Notes</Text>
                  <View style={localStyles.notesContainer}>
                    <Text style={localStyles.notesText}>{selectedPayment.notes}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={localStyles.modalActions}>
              <TouchableOpacity
                style={localStyles.modalButton}
                onPress={() => setSelectedPayment(null)}
              >
                <Text style={localStyles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  summarySection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  locationBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  paymentList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  paymentTouchable: {
    padding: 16,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  paymentReference: {
    fontSize: 14,
    color: '#64748b',
  },
  paymentMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 12,
    color: '#ffffff',
  },
  statusText: {
    flex: 1,
  },
  statusTextMain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  statusTextSub: {
    fontSize: 12,
    color: '#64748b',
  },
  paymentDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  detailsItem: {
    marginTop: 8,
  },
  detailsLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  detailsValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  paymentSuccess: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#64748b',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  notesContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});