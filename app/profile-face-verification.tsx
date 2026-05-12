import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';
import { useTheme } from '../hooks/useTheme';
import FaceDetectionService, { type FaceData } from '../services/FaceDetectionService';
import { safeJSONParse } from '../utils/errorHandling';

const { width } = Dimensions.get('window');

export default function ProfileFaceVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, fonts, spacing, borderRadius } = useTheme();

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [verifying, setVerifying] = useState(false);
  const [storedFaceHash, setStoredFaceHash] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<any>(null);
  const [cameraActive, setCameraActive] = useState(true);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
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
      }, 300);
    }

    if (params.pendingChanges) {
      try {
        const changes = safeJSONParse(params.pendingChanges as string, {});
        if (changes && typeof changes === 'object') {
          setPendingChanges(changes);
        } else {
          Alert.alert('Error', 'Invalid data received');
          router.back();
        }
      } catch (error) {
        console.error('Error parsing pending changes:', error);
        Alert.alert('Error', 'Invalid data received');
        router.back();
      }
    }

    // Get stored face data for current user
    (async () => {
      try {
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'user', auth.currentUser.uid));
          if (userDoc.exists()) {
            setStoredFaceHash(userDoc.data().faceHash);
          } else {
            Alert.alert('Error', 'No face data found. Please register your face first.');
            router.back();
          }
        }
      } catch (error) {
        Alert.alert('Error', 'Could not retrieve user data');
        router.back();
      }
    })();
  }, [permission, params.pendingChanges]);


  const verifyFace = async () => {
    if (verifying || !storedFaceHash) return;
    setVerifying(true);

    try {
      if (!cameraRef.current) {
        throw new Error('Camera not available. Please try again.');
      }
      
      if (cameraRef.current) {
        // Wait a moment for user to position face
        await new Promise(resolve => setTimeout(resolve, 1000));

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: false,
        });

        console.log('📸 Photo captured, verifying with ML Kit...');

        // Parse stored face data
        const storedFaceData = safeJSONParse(storedFaceHash, null) as FaceData | null;
        
        if (!storedFaceData || !storedFaceData.embedding) {
          throw new Error('Invalid stored face data. Please register your face again.');
        }

        // Use ML Kit to verify face
        const verificationResult = await FaceDetectionService.verifyFace(photo.uri, storedFaceData);
        
        console.log(`Verification result: ${verificationResult.success}, Similarity: ${(verificationResult.similarity * 100).toFixed(1)}%`);

        if (verificationResult.success) {
          // Face verified successfully - save pending changes
          if (pendingChanges && (global as any).saveProfileChanges) {
            await (global as any).saveProfileChanges(pendingChanges);
          }

          Alert.alert(
            'Profile Updated Successfully! ✅',
            `Face verification completed (${(verificationResult.similarity * 100).toFixed(1)}% match).\n\nYour profile changes have been saved.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  // Navigate back to profile edit or main app
                  router.replace('/(tabs)/Setting');
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Verification Failed',
            `🚫 ${verificationResult.message}\n\nSimilarity: ${(verificationResult.similarity * 100).toFixed(1)}%\n\nProfile changes were not saved. Please try again.`,
            [
              { text: 'Try Again', onPress: () => setVerifying(false) },
              {
                text: 'Cancel',
                onPress: () => router.back(),
                style: 'cancel'
              }
            ]
          );
          setVerifying(false);
        }
      }
    } catch (error: any) {
      Alert.alert('Verification Error', error.message || 'Verification failed. Please try again.');
      setVerifying(false);
    }
  };

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
      backgroundColor: colors.background,
    },
    backButton: {
      padding: spacing.sm,
      marginRight: spacing.md,
    },
    headerTitle: {
      fontSize: fonts.large,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    infoSection: {
      backgroundColor: colors.card,
      margin: spacing.md,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    infoText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    changesContainer: {
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
    },
    changesTitle: {
      fontSize: fonts.medium,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    changeItem: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    camera: {
      flex: 1,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    cameraOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    faceOutline: {
      width: width * 0.7,
      height: width * 0.7,
      borderRadius: (width * 0.7) / 2,
      borderWidth: 3,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    instructionText: {
      position: 'absolute',
      bottom: spacing.xl,
      left: spacing.md,
      right: spacing.md,
      textAlign: 'center',
      fontSize: fonts.medium,
      color: colors.background,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: spacing.md,
      borderRadius: borderRadius.md,
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: spacing.md,
      backgroundColor: colors.background,
    },
    button: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      minWidth: 120,
    },
    verifyButton: {
      backgroundColor: colors.primary,
    },
    cancelButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.error,
    },
    buttonText: {
      fontSize: fonts.medium,
      fontWeight: '600',
    },
    verifyButtonText: {
      color: colors.background,
    },
    cancelButtonText: {
      color: colors.error,
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: spacing.xl,
    },
    permissionText: {
      fontSize: fonts.large,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.lg,
    },
    permissionButtonText: {
      color: colors.background,
      fontSize: fonts.medium,
      fontWeight: '600',
    },
  }), [colors, fonts, spacing, borderRadius]);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera permission is required for face verification
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Verification Required</Text>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>🔐 Security Check</Text>
        <Text style={styles.infoText}>
          For your security, we need to verify your identity before applying sensitive profile changes.
        </Text>

        {pendingChanges && (
          <View style={styles.changesContainer}>
            <Text style={styles.changesTitle}>Pending Changes:</Text>
            {pendingChanges.dateOfBirth && (
              <Text style={styles.changeItem}>
                • Date of Birth: {new Date(pendingChanges.dateOfBirth).toLocaleDateString()}
              </Text>
            )}
            <Text style={styles.changeItem}>• Name: {pendingChanges.name}</Text>
            <Text style={styles.changeItem}>• Category: {pendingChanges.category}</Text>
            {pendingChanges.parentEmail && (
              <Text style={styles.changeItem}>• Parent Email: {pendingChanges.parentEmail}</Text>
            )}
          </View>
        )}
      </View>

      {/* Camera */}
      {cameraActive && permission?.granted && (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.faceOutline} />
            <Text style={styles.instructionText}>
              Position your face within the circle and tap &quot;Verify Face&quot; when ready
            </Text>
          </View>
        </CameraView>
      )}

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.verifyButton]}
          onPress={verifyFace}
          disabled={verifying}
        >
          <Text style={[styles.buttonText, styles.verifyButtonText]}>
            {verifying ? 'Verifying...' : 'Verify Face'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
