import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ServiceInitializer from '../../services/ServiceInitializer';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(false);

  const handleOkayPress = async () => {
    setInitializing(true);
    
    try {
      
      console.log('🔧 Initializing services from welcome screen...');
      const serviceInitializer = ServiceInitializer.getInstance();
      await serviceInitializer.initializeServices();
      console.log('✅ Services initialized successfully');
      
      // Navigate to Main page
      console.log('🚀 Navigating to Main page...');
      router.replace('/(tabs)/Main');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      // Navigate anyway
      router.replace('/(tabs)/Main');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={120} color="#4CAF50" />
        </View>

        {/* Welcome Message */}
        <Text style={styles.title}>Welcome to Vision Guard!</Text>
        <Text style={styles.subtitle}>Your eye health journey starts now</Text>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="eye-outline" size={24} color="#2B383D" />
            <Text style={styles.featureText}>Track Screen Time</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="fitness-outline" size={24} color="#2B383D" />
            <Text style={styles.featureText}>Eye Exercises</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#2B383D" />
            <Text style={styles.featureText}>Secure & Private</Text>
          </View>
        </View>

        {/* Okay Button */}
        <TouchableOpacity
          style={[styles.okayButton, initializing && styles.disabledButton]}
          onPress={handleOkayPress}
          disabled={initializing}
        >
          {initializing ? (
            <>
              <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
              <Text style={styles.buttonText}>Setting up...</Text>
            </>
          ) : (
            <>
              <Text style={styles.buttonText}>Okay</Text>
              <Ionicons name="arrow-forward" size={24} color="#fff" style={{ marginLeft: 10 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
    width: '100%',
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2B383D',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 50,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#2B383D',
    marginLeft: 15,
    fontWeight: '600',
  },
  okayButton: {
    backgroundColor: '#2B383D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: width * 0.7,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
