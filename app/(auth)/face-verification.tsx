import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Dimensions, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase/firebaseConfig';
import FaceDetectionService from '../../services/FaceDetectionService';

const { width } = Dimensions.get('window');

export default function FaceVerificationScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoTaken, setPhotoTaken] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [storedFaceHash, setStoredFaceHash] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

 
  useEffect(() => {
    return () => {
      // Cleanup camera ref on unmount
      if (cameraRef.current) {
        cameraRef.current = null;
      }
    };
  }, []);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Handle back button press - logout and go to login
      (async () => {
        try {
          setCameraActive(false);
          if (cameraRef.current) {
            cameraRef.current = null;
          }
          console.log('🔙 Back button pressed, logging out...');
          await signOut(auth);
          router.replace('/(auth)/Login');
        } catch (error) {
          console.error('❌ Error during back press:', error);
          router.replace('/(auth)/Login');
        }
      })();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  // Always request permission on mount (every time user logs in)
  useEffect(() => {
    if (!permission) return;

    // Always request permission, even if previously denied
    // This ensures permission is asked again on every login
    if (!permission.granted) {
      // Small delay to let screen render first
      setTimeout(async () => {
        console.log('📸 Requesting camera permission...');
        const result = await requestPermission();
        
        // Android 13+ fix: Force component remount after permission granted
        if (result.granted) {
          console.log('✅ Camera permission granted, reactivating camera...');
          setCameraActive(false);
          setTimeout(() => {
            setCameraActive(true);
          }, 100);
        }
      }, 500);
    }

    // Get stored face data for current user
    (async () => {
      try {
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'user', auth.currentUser.uid));
          if (userDoc.exists()) {
            const faceHash = userDoc.data().faceHash;
            
            // Check if old format (has width/height instead of embedding)
            if (faceHash) {
              try {
                const faceData = JSON.parse(faceHash);
                
                // Old format detection: has width/height but no embedding
                if (faceData.width && faceData.height && !faceData.embedding) {
                  console.log('⚠️ Old face format detected - forcing re-registration');
                  // Clear old data - user will re-register
                  setStoredFaceHash(null);
                  Alert.alert(
                    'Face Re-registration Required',
                    'We have upgraded our face recognition system for better security. Please register your face again.',
                    [{ text: 'OK' }]
                  );
                } else {
                  // New format - proceed normally
                  setStoredFaceHash(faceHash);
                }
              } catch (parseError) {
                // Invalid data - force re-registration
                console.warn('⚠️ Invalid face data - forcing re-registration');
                setStoredFaceHash(null);
              }
            }
          }
        }
      } catch (error) {
        Alert.alert('Error', 'Could not retrieve user data');
      }
    })();
  }, []);

  // Handle permission denial - auto-redirect to login
  const handlePermissionRequest = async () => {
    const result = await requestPermission();
    if (result && !result.granted) {
      Alert.alert(
        'Camera Permission Required',
        'Camera access is required for face verification. You will be redirected to login in 3 seconds.',
        [
          {
            text: 'OK',
            onPress: async () => {
              try {
                console.log('🚪 Camera permission denied, logging out...');
                await signOut(auth);
                router.replace('/(auth)/Login');
              } catch (error) {
                console.error('❌ Error during logout:', error);
                router.replace('/(auth)/Login');
              }
            }
          }
        ]
      );

      // Auto-redirect after 3 seconds if user doesn't press OK
      setTimeout(async () => {
        try {
          console.log('🚪 Auto-redirecting to login after permission denial...');
          await signOut(auth);
          router.replace('/(auth)/Login');
        } catch (error) {
          console.error('❌ Error during auto-redirect:', error);
          router.replace('/(auth)/Login');
        }
      }, 3000);
    }
  };

  // Silently request notification permission only (no blocking dialogs)
  const requestNotificationPermission = async (): Promise<void> => {
    try {
      console.log('🔔 Silently requesting notification permission...');
      const notificationStatus = await Notifications.getPermissionsAsync();
      if (notificationStatus.status !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          console.log('✅ Notification permission granted');
        } else {
          console.log('⚠️ Notification permission denied');
        }
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
    }
  };

  const handleFaceAction = async () => {
    console.log('[FaceVerification] 📸 Button clicked - starting face action');
    if (storedFaceHash) {
      await verifyFace();
    } else {
      await registerFace();
    }
  };

  const registerFace = async () => {
    if (registering) return;
    setRegistering(true);

    try {
      if (!cameraRef.current) {
        throw new Error('Camera not available. Please restart the app.');
      }
      
      if (!auth.currentUser) {
        throw new Error('User not authenticated. Please log in again.');
      }
      
      if (cameraRef.current && auth.currentUser) {
        // Wait a moment for user to position face
        await new Promise(resolve => setTimeout(resolve, 1000));

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8, // Higher quality for better face detection
          base64: false,
          skipProcessing: false, // Enable processing for better quality
        });

        console.log('📸 Photo captured, processing with ML Kit...');

        // Check for duplicate face first (also validates quality and liveness)
        console.log('🔍 Checking for duplicate face and validating quality...');
        let duplicateCheck;
        try {
          duplicateCheck = await FaceDetectionService.checkFaceDuplicate(
            photo.uri,
            auth.currentUser.uid
          );
        } catch (validationError: any) {
          // Quality or liveness validation failed
          setCameraActive(false);
          if (cameraRef.current) {
            cameraRef.current = null;
          }
          setRegistering(false);
          
          Alert.alert(
            'Face Validation Failed',
            validationError.message || 'Could not validate face. Please try again.',
            [
              {
                text: 'Try Again',
                onPress: () => {
                  setCameraActive(true);
                }
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: async () => {
                  try {
                    await signOut(auth);
                    router.replace('/(auth)/Login');
                  } catch (error) {
                    router.replace('/(auth)/Login');
                  }
                }
              }
            ]
          );
          return;
        }
        
        if (duplicateCheck.isDuplicate) {
          // Face already registered to another account
          setCameraActive(false);
          if (cameraRef.current) {
            cameraRef.current = null;
          }
          setRegistering(false);
          
          Alert.alert(
            'Face Already Registered',
            `This face is already registered to another account.\n\nSimilarity: ${(duplicateCheck.similarity! * 100).toFixed(1)}%\n\nOnly one account per person is allowed. Please login with your existing account or use a different face.`,
            [
              {
                text: 'Go to Login',
                onPress: async () => {
                  try {
                    await signOut(auth);
                    router.replace('/(auth)/Login');
                  } catch (error) {
                    router.replace('/(auth)/Login');
                  }
                }
              }
            ]
          );
          return;
        }
        
        console.log('✅ No duplicate found, proceeding with registration...');

        // Use ML Kit to register face (reuse already detected & validated data)
        const faceData = await FaceDetectionService.registerFace(
          photo.uri,
          duplicateCheck.detectedEmbedding, // Pass pre-detected embedding
          duplicateCheck.detectedFace // Pass pre-detected face to avoid re-detection
        );
        
        console.log(`✅ Face registered with quality: ${faceData.metadata.quality}%`);

        // Immediately turn off camera after processing
        setCameraActive(false);
        if (cameraRef.current) {
          cameraRef.current = null;
        }

        // Store face data in Firestore
        const faceDataString = JSON.stringify(faceData);
        const userRef = doc(db, 'user', auth.currentUser.uid);
        await updateDoc(userRef, { faceHash: faceDataString });

        setStoredFaceHash(faceDataString);

        // Mark face verification as completed after registration
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('faceVerificationCompleted', 'true');
        console.log('✅ Face registered and verification marked as completed');

        // Initialize services now that face verification is complete
        try {
          const ServiceInitializer = (await import('../../services/ServiceInitializer')).default;
          await ServiceInitializer.getInstance().initializeServices();
          console.log('✅ Services initialized after face registration');
        } catch (err) {
          console.warn('⚠️ Service init failed:', err);
        }

        // Reset registering state before navigation
        setRegistering(false);

        // Silently request notification permission (non-blocking)
        requestNotificationPermission();

        // Fetch user data from database (non-blocking)
        if (auth.currentUser) {
          getDoc(doc(db, 'user', auth.currentUser.uid))
            .then((userDoc) => {
              if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('✅ User data fetched successfully:', userData.name || 'User');
              }
            })
            .catch((error) => {
              console.error('❌ Error fetching user data:', error);
            });
        }

        // Navigate to welcome screen after successful registration
        console.log('🚀 Face registered - navigating to Welcome screen...');
        router.replace('/(auth)/welcome');
      }
    } catch (error: any) {
      console.error('❌ Face registration failed:', error);
      // Turn off camera on error
      setCameraActive(false);
      if (cameraRef.current) {
        cameraRef.current = null;
      }
      setRegistering(false);

      // Clear cached screen time data on registration failure
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const today = new Date();
        await AsyncStorage.removeItem('global_screen_time_cache');
        await AsyncStorage.removeItem(`screenTime_${today.toDateString()}`);
        console.log('🗑️ Cache cleared due to registration failure');
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear cache:', cacheError);
      }

      Alert.alert(
        'Registration Failed',
        error.message || 'Face registration failed. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setCameraActive(true);
            }
          },
          {
            text: 'Logout',
            style: 'cancel',
            onPress: async () => {
              try {
                await signOut(auth);
                router.replace('/(auth)/Login');
              } catch (logoutError) {
                console.error('❌ Logout error:', logoutError);
                router.replace('/(auth)/Login');
              }
            }
          }
        ]
      );
    }
  };

  const verifyFace = async () => {
    if (verifying) return;
    setVerifying(true);
    
    console.log('[FaceVerification] 🔍 Starting verification process...');

    try {
      if (cameraRef.current && storedFaceHash) {
        // Wait a moment for user to position face
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[FaceVerification] 📸 Taking picture...');
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: false,
        });

        console.log('[FaceVerification] 📸 Photo captured, verifying with ML Kit...');

        // Parse stored face data
        const storedFaceData = JSON.parse(storedFaceHash);

        // Use ML Kit to verify face
        const verificationResult = await FaceDetectionService.verifyFace(photo.uri, storedFaceData);
        
        console.log(`[FaceVerification] Verification result: ${verificationResult.success}, Similarity: ${(verificationResult.similarity * 100).toFixed(1)}%`);

        // Immediately turn off camera after verification
        setCameraActive(false);
        if (cameraRef.current) {
          cameraRef.current = null;
        }

        if (verificationResult.success) {
          // Verification successful
          setPhotoTaken(true);

          // Mark face verification as completed in AsyncStorage
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('faceVerificationCompleted', 'true');
          console.log('[FaceVerification] ✅ Face verification completed and saved');

          // Initialize services now that face verification is complete
          try {
            console.log('[FaceVerification] 🚀 Initializing services...');
            const ServiceInitializer = (await import('../../services/ServiceInitializer')).default;
            await ServiceInitializer.getInstance().initializeServices();
            console.log('[FaceVerification] ✅ Services initialized after face verification');
          } catch (err) {
            console.warn('[FaceVerification] ⚠️ Service init failed:', err);
          }

          // Reset verifying state before navigation
          setVerifying(false);

          // Silently request notification permission (non-blocking)
          requestNotificationPermission();

          // Fetch user data from database (non-blocking)
          if (auth.currentUser) {
            getDoc(doc(db, 'user', auth.currentUser.uid))
              .then((userDoc) => {
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  console.log('✅ User data fetched successfully:', userData.name || 'User');
                }
              })
              .catch((error) => {
                console.error('❌ Error fetching user data:', error);
              });
          }

          // Navigate to welcome screen after successful verification
          console.log('🚀 Face verified - navigating to Welcome screen...');
          router.replace('/(auth)/welcome');
        } else {
          // Verification failed
          setVerifying(false);
          
          Alert.alert(
            'Verification Failed',
            verificationResult.message + `\n\nSimilarity: ${(verificationResult.similarity * 100).toFixed(1)}%`,
            [
              {
                text: 'Try Again',
                onPress: () => {
                  setCameraActive(true);
                }
              },
              {
                text: 'Logout',
                style: 'cancel',
                onPress: async () => {
                  try {
                    await signOut(auth);
                    router.replace('/(auth)/Login');
                  } catch (logoutError) {
                    console.error('❌ Logout error:', logoutError);
                    router.replace('/(auth)/Login');
                  }
                }
              }
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Face verification failed:', error);
      // Turn off camera on error
      setCameraActive(false);
      if (cameraRef.current) {
        cameraRef.current = null;
      }
      setVerifying(false);

      // Clear cached screen time data on verification failure
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const today = new Date();
        await AsyncStorage.removeItem('global_screen_time_cache');
        await AsyncStorage.removeItem(`screenTime_${today.toDateString()}`);
        console.log('🗑️ Cache cleared due to verification failure');
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear cache:', cacheError);
      }

      Alert.alert(
        'Verification Failed',
        'Face verification failed. Redirecting to login.',
        [
          {
            text: 'OK',
            onPress: async () => {
              try {
                await signOut(auth);
                router.replace('/(auth)/Login');
              } catch (logoutError) {
                console.error('❌ Logout error:', logoutError);
                router.replace('/(auth)/Login');
              }
            }
          }
        ]
      );
    }
  };

  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="camera-outline" size={80} color="#999" style={{ marginBottom: 20 }} />
        <Text style={styles.permissionText}>Camera permission is required for face verification</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handlePermissionRequest}>
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </TouchableOpacity>
        <Text style={[styles.permissionText, { fontSize: 14, marginTop: 20, opacity: 0.7 }]}>
          Denying permission will redirect you to login
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {cameraActive && (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
            />
          )}
          <View style={styles.overlay}>
            <View style={styles.headerContainer}>
              <Ionicons name={storedFaceHash ? "shield-checkmark" : "scan-outline"} size={50} color="#fff" />
              <Text style={styles.titleText}>{storedFaceHash ? 'Face Verification' : 'Face Verification Setup'}</Text>
              <Text style={styles.instructionText}>
                {storedFaceHash ? 'Position your face and tap to verify' : 'Position your face to verify your identity'}
              </Text>
            </View>

        <TouchableOpacity
          style={[styles.verifyButton, (verifying || registering) && styles.disabledButton]}
          onPress={handleFaceAction}
          disabled={verifying || registering}
        >
          {verifying ? (
            <Ionicons name="hourglass" size={32} color="#fff" />
          ) : (
            <Ionicons name="scan" size={32} color="#fff" />
          )}
          <Text style={styles.buttonText}>
            {verifying ? 'Verifying...' : registering ? 'Verifying Face...' : storedFaceHash ? 'Verify Face' : 'Start Verification'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={async () => {
            try {
              // Cleanup camera
              setCameraActive(false);
              if (cameraRef.current) {
                cameraRef.current = null;
              }

              // Logout user
              console.log('🚺 User cancelled face verification, logging out...');
              await signOut(auth);

              // Navigate back to login
              router.replace('/(auth)/Login');
            } catch (error) {
              console.error('❌ Error during cancel:', error);
              // Still try to go back even if logout fails
              router.replace('/(auth)/Login');
            }
          }}
        >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    minHeight: Dimensions.get('window').height,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 30,
    paddingTop: 60,
  },
  headerContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 15,
  },
  titleText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  verifyButton: {
    backgroundColor: '#2B383D',
    borderRadius: 50,
    padding: 20,
    borderWidth: 3,
    borderColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
    borderColor: '#999',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 15,
    borderRadius: 25,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  permissionButton: {
    backgroundColor: '#2B383D',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
