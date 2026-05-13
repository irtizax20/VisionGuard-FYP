import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import BlinkDetectionService, { BlinkDetectionResult } from '@/services/BlinkDetectionService';
import BlinkTrackingService from '@/services/BlinkTrackingService';
import EyeImageCaptureService, { EyeImageData } from '@/services/EyeImageCaptureService';
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Image,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BlinkTestScreen() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.darkHighContrast : Colors.lightHighContrast;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentBlinkCount, setCurrentBlinkCount] = useState(0);
  const [currentDistanceMeasurements, setCurrentDistanceMeasurements] = useState(0);
  const [result, setResult] = useState<BlinkDetectionResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [eyeCaptureEnabled, setEyeCaptureEnabled] = useState(true);
  const [capturedEyeImages, setCapturedEyeImages] = useState<EyeImageData | null>(null);
  const [tooCloseWarning, setTooCloseWarning] = useState(false);
  const lastSpokeRef = useRef<number>(0);

  // Animation for the detecting indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const blinkFlashAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const flashBlinkIndicator = () => {
    Animated.sequence([
      Animated.timing(blinkFlashAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }),
      Animated.timing(blinkFlashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // Countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isDetecting) {
      setCountdown(30);
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isDetecting]);

  // Use a ref so we can attach/detach listeners synchronously (not via React state)
  const removeBlinkListenerRef = useRef<(() => void) | null>(null);
  const removeDistListenerRef  = useRef<(() => void) | null>(null);
  const isDetectingRef = useRef(false);

  const attachListeners = () => {
    // Blink listener — fires on every single blink immediately
    removeBlinkListenerRef.current = BlinkDetectionService.onBlinkDetected((count) => {
      setCurrentBlinkCount(count);
      flashBlinkIndicator();
    });
    // Distance warning listener
    removeDistListenerRef.current = BlinkDetectionService.onDistanceWarning((distance) => {
      setCurrentDistanceMeasurements(prev => prev + 1);
      setTooCloseWarning(true);
      const now = Date.now();
      if (now - lastSpokeRef.current > 10000) {
        Speech.speak('Please maintain a safe distance from the screen', { rate: 0.9 });
        lastSpokeRef.current = now;
      }
      setTimeout(() => setTooCloseWarning(false), 2500);
    });
  };

  const detachListeners = () => {
    removeBlinkListenerRef.current?.();
    removeDistListenerRef.current?.();
    removeBlinkListenerRef.current = null;
    removeDistListenerRef.current  = null;
  };

  // Unmount cleanup only
  useEffect(() => {
    return () => {
      detachListeners();
      if (isDetectingRef.current) {
        BlinkDetectionService.stopDetection().catch(() => {});
      }
    };
  }, []);

  const handleStartTest = async () => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission is required for blink detection');
          return;
        }
        if (Platform.OS === 'android') {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (eyeCaptureEnabled) {
        await EyeImageCaptureService.requestGalleryPermissions();
        try {
          await EyeImageCaptureService.enableEyeCapture();
        } catch (error) {
          console.error('Failed to enable eye capture:', error);
        }
      }

      setResult(null);
      setCurrentBlinkCount(0);
      setCurrentDistanceMeasurements(0);
      setCapturedEyeImages(null);
      setIsDetecting(true);
      isDetectingRef.current = true;
      startPulse();

      // Attach listeners NOW (synchronously, before the native session starts)
      // This avoids the React state → useEffect → re-render race condition
      attachListeners();

      const detectionResult = await BlinkDetectionService.runDetectionSession();
      setResult(detectionResult);
      setIsDetecting(false);
      isDetectingRef.current = false;
      detachListeners();
      stopPulse();

      if (eyeCaptureEnabled) {
        try {
          await EyeImageCaptureService.disableEyeCapture();
          await new Promise(resolve => setTimeout(resolve, 1000));
          const eyeImages = await EyeImageCaptureService.getLatestEyeImages();
          if (eyeImages) {
            setCapturedEyeImages(eyeImages);
            await EyeImageCaptureService.saveToGallery(eyeImages, true);
          }
        } catch (error) {
          console.error('Failed to get eye images:', error);
        }
      }

      try {
        await BlinkTrackingService.saveBlinkData(detectionResult);
      } catch (saveError) {
        console.error('Failed to save blink data:', saveError);
      }

      Alert.alert(
        '📊 Detection Results',
        `👁️ Blinks: ${detectionResult.blinkCount}\n📏 Avg Distance: ${detectionResult.averageScreenDistance.toFixed(1)} cm\n📐 Measurements: ${detectionResult.distanceMeasurements}/5\n⏱️ Duration: ${detectionResult.durationSeconds}s\n\n✅ Data saved to your profile!`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('Start detection error:', error);
      Alert.alert('Error', error.message || 'Failed to start detection');
      setIsDetecting(false);
      isDetectingRef.current = false;
      detachListeners();
      stopPulse();
      if (eyeCaptureEnabled) {
        try { await EyeImageCaptureService.disableEyeCapture(); } catch (e) {}
      }
    }
  };

  const handleStopTest = async () => {
    try {
      await BlinkDetectionService.stopDetection();
    } catch (e) {
      console.log('Error stopping early:', e);
    }
    isDetectingRef.current = false;
    detachListeners();
    setIsDetecting(false);
    stopPulse();
    Alert.alert('⚠️ Detection Cancelled', 'Detection was stopped early.', [{ text: 'OK' }]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Blink & Distance Test</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Detection Status Panel (replaces frozen camera view) */}
        <View style={[styles.detectionPanel, { backgroundColor: theme.card }]}>
          {isDetecting ? (
            <>
              <Animated.View style={[styles.eyeCircle, { backgroundColor: theme.secondary + '20', transform: [{ scale: pulseAnim }] }]}>
                <Animated.Text style={[styles.eyeEmoji, { opacity: blinkFlashAnim }]}>👁️</Animated.Text>
              </Animated.View>
              <Text style={[styles.activeLabel, { color: theme.secondary }]}>Detection Active</Text>
              <Text style={[styles.activeSub, { color: theme.textSecondary }]}>Keep your face in front of the camera</Text>

              {/* Live Stats */}
              <View style={styles.liveStatsRow}>
                <View style={[styles.liveStat, { backgroundColor: theme.background }]}>
                  <Animated.Text style={[styles.liveStatValue, { color: theme.secondary, opacity: blinkFlashAnim }]}>
                    {currentBlinkCount}
                  </Animated.Text>
                  <Text style={[styles.liveStatLabel, { color: theme.textSecondary }]}>Blinks</Text>
                </View>
                <View style={[styles.liveStat, { backgroundColor: theme.background }]}>
                  <Text style={[styles.liveStatValue, { color: theme.tint }]}>{countdown}s</Text>
                  <Text style={[styles.liveStatLabel, { color: theme.textSecondary }]}>Remaining</Text>
                </View>
              </View>

              {/* Distance Warning */}
              {tooCloseWarning && (
                <View style={[styles.warningBanner, { backgroundColor: '#FF3B30' + '15', borderColor: '#FF3B30' }]}>
                  <Ionicons name="warning" size={20} color="#FF3B30" />
                  <Text style={[styles.warningText, { color: '#FF3B30' }]}>TOO CLOSE — Move back!</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={[styles.eyeCircle, { backgroundColor: theme.card }]}>
                <Text style={styles.eyeEmoji}>👁️</Text>
              </View>
              <Text style={[styles.readyLabel, { color: theme.text }]}>Ready to Detect</Text>
              <Text style={[styles.activeSub, { color: theme.textSecondary }]}>
                Tap "Start" — the camera will run invisibly in the background for accurate ML Kit detection
              </Text>
            </>
          )}
        </View>

        {/* Stats Display */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="eye" size={28} color={theme.secondary} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Blinks</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{currentBlinkCount}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="resize" size={28} color={theme.tint} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Dist. Checks</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{currentDistanceMeasurements}</Text>
          </View>
          {countdown > 0 && (
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="time" size={28} color={theme.warning} />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time Left</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{countdown}s</Text>
            </View>
          )}
        </View>

        {/* Results */}
        {result && (
          <View style={[styles.resultsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.resultsTitle, { color: theme.text }]}>📊 Final Results</Text>
            {[
              ['Total Blinks', `${result.blinkCount}`],
              ['Average Distance', `${result.averageScreenDistance.toFixed(1)} cm`],
              ['Distance Checks', `${result.distanceMeasurements}/5`],
              ['Duration', `${result.durationSeconds}s`],
            ].map(([label, value]) => (
              <View key={label} style={[styles.resultRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>{label}:</Text>
                <Text style={[styles.resultValue, { color: theme.secondary }]}>{value}</Text>
              </View>
            ))}
            {capturedEyeImages && (
              <View style={styles.eyeImagesContainer}>
                <Text style={[styles.eyeImagesTitle, { color: theme.text }]}>👁️ Captured Eye Images</Text>
                <View style={styles.eyeImagesRow}>
                  {[['Left Eye', capturedEyeImages.leftEyeUri], ['Right Eye', capturedEyeImages.rightEyeUri]].map(([label, uri]) => (
                    <View key={label} style={styles.eyeImageWrapper}>
                      <Text style={[styles.eyeLabel, { color: theme.textSecondary }]}>{label}</Text>
                      <Image source={{ uri }} style={styles.eyeImage} resizeMode="cover" />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {!isDetecting ? (
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: theme.secondary }]}
              onPress={handleStartTest}
            >
              <Ionicons name="play-circle" size={32} color={theme.background} />
              <Text style={[styles.buttonText, { color: theme.background }]}>Start 30s Detection</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.detectingIndicator}>
                <ActivityIndicator size="large" color={theme.secondary} />
                <Text style={[styles.detectingText, { color: theme.secondary }]}>
                  Camera processing in background...
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.stopButton, { backgroundColor: theme.error }]}
                onPress={handleStopTest}
              >
                <Ionicons name="stop-circle" size={32} color={theme.background} />
                <Text style={[styles.buttonText, { color: theme.background }]}>Stop Early</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Instructions */}
        <View style={[styles.instructionsContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.instructionTitle, { color: theme.text }]}>📋 Instructions:</Text>
          {[
            '• Allow camera permission when prompted',
            '• Sit in front of your camera as usual',
            '• The camera runs invisibly — ML Kit tracks your face',
            '• Blink count updates instantly as you blink',
            '• Distance is checked every 3 seconds',
            '• You\'ll be warned if you\'re too close',
            '• Results appear automatically after 30 seconds',
          ].map(t => (
            <Text key={t} style={[styles.instructionText, { color: theme.textSecondary }]}>{t}</Text>
          ))}

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="eye-outline" size={24} color={theme.secondary} />
              <Text style={[styles.settingLabel, { color: theme.text }]}>Capture Eye Images</Text>
            </View>
            <Switch
              value={eyeCaptureEnabled}
              onValueChange={setEyeCaptureEnabled}
              trackColor={{ false: theme.border, true: theme.secondary + '80' }}
              thumbColor={eyeCaptureEnabled ? theme.secondary : theme.textSecondary}
              disabled={isDetecting}
            />
          </View>

          <TouchableOpacity
            style={[styles.galleryButton, { backgroundColor: theme.tint + '20', borderColor: theme.tint }]}
            onPress={() => router.push('/eye-images-gallery' as any)}
          >
            <Ionicons name="images-outline" size={20} color={theme.tint} />
            <Text style={[styles.galleryButtonText, { color: theme.tint }]}>View Eye Images Gallery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.techInfo}>
          <Text style={[styles.techText, { color: theme.textSecondary }]}>Powered by ML Kit Face Detection</Text>
          <Text style={[styles.techText, { color: theme.textSecondary }]}>Real-time EAR-based blink detection</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15,
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, zIndex: 10,
  },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  detectionPanel: {
    margin: 20, padding: 24, borderRadius: 20,
    alignItems: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6,
  },
  eyeCircle: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  eyeEmoji: { fontSize: 56 },
  activeLabel: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  readyLabel: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  activeSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  liveStatsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  liveStat: {
    flex: 1, alignItems: 'center', padding: 16,
    borderRadius: 14, elevation: 2,
  },
  liveStatValue: { fontSize: 36, fontWeight: 'bold' },
  liveStatLabel: { fontSize: 12, marginTop: 4 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 12, borderWidth: 1.5,
  },
  warningText: { fontSize: 15, fontWeight: 'bold' },
  statsContainer: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  statCard: {
    padding: 16, borderRadius: 16, alignItems: 'center', minWidth: 90,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  statLabel: { fontSize: 11, marginTop: 6, marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  resultsContainer: {
    margin: 20, padding: 20, borderRadius: 16, borderWidth: 1, elevation: 5,
  },
  resultsTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  resultLabel: { fontSize: 16 },
  resultValue: { fontSize: 16, fontWeight: 'bold' },
  controlsContainer: { paddingHorizontal: 20, paddingVertical: 20 },
  startButton: {
    flexDirection: 'row', padding: 20, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 12, elevation: 5,
  },
  stopButton: {
    flexDirection: 'row', padding: 20, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10, elevation: 5,
  },
  buttonText: { fontSize: 18, fontWeight: 'bold' },
  detectingIndicator: { alignItems: 'center', marginBottom: 20 },
  detectingText: { fontSize: 16, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  instructionsContainer: { margin: 20, padding: 20, borderRadius: 16 },
  instructionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  instructionText: { fontSize: 14, marginBottom: 6, lineHeight: 20 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#ddd',
  },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  galleryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1.5, marginTop: 16, gap: 8,
  },
  galleryButtonText: { fontSize: 15, fontWeight: '600' },
  techInfo: { alignItems: 'center', paddingBottom: 30 },
  techText: { fontSize: 12, marginTop: 4 },
  eyeImagesContainer: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#ddd' },
  eyeImagesTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  eyeImagesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  eyeImageWrapper: { alignItems: 'center' },
  eyeLabel: { fontSize: 14, marginBottom: 8 },
  eyeImage: { width: 120, height: 80, borderRadius: 8, borderWidth: 2, borderColor: '#ddd' },
});
