import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, BackHandler, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { auth, db } from '../firebase/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { router } from 'expo-router';

export default function LockScreen() {
  const { colors } = useTheme();
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    // 1. Disable hardware back button
    const backAction = () => {
      return true; // Return true prevents default behavior
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    // 2. Listen to Firestore for unlock
    let unsubscribe = () => {};
    const user = auth.currentUser;
    
    if (user) {
      const userRef = doc(db, 'user', user.uid);
      unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!data.isLocked) {
            console.log('🔓 Device unlocked by parent!');
            setIsLocked(false);
            router.replace('/(tabs)/Main');
          }
        }
      });
    } else {
      router.replace('/(auth)/LoginScreen');
    }

    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Ionicons name="lock-closed" size={120} color={colors.error} style={styles.icon} />
        <Text style={[styles.title, { color: colors.text }]}>Device Locked</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your device has been locked by your parent. 
          Please wait until they unlock it from their dashboard.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
});
