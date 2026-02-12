import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { styles } from '../styles/styles';

interface VoiceRecorderProps {
  onRecordingComplete: (audioUri: string, duration: number) => void;
  maxDuration?: number; // in seconds
  disabled?: boolean;
}

export function VoiceRecorder({ 
  onRecordingComplete, 
  maxDuration = 60, 
  disabled = false 
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio
  React.useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound) {
        sound.unloadAsync();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [recording, sound]);

  const startRecording = async () => {
    try {
      console.log('Requesting permissions..');
      await Audio.requestPermissionsAsync();

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);

      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setRecordingDuration(Math.floor(status.durationMillis / 1000));
        }
      });

      // Set up timer for max duration
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsProcessing(true);
    setIsRecording(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    console.log('Stopping recording..');
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    
    if (uri) {
      setAudioUri(uri);
      onRecordingComplete(uri, recordingDuration);
    }

    setRecording(null);
    setIsProcessing(false);
  };

  const playRecording = async () => {
    if (!audioUri) return;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      
      setSound(sound);
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Failed to play recording:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const stopPlayback = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setIsPlaying(false);
  };

  const deleteRecording = () => {
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setAudioUri(null);
    setRecordingDuration(0);
    setIsPlaying(false);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (disabled) {
    return (
      <View style={voiceRecorderStyles.container}>
        <View style={voiceRecorderStyles.disabledContainer}>
          <MaterialIcons name="mic-off" size={48} color="#9ca3af" />
          <Text style={voiceRecorderStyles.disabledText}>
            Voice recording not available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={voiceRecorderStyles.container}>
      {!audioUri ? (
        // Recording Interface
        <View style={voiceRecorderStyles.recordingContainer}>
          <TouchableOpacity
            style={[
              voiceRecorderStyles.recordButton,
              isRecording && voiceRecorderStyles.recordButtonActive,
              isProcessing && voiceRecorderStyles.recordButtonDisabled
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#ffffff" size={24} />
            ) : isRecording ? (
              <Feather name="square" size={32} color="#ffffff" />
            ) : (
              <MaterialIcons name="mic" size={48} color="#ffffff" />
            )}
          </TouchableOpacity>

          {isRecording && (
            <View style={voiceRecorderStyles.recordingInfo}>
              <View style={voiceRecorderStyles.recordingIndicator}>
                <View style={voiceRecorderStyles.recordingDot} />
              </View>
              <Text style={voiceRecorderStyles.recordingText}>
                Recording: {formatDuration(recordingDuration)}
              </Text>
              <Text style={voiceRecorderStyles.recordingHint}>
                Max duration: {maxDuration}s
              </Text>
            </View>
          )}

          {!isRecording && !isProcessing && (
            <View style={voiceRecorderStyles.instructionContainer}>
              <Text style={voiceRecorderStyles.instructionText}>
                Tap to start recording voice note
              </Text>
              <Text style={voiceRecorderStyles.instructionHint}>
                Max {maxDuration} seconds recording time
              </Text>
            </View>
          )}
        </View>
      ) : (
        // Playback Interface
        <View style={voiceRecorderStyles.playbackContainer}>
          <View style={voiceRecorderStyles.audioInfo}>
            <View style={voiceRecorderStyles.audioControls}>
              <TouchableOpacity
                style={[
                  voiceRecorderStyles.playButton,
                  isPlaying && voiceRecorderStyles.playButtonActive
                ]}
                onPress={isPlaying ? stopPlayback : playRecording}
              >
                <Feather 
                  name={isPlaying ? "pause" : "play"} 
                  size={24} 
                  color="#ffffff" 
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={voiceRecorderStyles.deleteButton}
                onPress={deleteRecording}
              >
                <Feather name="trash-2" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <View style={voiceRecorderStyles.audioDetails}>
              <Text style={voiceRecorderStyles.audioLabel}>
                Voice Note Recorded
              </Text>
              <Text style={voiceRecorderStyles.audioDuration}>
                Duration: {formatDuration(recordingDuration)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={voiceRecorderStyles.rerecordButton}
            onPress={deleteRecording}
          >
            <Feather name="mic" size={20} color="#2563eb" />
            <Text style={voiceRecorderStyles.rerecordText}>
              Record Again
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const voiceRecorderStyles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  disabledContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  disabledText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  recordingContainer: {
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
  },
  recordButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  recordingInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  recordingHint: {
    fontSize: 12,
    color: '#64748b',
  },
  instructionContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 4,
    textAlign: 'center',
  },
  instructionHint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  playbackContainer: {
    alignItems: 'center',
  },
  audioInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  audioControls: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: '#f59e0b',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDetails: {
    alignItems: 'center',
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 4,
  },
  audioDuration: {
    fontSize: 12,
    color: '#64748b',
  },
  rerecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    gap: 8,
  },
  rerecordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
});