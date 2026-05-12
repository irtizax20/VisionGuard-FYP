import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    NativeModules,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { BlinkDetectionModule } = NativeModules;

export default function ManualEyeCaptureScreen() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.darkHighContrast : Colors.lightHighContrast;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(true); // Android 13+ camera remount
  const [galleryPermission, requestGalleryPermission] = MediaLibrary.usePermissions({ writeOnly: false });
  const [showCamera, setShowCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [originalBrightness, setOriginalBrightness] = useState<number | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Cleanup: Restore brightness when component unmounts
  useEffect(() => {
    return () => {
      // Restore brightness when user leaves this screen
      if (Platform.OS === 'android' && originalBrightness !== null) {
        Brightness.setBrightnessAsync(originalBrightness).catch(err => 
          console.error('Failed to restore brightness on unmount:', err)
        );
      }
    };
  }, [originalBrightness]);

  const requestCameraPermission = async () => {
    try {
      // Request camera permission first
      const cameraResult = await requestPermission();
      if (cameraResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to capture eye images');
        return;
      }
      console.log('📸 Camera permission granted');
      
      // Android 13+ fix: Remount camera after permission grant
      if (Platform.OS === 'android') {
        setCameraActive(false);
        await new Promise(resolve => setTimeout(resolve, 100));
        setCameraActive(true);
      }
      
      // Request full media library access (not just write)
      console.log('📸 Requesting gallery permissions...');
      const galleryResult = await MediaLibrary.requestPermissionsAsync(false);
      console.log('📸 Gallery permission result:', galleryResult);
      
      if (galleryResult.status !== 'granted') {
        Alert.alert(
          'Permission Required', 
          'Media library permission is needed to save images. Please grant "Allow access to media only" in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => requestCameraPermission() }
          ]
        );
        return;
      }
      console.log('✅ Gallery permission granted');
      
      await startCapture();
    } catch (error) {
      console.error('Permission error:', error);
      Alert.alert('Error', `Failed to request permissions: ${error}`);
    }
  };

  const startCapture = async () => {
    try {
      setIsCapturing(true);

      if (Platform.OS === 'android') {
        // Save original brightness ONLY first time
        if (originalBrightness === null) {
          const current = await Brightness.getBrightnessAsync();
          setOriginalBrightness(current);
          console.log(`💡 Original brightness saved: ${current}`);
        }
        
        // ALWAYS set brightness to maximum when camera opens (even for retakes)
        await Brightness.setBrightnessAsync(1.0);
        console.log('💡 Brightness set to maximum for camera');
      }

      setShowCamera(true);
      setIsCapturing(false);
    } catch (error) {
      console.error('Failed to start capture:', error);
      Alert.alert('Error', 'Failed to start camera');
      setIsCapturing(false);
      await restoreBrightness();
    }
  };

  const captureImage = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready. Please try again.');
      return;
    }

    try {
      setIsCapturing(true);
      console.log('📸 Taking photo...');

      // Take photo with camera
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: false,
        skipProcessing: false,
      });

      if (photo) {
        console.log('✅ Photo captured:', photo.uri);
        setCapturedPhoto(photo.uri);
        setShowCamera(false);
        
        // Save to gallery
        await saveToGallery(photo.uri);
      } else {
        throw new Error('Failed to capture photo');
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', `Failed to capture photo: ${error}`);
      setIsCapturing(false);
    }
  };

  const saveToGallery = async (photoUri: string) => {
    try {
      console.log('💾 Saving to gallery...');
      console.log('📍 Photo URI:', photoUri);
      
      // Request permission if not already granted
      const permission = await MediaLibrary.getPermissionsAsync();
      console.log('🔐 Current permission status:', permission);
      
      if (!permission.granted) {
        console.log('🔓 Requesting media library permission...');
        const newPermission = await MediaLibrary.requestPermissionsAsync(false);
        console.log('🔐 New permission status:', newPermission);
        
        if (!newPermission.granted) {
          throw new Error('Media library permission is required to save photos');
        }
      }
      
      // Extract left and right eye images using ML Kit
      console.log('👁️ Extracting eye regions from photo...');
      try {
        const eyeRegions = await BlinkDetectionModule.extractEyeRegionsFromPhoto(photoUri);
        console.log('✅ Eye regions extracted:', eyeRegions);
        
        // Save all three images: full photo, left eye, right eye
        
        // 1. Save full photo
        console.log('📝 Creating asset from full photo...');
        const fullAsset = await MediaLibrary.createAssetAsync(photoUri);
        console.log('✅ Full photo asset created:', fullAsset.id);
        
        // 2. Save left eye
        console.log('📝 Creating asset from left eye...');
        const leftEyeAsset = await MediaLibrary.createAssetAsync(eyeRegions.leftEyeUri);
        console.log('✅ Left eye asset created:', leftEyeAsset.id);
        
        // 3. Save right eye
        console.log('📝 Creating asset from right eye...');
        const rightEyeAsset = await MediaLibrary.createAssetAsync(eyeRegions.rightEyeUri);
        console.log('✅ Right eye asset created:', rightEyeAsset.id);
        
        // Create or get album
        console.log('📁 Looking for existing album...');
        const album = await MediaLibrary.getAlbumAsync('Vision Guard Eye Images');
        
        if (album) {
          console.log('📁 Album exists, adding assets...');
          await MediaLibrary.addAssetsToAlbumAsync([fullAsset, leftEyeAsset, rightEyeAsset], album, false);
        } else {
          console.log('📁 Creating new album with assets...');
          await MediaLibrary.createAlbumAsync('Vision Guard Eye Images', fullAsset, false);
          const newAlbum = await MediaLibrary.getAlbumAsync('Vision Guard Eye Images');
          if (newAlbum) {
            await MediaLibrary.addAssetsToAlbumAsync([leftEyeAsset, rightEyeAsset], newAlbum, false);
          }
        }

        console.log('✅ All images saved to gallery (Full + Left Eye + Right Eye)');
        setIsCapturing(false);

        Alert.alert(
          '✅ Success!',
          'Eye images captured:\n• Full face photo\n• Left eye\n• Right eye\n\nAll saved to "Vision Guard Eye Images" album.',
          [
            { text: 'Take Another', onPress: () => retakePhoto() },
            { 
              text: 'Done', 
              onPress: async () => {
                await restoreBrightness();
                router.back();
              }
            }
          ]
        );
      } catch (eyeError) {
        console.warn('⚠️ Could not extract eye regions, saving full photo only:', eyeError);
        
        // Fallback: Save only the full photo if eye extraction fails
        const asset = await MediaLibrary.createAssetAsync(photoUri);
        console.log('✅ Asset created:', asset.id);
        
        const album = await MediaLibrary.getAlbumAsync('Vision Guard Eye Images');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('Vision Guard Eye Images', asset, false);
        }

        console.log('✅ Photo saved to gallery (full photo only)');
        setIsCapturing(false);

        Alert.alert(
          '⚠️ Partial Success',
          'Photo saved, but could not detect eyes for separate extraction.\n\nFull face photo saved to gallery.',
          [
            { text: 'Take Another', onPress: () => retakePhoto() },
            { 
              text: 'Done', 
              onPress: async () => {
                await restoreBrightness();
                router.back();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to save to gallery: ${error}`);
      await restoreBrightness();
      setIsCapturing(false);
    }
  };

  const retakePhoto = async () => {
    setCapturedPhoto(null);
    // Don't restore brightness - keep it at max for next capture
    setShowCamera(true);
  };

  const restoreBrightness = async () => {
    try {
      if (Platform.OS === 'android' && originalBrightness !== null) {
        await Brightness.setBrightnessAsync(originalBrightness);
        console.log(`💡 Brightness restored to: ${originalBrightness}`);
        setOriginalBrightness(null);
      }
    } catch (error) {
      console.error('Failed to restore brightness:', error);
    }
  };

  const handleClose = async () => {
    setCapturedPhoto(null);
    setShowCamera(false);
    await restoreBrightness();
    setIsCapturing(false);
    
    // Go back to previous screen
    router.back();
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text }]}>Camera Permission Required</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            We need camera access to capture eye images for analysis
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={requestCameraPermission}
          >
            <Text style={[styles.buttonText, { color: theme.background }]}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.border }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: theme.text }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show captured photo preview
  if (capturedPhoto) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
          <ActivityIndicator size="large" color={theme.primary} style={styles.savingIndicator} />
          <Text style={[styles.savingText, { color: theme.text }]}>Saving to gallery...</Text>
        </View>
      </View>
    );
  }

  if (showCamera && cameraActive && permission?.granted) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />
        
        {/* Overlay with absolute positioning */}
        <View style={styles.cameraOverlay}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={isCapturing}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.instructions}>
            <View style={styles.instructionCard}>
              <Text style={styles.instructionTitle}>📸 Tips for Best Results</Text>
              <Text style={styles.instructionText}>• Position your face in center</Text>
              <Text style={styles.instructionText}>• Keep eyes wide open</Text>
              <Text style={styles.instructionText}>• Good lighting helps</Text>
              <Text style={styles.instructionText}>• Hold device steady</Text>
            </View>
          </View>

          <View style={styles.captureButtonContainer}>
            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.capturingButton]}
              onPress={captureImage}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Ionicons name="camera" size={40} color="#fff" />
              )}
            </TouchableOpacity>
            <Text style={styles.captureText}>
              {isCapturing ? 'Capturing...' : 'Tap to Capture'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Ionicons name="camera" size={100} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>Manual Eye Image Capture</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Capture high-quality eye images for analysis
        </Text>

        <View style={styles.featuresList}>
          <View style={styles.feature}>
            <Ionicons name="flash" size={24} color={theme.secondary} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              Auto brightness for clarity
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="camera" size={24} color={theme.secondary} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              One-tap instant capture
            </Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="images-outline" size={24} color={theme.secondary} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              Auto-saves to gallery album
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={requestCameraPermission}
          disabled={isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color={theme.background} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.background }]}>Start Capture</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backButton, { borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: theme.text }]}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  featuresList: {
    width: '100%',
    marginBottom: 30,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 15,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 2,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    height: '70%',
    borderRadius: 12,
  },
  savingIndicator: {
    marginTop: 20,
  },
  savingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
  },
  instructions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionCard: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    padding: 20,
    maxWidth: 300,
  },
  instructionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  captureButtonContainer: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6FCF97',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  capturingButton: {
    backgroundColor: '#999',
  },
  captureText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
