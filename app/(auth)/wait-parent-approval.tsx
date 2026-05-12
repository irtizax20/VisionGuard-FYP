import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

export default function WaitParentApprovalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, name, email, password, dateOfBirth, category, parentEmail } = params as any;
  const [status, setStatus] = useState<'pending' | 'approved' | 'expired' | 'invalid'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setLoading(false);
      return;
    }
    // Listen for real-time updates on parent approval status
    const unsub = onSnapshot(doc(db, 'parent_verifications', token as string), (snap) => {
      setLoading(false);
      if (!snap.exists()) {
        setStatus('invalid');
        return;
      }
      const data = snap.data() as any;
      if (data.status === 'approved') {
        setStatus('approved');
        // Navigate to face capture with original params
        setTimeout(() => {
          router.replace({
            pathname: '/face-capture',
            params: { name, email, password, dateOfBirth, category, parentEmail },
          });
        }, 500);
      } else if (data.status === 'expired') {
        setStatus('expired');
      } else {
        setStatus('pending');
      }
    }, (err) => {
      setLoading(false);
      Alert.alert('Error', err?.message || 'Failed to listen for approval');
    });

    return () => unsub();
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="mail" size={48} color="#2B383D" />
        <Text style={styles.title}>Waiting for Parent Approval</Text>
        <Text style={styles.subtitle}>We sent an approval link to:</Text>
        <Text style={styles.email}>{parentEmail}</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#2B383D" style={{ marginTop: 16 }} />
        ) : (
          <Text style={styles.status}>
            {status === 'pending' && 'Pending approval...'}
            {status === 'approved' && 'Approved! Redirecting...'}
            {status === 'expired' && 'The approval link has expired. Please go back and try again.'}
            {status === 'invalid' && 'Invalid approval request. Please go back and try again.'}
          </Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(auth)/signup')}>
            <Text style={styles.secondaryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#FAFAFA' },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, alignItems: 'center', borderColor: '#DADCE0', borderWidth: 1 },
  title: { fontSize: 22, fontWeight: '700', color: '#2B383D', marginTop: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#2B383D', marginTop: 8, textAlign: 'center' },
  email: { fontSize: 16, color: '#4A6572', marginTop: 4, fontWeight: '600' },
  status: { fontSize: 16, color: '#2B383D', marginTop: 16, textAlign: 'center' },
  actions: { marginTop: 24, width: '100%', flexDirection: 'row', justifyContent: 'center' },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#2B383D' },
  secondaryText: { color: '#2B383D', fontWeight: '600' },
});
