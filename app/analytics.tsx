import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase/firebaseConfig';
import { useTheme } from '../hooks/useTheme';

interface WeekData {
  averageSeconds?: number;
  averageDuration?: string;
  weekStartDate?: string;
  calculatedOn?: string;
}

interface BlinkWeekData {
  averageBlinks?: number;
  averageDistance?: number;
  averageMeasurements?: number;
  weekStartDate?: string;
  calculatedOn?: string;
}

interface DayData {
  seconds?: number;
  duration?: string;
  date?: string;
  blinks?: number;
  distance?: number;
  measurements?: number;
}

interface AnalyticsData {
  screenTime: {
    week1: WeekData;
    week2: WeekData;
    week3: WeekData;
    week4: {
      monday?: DayData;
      tuesday?: DayData;
      wednesday?: DayData;
      thursday?: DayData;
      friday?: DayData;
      saturday?: DayData;
      sunday?: DayData;
      weekStartDate?: string;
    };
  };
  blinks: {
    week1: BlinkWeekData;
    week2: BlinkWeekData;
    week3: BlinkWeekData;
    week4: {
      monday?: DayData;
      tuesday?: DayData;
      wednesday?: DayData;
      thursday?: DayData;
      friday?: DayData;
      saturday?: DayData;
      sunday?: DayData;
      weekStartDate?: string;
    };
  };
}

export default function Analytics() {
  const { colors, fonts, spacing, borderRadius } = useTheme();
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: spacing.sm,
      marginRight: spacing.sm,
    },
    headerTitle: {
      fontSize: fonts.xlarge,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.md,
    },
    sectionTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.md,
      marginTop: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    weekCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
    },
    weekHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    weekTitle: {
      fontSize: fonts.medium,
      fontWeight: '600',
      color: colors.text,
    },
    weekValue: {
      fontSize: fonts.large,
      fontWeight: 'bold',
      color: colors.primary,
    },
    weekSubtext: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    dayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dayName: {
      fontSize: fonts.medium,
      color: colors.text,
      flex: 1,
    },
    dayValue: {
      fontSize: fonts.medium,
      fontWeight: '500',
      color: colors.primary,
    },
    currentWeekTitle: {
      fontSize: fonts.medium,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.md,
    },
    emptyState: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    errorText: {
      fontSize: fonts.medium,
      color: colors.error,
      textAlign: 'center',
    },
  }), [colors, fonts, spacing, borderRadius]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;
      if (!user) {
        setError('Please login to view analytics');
        return;
      }

      // Fetch screen time data
      const screenTimeRef = doc(db, 'screen_time', user.uid);
      const screenTimeDoc = await getDoc(screenTimeRef);

      // Fetch blinks data
      const blinksRef = doc(db, 'blinks', user.uid);
      const blinksDoc = await getDoc(blinksRef);

      const screenTimeData = screenTimeDoc.exists() ? screenTimeDoc.data() : {};
      const blinksData = blinksDoc.exists() ? blinksDoc.data() : {};

      setAnalyticsData({
        screenTime: {
          week1: screenTimeData.week1 || {},
          week2: screenTimeData.week2 || {},
          week3: screenTimeData.week3 || {},
          week4: screenTimeData.week4 || {},
        },
        blinks: {
          week1: blinksData.week1 || {},
          week2: blinksData.week2 || {},
          week3: blinksData.week3 || {},
          week4: blinksData.week4 || {},
        },
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const formatDistance = (distance?: number): string => {
    if (!distance) return 'N/A';
    return `${Math.round(distance)} cm`;
  };

  const renderWeekCard = (weekNumber: number, weekData: WeekData, type: 'screenTime') => {
    const borderColor = weekNumber === 4 ? colors.primary : weekNumber === 3 ? '#34C759' : weekNumber === 2 ? '#FF9500' : '#8E8E93';
    
    return (
      <View key={weekNumber} style={[styles.weekCard, { borderLeftColor: borderColor }]}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>Week {weekNumber}</Text>
          <Text style={styles.weekValue}>
            {weekData.averageDuration || formatDuration(weekData.averageSeconds)}
          </Text>
        </View>
        {weekData.weekStartDate && (
          <Text style={styles.weekSubtext}>
            Week starting: {new Date(weekData.weekStartDate).toLocaleDateString()}
          </Text>
        )}
      </View>
    );
  };

  const renderBlinkWeekCard = (weekNumber: number, weekData: BlinkWeekData) => {
    const borderColor = weekNumber === 4 ? colors.primary : weekNumber === 3 ? '#34C759' : weekNumber === 2 ? '#FF9500' : '#8E8E93';
    
    return (
      <View key={weekNumber} style={[styles.weekCard, { borderLeftColor: borderColor }]}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>Week {weekNumber}</Text>
          <Text style={styles.weekValue}>{weekData.averageBlinks || 0} blinks</Text>
        </View>
        <Text style={styles.weekSubtext}>
          Avg Distance: {formatDistance(weekData.averageDistance)}
        </Text>
        {weekData.weekStartDate && (
          <Text style={styles.weekSubtext}>
            Week starting: {new Date(weekData.weekStartDate).toLocaleDateString()}
          </Text>
        )}
      </View>
    );
  };

  const renderCurrentWeekDays = (week4Data: any, type: 'screenTime' | 'blinks') => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    return (
      <View style={styles.card}>
        <Text style={styles.currentWeekTitle}>Current Week (Week 4) - Daily Breakdown</Text>
        {days.map(day => {
          const dayData = week4Data[day];
          if (!dayData) return null;

          return (
            <View key={day} style={styles.dayRow}>
              <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
              <Text style={styles.dayValue}>
                {type === 'screenTime' 
                  ? (dayData.duration || formatDuration(dayData.seconds))
                  : `${dayData.blinks || 0} blinks`
                }
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.weekSubtext, { marginTop: spacing.md }]}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={fetchAnalyticsData}
            style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.md }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detailed Analytics</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Screen Time Section */}
        <Text style={styles.sectionTitle}>📱 Screen Time Analytics</Text>
        
        {analyticsData?.screenTime.week3.averageSeconds ? (
          renderWeekCard(3, analyticsData.screenTime.week3, 'screenTime')
        ) : null}
        
        {analyticsData?.screenTime.week2.averageSeconds ? (
          renderWeekCard(2, analyticsData.screenTime.week2, 'screenTime')
        ) : null}
        
        {analyticsData?.screenTime.week1.averageSeconds ? (
          renderWeekCard(1, analyticsData.screenTime.week1, 'screenTime')
        ) : null}

        {/* Current Week Details */}
        {analyticsData?.screenTime.week4 && (
          renderCurrentWeekDays(analyticsData.screenTime.week4, 'screenTime')
        )}

        {/* Blinks Section */}
        <Text style={styles.sectionTitle}>👁️ Blink Analytics</Text>
        
        {analyticsData?.blinks.week3.averageBlinks ? (
          renderBlinkWeekCard(3, analyticsData.blinks.week3)
        ) : null}
        
        {analyticsData?.blinks.week2.averageBlinks ? (
          renderBlinkWeekCard(2, analyticsData.blinks.week2)
        ) : null}
        
        {analyticsData?.blinks.week1.averageBlinks ? (
          renderBlinkWeekCard(1, analyticsData.blinks.week1)
        ) : null}

        {/* Current Week Blinks Details */}
        {analyticsData?.blinks.week4 && (
          renderCurrentWeekDays(analyticsData.blinks.week4, 'blinks')
        )}

        {!analyticsData && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No analytics data available yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
// app/SupportSystem.tsx