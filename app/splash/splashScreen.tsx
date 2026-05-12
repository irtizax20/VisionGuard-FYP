import React, { useEffect, useRef } from 'react';
import { Animated, Alert, Image, StyleSheet, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged,Auth } from 'firebase/auth';
import { auth } from '../../firebase/firebaseConfig';
import { useCameraPermissions } from 'expo-camera';
import { FirestoreUtils } from '../../utils/firestoreUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen() {
  const router = useRouter();
  const loadingAnim = useRef(new Animated.Value(0)).current;
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    console.log('🚀 Splash screen started');

    Animated.timing(loadingAnim, {
      toValue: 1,
      duration: 2000, // Reduced duration
      useNativeDriver: false,
    }).start(() => {
      console.log('✅ Loading animation completed');
      checkAuthState();
    });
    
    // Cleanup function
    return () => {
      console.log('🧹 Splash screen cleanup');
    };
  }, []);
  
  const checkAuthState = async () => {
    console.log('🔍 Checking auth state...');
    
    try {
      // First check if user is already available immediately
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('✅ User already authenticated');
        
        // Check if face verification is completed
        const faceVerified = await AsyncStorage.getItem('faceVerificationCompleted');
        if (faceVerified === 'true') {
          console.log('✅ Face verification completed, navigating to Main');
          router.replace('/(tabs)/Main');
        } else {
          console.log('⚠️ Face verification required, navigating to face verification');
          router.replace('/(auth)/face-verification');
        }
        return;
      }
      
      let hasNavigated = false;
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (hasNavigated) return; // Prevent multiple navigations
        
        console.log('👤 Auth state changed:', user ? 'Logged in' : 'Logged out');
        hasNavigated = true;
        
        // Unsubscribe immediately to prevent multiple calls
        unsubscribe();
        
        if (user) {
          console.log('✅ User found');
          
          // Check face verification status
          const faceVerified = await AsyncStorage.getItem('faceVerificationCompleted');
          if (faceVerified === 'true') {
            console.log('✅ Face verification completed, navigating to Main');
            router.replace('/(tabs)/Main');
          } else {
            console.log('⚠️ Face verification required, navigating to face verification');
            router.replace('/(auth)/face-verification');
          }
        } else {
          console.log('❌ No user, navigating to Login');
          router.replace('/(auth)/Login');
        }
      });
      
      // Reduced timeout to 3 seconds since we check currentUser first
      const timeoutId = setTimeout(() => {
        if (!hasNavigated) {
          hasNavigated = true;
          unsubscribe();
          
          // Final fallback - navigate to login if still no user
          console.log('❌ Auth check timeout, navigating to Login');
          router.replace('/(auth)/Login');
        }
      }, 3000);
      
      // Clear timeout if we navigate earlier
      const originalUnsubscribe = unsubscribe;
      return () => {
        clearTimeout(timeoutId);
        originalUnsubscribe();
      };
      
    } catch (error) {
      console.error('❌ Auth check error:', error);
      router.replace('/(auth)/Login');
    }
  };

  const loadingBarWidth = loadingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Vision Guard</Text>
        <Text style={styles.tagline}>Your Eye Health Companion</Text>
      </View>

      {/* Loading Section */}
      <View style={styles.loadingSection}>
        <Text style={styles.loadingText}>Loading...</Text>
        <View style={styles.loadingBarContainer}>
          <Animated.View style={[styles.loadingBarFill, { width: loadingBarWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2B383D',
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  appName: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FAFAFA',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    color: '#8A9BA8',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingSection: {
    paddingBottom: 50,
    alignItems: 'center',
  },
  loadingText: {
    color: '#FAFAFA',
    fontSize: 16,
    marginBottom: 15,
  },
  loadingBarContainer: {
    width: 250,
    height: 8,
    backgroundColor: '#4A555A', // Darker gray for bar background
    borderRadius: 4,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: '#FAFAFA', // Off-white loading progress
  },
});
