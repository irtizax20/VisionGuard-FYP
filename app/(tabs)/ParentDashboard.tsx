import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { auth, db } from '../../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';

interface ChildData {
  uid: string;
  name: string;
  email: string;
  isLocked?: boolean;
}

export default function ParentDashboard() {
  const { colors } = useTheme();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChildren = async () => {
      const user = auth.currentUser;
      if (!user || !user.email) return;

      try {
        const usersRef = collection(db, 'user');
        const q = query(
          usersRef,
          where('parentEmail', '==', user.email),
          where('category', '==', 'under16')
        );

        // Use onSnapshot to get real-time updates (so the toggle reflects instantly if changed elsewhere)
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const childrenData: ChildData[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            childrenData.push({
              uid: doc.id,
              name: data.name || 'Unknown',
              email: data.email || '',
              isLocked: data.isLocked || false,
            });
          });
          setChildren(childrenData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching children:', error);
        setLoading(false);
      }
    };

    fetchChildren();
  }, []);

  const toggleDeviceLock = async (childId: string, currentLockState: boolean) => {
    try {
      const childRef = doc(db, 'user', childId);
      await updateDoc(childRef, {
        isLocked: !currentLockState
      });
      
      Alert.alert(
        "Success", 
        !currentLockState ? "Device locked. The child cannot use the app." : "Device unlocked."
      );
    } catch (error: any) {
      console.error('Error toggling lock:', error);
      Alert.alert("Error", "Could not change lock state. " + error.message);
    }
  };

  const renderChildCard = ({ item }: { item: ChildData }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.childInfo}>
          <Ionicons name="person-circle" size={50} color={colors.primary} />
          <View style={styles.nameContainer}>
            <Text style={[styles.childName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.childEmail, { color: colors.textSecondary }]}>{item.email}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.controlsSection}>
        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Ionicons 
              name={item.isLocked ? "lock-closed" : "lock-open"} 
              size={24} 
              color={item.isLocked ? colors.error : colors.primary} 
            />
            <View style={styles.controlText}>
              <Text style={[styles.controlLabel, { color: colors.text }]}>
                Lock Device
              </Text>
              <Text style={[styles.controlSub, { color: colors.textSecondary }]}>
                {item.isLocked ? "Device is currently locked" : "Prevent child from using the app"}
              </Text>
            </View>
          </View>
          <Switch
            value={item.isLocked}
            onValueChange={() => toggleDeviceLock(item.uid, item.isLocked || false)}
            trackColor={{ false: colors.border, true: colors.error + '80' }}
            thumbColor={item.isLocked ? colors.error : colors.textSecondary}
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Parent Dashboard</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Manage your children's devices
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : children.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No children linked yet.</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            When your child registers and enters your email, they will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={children}
          keyExtractor={(item) => item.uid}
          renderItem={renderChildCard}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
  },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  listContent: {
    padding: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    padding: 15,
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameContainer: {
    marginLeft: 15,
    flex: 1,
  },
  childName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  childEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  controlsSection: {
    padding: 15,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  controlText: {
    marginLeft: 15,
    flex: 1,
    paddingRight: 10,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  controlSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
