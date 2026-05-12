import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function Index() {
  const [showEmergencyOptions, setShowEmergencyOptions] = useState(false);
  const router = useRouter();
  const { colors } = useTheme();
  
  // Show emergency options after 5 seconds if still loading (DEV ONLY)
  useEffect(() => {
    // Only enable emergency bypass in development mode
    if (__DEV__) {
      const timer = setTimeout(() => {
        setShowEmergencyOptions(true);
      }, 5000) as unknown as NodeJS.Timeout;
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  if (__DEV__ && showEmergencyOptions) {
    return (
      <View style={[styles.emergency, { backgroundColor: colors.background }] }>
        <Text style={[styles.title, { color: colors.text }]}>DEV: App Loading Issue 🚨</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Development bypass options:</Text>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            try {
              // Force navigation to login
              router.replace('/(auth)/Login');
            } catch (error) {
              console.error('Emergency login navigation failed:', error);
            }
          }}
        >
          <Text style={[styles.buttonText, { color: colors.card }]}>Go to Login</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#4CAF50' }]} 
          onPress={() => {
            try {
              // Navigate to blink test
              router.push('/blink-test');
            } catch (error) {
              console.error('Blink test navigation failed:', error);
            }
          }}
        >
          <Text style={[styles.buttonText, { color: '#fff' }]}>🧪 Test Blink Detection</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return <Redirect href="/splash/splashScreen" />;
}

const styles = StyleSheet.create({
  emergency: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
