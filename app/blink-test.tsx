import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import BlinkDetectionService, { BlinkDetectionResult } from '@/services/BlinkDetectionService';
import BlinkTrackingService from '@/services/BlinkTrackingService';
import EyeImageCaptureService, { EyeImageData } from '@/services/EyeImageCaptureService';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
  const [cameraActive, setCameraActive] = useState(true); // Android 13+ camera remount
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentBlinkCount, setCurrentBlinkCount] = useState(0);
  const [currentDistanceMeasurements, setCurrentDistanceMeasurements] = useState(0);
  const [result, setResult] = useState<BlinkDetectionResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [eyeCaptureEnabled, setEyeCaptureEnabled] = useState(true);
  const [capturedEyeImages, setCapturedEyeImages] = useState<EyeImageData | null>(null);
  const [tooCloseWarning, setTooCloseWarning] = useState(false);
  const cameraRef = useRef<any>(null);
  const lastSpokeRef = useRef<number>(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    
    if (isDetecting) {
      setCountdown(30); 
      interval = setInterval(async () => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
        
        // Update status every second
        try {
          const status = await BlinkDetectionService.getDetectionStatus();
          setCurrentBlinkCount(status.currentBlinkCount);
          setCurrentDistanceMeasurements(status.currentDistanceMeasurements);
        } catch (error) {
          console.error('Failed to get status:', error);
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDetecting]);

  useEffect(() => {
    let removeDistanceListener: (() => void) | undefined;
    if (isDetecting) {
      removeDistanceListener = BlinkDetectionService.onDistanceWarning((distance) => {
        setTooCloseWarning(true);
        
        // Voice alert throttling (max once every 10 seconds)
        const now = Date.now();
        if (now - lastSpokeRef.current > 10000) {
          Speech.speak("Please maintain a safe distance from the screen", {
            rate: 0.9,
            pitch: 1.0,
          });
          lastSpokeRef.current = now;
        }

        // Automatically hide the warning after 2.5 seconds
        setTimeout(() => setTooCloseWarning(false), 2500);
      });
    }
    return () => {
      if (removeDistanceListener) removeDistanceListener();
      setTooCloseWarning(false);
    };
  }, [isDetecting]);

  const handleStartTest = async () => {
    try {
      // Check permission with Android 13+ camera remount
      if (!permission?.granted) {
        // Android 13+ fix: Remount camera after permission grant
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission is required for blink detection');
          return;
        }
        
        // Force camera remount to prevent corruption on Android 13+
        if (Platform.OS === 'android') {
          setCameraActive(false);
          await new Promise(resolve => setTimeout(resolve, 100));
          setCameraActive(true);
        }
      }
      
      console.log('📸 Camera permission granted, starting detection...');
      
      // Request gallery permission BEFORE starting if eye capture is enabled
      if (eyeCaptureEnabled) {
        const hasGalleryPermission = await EyeImageCaptureService.requestGalleryPermissions();
        if (!hasGalleryPermission) {
          Alert.alert(
            'Gallery Permission Required',
            'Eye images will be captured but cannot be saved to your gallery without permission. Continue anyway?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue', onPress: () => {} }
            ]
          );
        }
      }
      
      // Enable eye capture BEFORE starting detection (to avoid race condition)
      if (eyeCaptureEnabled) {
        try {
          await EyeImageCaptureService.enableEyeCapture();
          console.log('👁️ Eye capture enabled');
        } catch (error) {
          console.error('Failed to enable eye capture:', error);
        }
      }
      
      // Reset states
      setResult(null);
      setCurrentBlinkCount(0);
      setCurrentDistanceMeasurements(0);
      setCapturedEyeImages(null);
      
      // Show camera preview
      setShowCamera(true);
      setIsDetecting(true);
      
      // Small delay to ensure camera is rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use the improved runDetectionSession that listens for events
      const detectionResult = await BlinkDetectionService.runDetectionSession();
      setResult(detectionResult);
      setIsDetecting(false);
      setShowCamera(false);
      
      // Disable eye capture and get captured images
      if (eyeCaptureEnabled) {
        try {
          console.log('🔍 Attempting to retrieve eye images...');
          await EyeImageCaptureService.disableEyeCapture();
          
          // Add delay to ensure native files are written and accessible
          console.log('⏳ Waiting for file system sync...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const eyeImages = await EyeImageCaptureService.getLatestEyeImages();
          if (eyeImages) {
            setCapturedEyeImages(eyeImages);
            console.log('✅ Eye images retrieved:', eyeImages);
            
            // Auto-save to gallery
            const saveResult = await EyeImageCaptureService.saveToGallery(eyeImages, true);
            if (saveResult.success) {
              console.log(`✅ Eye images automatically saved to gallery: ${saveResult.albumName}`);
            } else {
              console.warn('⚠️ Eye images captured but not saved to gallery (permission denied or error)');
            }
          } else {
            console.warn('⚠️ No eye images were retrieved after detection');
          }
        } catch (error) {
          console.error('❌ Failed to get eye images:', error);
        }
      }
      
      // Save results to Firestore
      try {
        await BlinkTrackingService.saveBlinkData(detectionResult);
        console.log('✅ Blink data saved to Firestore');
      } catch (saveError) {
        console.error('⚠️ Failed to save blink data:', saveError);
      }
      
      // Show results
      Alert.alert(
        '📊 Detection Results',
        `👁️ Blinks: ${detectionResult.blinkCount}\n📏 Avg Distance: ${detectionResult.averageScreenDistance.toFixed(1)} cm\n📐 Measurements: ${detectionResult.distanceMeasurements}/5\n⏱️ Duration: ${detectionResult.durationSeconds}s${eyeCaptureEnabled ? '\n\n👁️ Eye images captured!\n📸 Saved to Gallery: "Vision Guard Eye Images"' : ''}\n\n✅ Data saved to your profile!`,
        [{ text: 'OK' }]
      );
      
    } catch (error: any) {
      console.error('Start detection error:', error);
      Alert.alert('Error', error.message || 'Failed to start detection');
      setIsDetecting(false);
      setShowCamera(false);
      
      // Disable eye capture on error
      if (eyeCaptureEnabled) {
        try {
          await EyeImageCaptureService.disableEyeCapture();
        } catch (e) {
          console.error('Failed to disable eye capture:', e);
        }
      }
    }
  };

  const handleStopTest = async () => {
    try {
      await BlinkDetectionService.stopDetection();
    } catch (e) {
      console.log('Error stopping detection early:', e);
    }
    
    setIsDetecting(false);
    setShowCamera(false);
    Alert.alert(
      '⚠️ Detection Cancelled',
      'Detection was stopped early.',
      [{ text: 'OK' }]
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // If user navigates away while detecting, stop it
      if (isDetecting) {
        BlinkDetectionService.stopDetection().catch(e => console.log('Cleanup error:', e));
      }
    };
  }, [isDetecting]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Blink & Distance Test</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

      {/* Camera Preview - Only show when detecting */}
      {showCamera && cameraActive && permission?.granted && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          >
            {/* Overlay with face guide */}
            <View style={styles.cameraOverlay}>
              <View style={styles.faceGuide}>
                <Text style={styles.guideText}>Position your face here</Text>
                <Ionicons name="scan-outline" size={200} color="rgba(255,255,255,0.5)" />
              </View>
              
              {/* Live stats on camera */}
              <View style={styles.liveStats}>
                <Text style={styles.liveStatText}>👁️ Blinks: {currentBlinkCount}</Text>
                <Text style={styles.liveStatText}>📏 Checks: {currentDistanceMeasurements}/5</Text>
                <Text style={styles.liveStatText}>⏱️ {countdown}s</Text>
              </View>
              
              {/* Too Close Warning Overlay */}
              {tooCloseWarning && (
                <View style={styles.warningOverlay}>
                  <Ionicons name="warning" size={48} color="#FF3B30" />
                  <Text style={styles.warningText}>TOO CLOSE!</Text>
                  <Text style={styles.warningSubText}>Please move back</Text>
                </View>
              )}
            </View>
          </CameraView>
        </View>
      )}

      {/* Stats Display - Only show when NOT showing camera */}
      {!showCamera && (
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="eye" size={32} color={theme.secondary} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Blinks</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{currentBlinkCount}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="resize" size={32} color={theme.tint} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Distance Checks</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{currentDistanceMeasurements}/5</Text>
          </View>

          {countdown > 0 && (
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="time" size={32} color={theme.warning} />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time Left</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{countdown}s</Text>
            </View>
          )}
        </View>
      )}

      {/* Results Display */}
      {result && (
        <View style={[styles.resultsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.resultsTitle, { color: theme.text }]}>📊 Final Results</Text>
          <View style={[styles.resultRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Total Blinks:</Text>
            <Text style={[styles.resultValue, { color: theme.secondary }]}>{result.blinkCount}</Text>
          </View>
          <View style={[styles.resultRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Average Distance:</Text>
            <Text style={[styles.resultValue, { color: theme.secondary }]}>{result.averageScreenDistance.toFixed(1)} cm</Text>
          </View>
          <View style={[styles.resultRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Distance Measurements:</Text>
            <Text style={[styles.resultValue, { color: theme.secondary }]}>{result.distanceMeasurements}/5</Text>
          </View>
          <View style={[styles.resultRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Duration:</Text>
            <Text style={[styles.resultValue, { color: theme.secondary }]}>{result.durationSeconds}s</Text>
          </View>
          
          {/* Show captured eye images */}
          {capturedEyeImages && (
            <View style={styles.eyeImagesContainer}>
              <Text style={[styles.eyeImagesTitle, { color: theme.text }]}>👁️ Captured Eye Images</Text>
              <View style={styles.eyeImagesRow}>
                <View style={styles.eyeImageWrapper}>
                  <Text style={[styles.eyeLabel, { color: theme.textSecondary }]}>Left Eye</Text>
                  <Image 
                    source={{ uri: capturedEyeImages.leftEyeUri }} 
                    style={styles.eyeImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.eyeImageWrapper}>
                  <Text style={[styles.eyeLabel, { color: theme.textSecondary }]}>Right Eye</Text>
                  <Image 
                    source={{ uri: capturedEyeImages.rightEyeUri }} 
                    style={styles.eyeImage}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {!isDetecting ? (
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: theme.secondary }]} 
            onPress={handleStartTest}
            disabled={isDetecting}
          >
            <Ionicons name="play-circle" size={32} color={theme.background} />
            <Text style={[styles.buttonText, { color: theme.background }]}>Start 30s Detection</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.detectingIndicator}>
              <ActivityIndicator size="large" color={theme.secondary} />
              <Text style={[styles.detectingText, { color: theme.secondary }]}>Detecting...</Text>
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
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>• Allow camera permission when prompted</Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>• Position your face in front of camera</Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>• Enable eye capture to save eye images</Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>• Tap "Start 30s Detection"</Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>• Blink naturally for 30 seconds</Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>• Distance measured every 3 seconds</Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>• Results shown automatically</Text>
        
        {/* Eye Capture Toggle */}
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
        
        {/* View Gallery Button */}
        <TouchableOpacity 
          style={[styles.galleryButton, { backgroundColor: theme.tint + '20', borderColor: theme.tint }]}
          onPress={() => router.push('/eye-images-gallery' as any)}
        >
          <Ionicons name="images-outline" size={20} color={theme.tint} />
          <Text style={[styles.galleryButtonText, { color: theme.tint }]}>View Eye Images Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Tech Info */}
      <View style={styles.techInfo}>
        <Text style={[styles.techText, { color: theme.textSecondary }]}>Powered by ML Kit Face Detection</Text>
        <Text style={[styles.techText, { color: theme.textSecondary }]}>EAR-based blink detection algorithm</Text>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  cameraContainer: {
    width: '100%',
    height: 400,
    marginVertical: 20,
    elevation: 10,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  faceGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  liveStats: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 12,
  },
  liveStatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 3,
  },
  warningOverlay: {
    position: 'absolute',
    top: '35%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF3B30',
  },
  warningText: {
    color: '#FF3B30',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  warningSubText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  statCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  resultsContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 5,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  resultLabel: {
    fontSize: 16,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  startButton: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 5,
  },
  stopButton: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    elevation: 5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detectingIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  detectingText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  instructionsContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  techInfo: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  techText: {
    fontSize: 12,
    marginTop: 4,
  },
  eyeImagesContainer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  eyeImagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  eyeImagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  eyeImageWrapper: {
    alignItems: 'center',
  },
  eyeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  eyeImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 16,
    gap: 8,
  },
  galleryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

