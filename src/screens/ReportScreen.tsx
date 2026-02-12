import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import { styles } from '../styles/styles';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { OfflineDatabase } from '../services/OfflineDatabase';

interface ReportType {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const reportTypes: ReportType[] = [
  { id: 'turnout_update', label: 'Turnout Update', icon: '📊', color: '#2563eb' },
  { id: 'incident', label: 'Incident', icon: '⚠️', color: '#ef4444' },
  { id: 'emergency', label: 'Emergency', icon: '🚨', color: '#dc2626' },
  { id: 'material_shortage', label: 'Material Shortage', icon: '📦', color: '#f59e0b' },
  { id: 'other', label: 'Other', icon: '📝', color: '#64748b' },
];

export default function ReportScreen({ navigation }: any) {
  const { agent } = useAuth();
  const [selectedType, setSelectedType] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const [offlineDB] = useState(() => new OfflineDatabase());

  useEffect(() => {
    offlineDB.init();
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Unable to get your location. Please check location permissions.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleVoiceRecordingComplete = (audioUri: string, duration: number) => {
    setVoiceNoteUri(audioUri);
    setVoiceDuration(duration);
  };

  const uploadVoiceNote = async (audioUri: string): Promise<string | null> => {
    try {
      // Upload to Supabase storage
      const fileName = `voice_notes/${agent?.id}/${Date.now()}.m4a`;
      
      const response = await fetch(audioUri);
      const blob = await response.blob();
      
      const { data, error } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, blob, {
          contentType: 'audio/mp4',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Voice note upload error:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }

    if (!details.trim() && !voiceNoteUri) {
      Alert.alert('Error', 'Please enter report details or record a voice note');
      return;
    }

    if (!agent) {
      Alert.alert('Error', 'Agent information not available');
      return;
    }

    setSubmitting(true);
    try {
      let voiceNoteUrl = null;
      
      // Upload voice note if present
      if (voiceNoteUri) {
        voiceNoteUrl = await uploadVoiceNote(voiceNoteUri);
      }

      const reportData = {
        agent_id: agent.id,
        operator_id: null, // Field agents don't specify operators
        report_type: selectedType,
        details: details.trim() || '[Voice Report]',
        ward_number: agent.ward_number,
        location_lat: location?.coords.latitude || null,
        location_lng: location?.coords.longitude || null,
        voice_note_url: voiceNoteUrl,
        voice_duration: voiceNoteUrl ? voiceDuration : null,
      };

      // Try to submit online first
      try {
        const { error } = await supabase.from('reports').insert(reportData);

        if (error) throw error;

        // Update agent's last report time
        await supabase
          .from('agents')
          .update({ last_report_at: new Date().toISOString() })
          .eq('id', agent.id);

        Alert.alert(
          'Success',
          'Report submitted successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } catch (onlineError) {
        // Save offline if online submission fails
        await offlineDB.saveOfflineReport(reportData);
        
        Alert.alert(
          'Offline Mode',
          'Report saved offline. It will be synced when you have internet connection.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }

      // Reset form
      setSelectedType('');
      setDetails('');
      setVoiceNoteUri(null);
      setVoiceDuration(0);
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.reportFormContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.reportFormContent}>
        {/* Report Type Selection */}
        <View style={styles.reportTypeContainer}>
          <Text style={styles.sectionTitle}>Report Type</Text>
          <View style={styles.reportTypeGrid}>
            {reportTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.reportTypeButton,
                  selectedType === type.id && styles.reportTypeButtonSelected
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Text style={{ fontSize: 24 }}>{type.icon}</Text>
                <Text style={[
                  styles.reportTypeButtonText,
                  selectedType === type.id && styles.reportTypeButtonTextSelected
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location Information */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Location</Text>
          {gettingLocation ? (
            <View style={styles.locationContainer}>
              <ActivityIndicator size="small" color={styles.primary.color} />
              <Text style={styles.locationText}>Getting location...</Text>
            </View>
          ) : location ? (
            <View style={styles.locationContainer}>
              <Text style={styles.locationText}>
                📍 {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.locationContainer}
              onPress={getCurrentLocation}
            >
              <Text style={[styles.locationText, { color: '#ef4444' }]}>
                📍 Location unavailable - Tap to retry
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Voice Note Recording */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Voice Note (Optional)</Text>
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            maxDuration={60}
          />
        </View>

        {/* Report Details */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Report Details</Text>
          <TextInput
            style={styles.textArea}
            value={details}
            onChangeText={setDetails}
            placeholder={voiceNoteUri ? "Add any additional details..." : "Please provide detailed information about your report..."}
            multiline
            numberOfLines={voiceNoteUri ? 4 : 6}
            textAlignVertical="top"
          />
        </View>

        {/* Ward Information */}
        {agent && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ward Information</Text>
            <View style={styles.locationContainer}>
              <Text style={styles.locationText}>
                Ward {agent.ward_number} - {agent.ward_name || 'N/A'}
              </Text>
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}