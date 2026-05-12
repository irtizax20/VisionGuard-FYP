import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LogoutButton from '../../components/ui/LogoutButton';
import { useScreenTime } from '../../contexts/ScreenTimeContext';
import { auth } from '../../firebase/firebaseConfig';
import { useTheme } from '../../hooks/useTheme';
import BlinkTrackingService from '../../services/BlinkTrackingService';
import ScreenTimeSyncService from '../../services/ScreenTimeSyncService';

const { width } = Dimensions.get('window');

function ReportScreen() {
  const nav = useNavigation();
  const router = useRouter();
  const { colors, fonts, spacing, borderRadius } = useTheme();
 
  const { screenTimeSeconds, formattedTime } = useScreenTime();
  const todayScreenTime = formattedTime;
  
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyAverage, setMonthlyAverage] = useState(0);
  const [weeklyAverages, setWeeklyAverages] = useState<{week1: number, week2: number, week3: number, week4: number}>({
    week1: 0,
    week2: 0,
    week3: 0,
    week4: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blinkStats, setBlinkStats] = useState({
    currentWeekBlinks: 0,
    currentWeekDistance: 0,
    currentWeekMeasurements: 0,
    averageBlinksPerDay: 0,
    averageBlinksPerMinute: 0
  });

  React.useLayoutEffect(() => {
    nav.setOptions({ headerRight: () => <LogoutButton /> });
  }, [nav]);

  useEffect(() => {
    loadReportData();
    loadBlinkStats();
  }, []);

  // Format time helper (single function, memoized)
  const formatTime = useCallback((seconds: number): string => {
    if (seconds <= 0) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, []);

  // Memoize today's formatted data to prevent infinite loops
  const todayData = useMemo(() => ({
    time: screenTimeSeconds,
    formattedTime: formatTime(screenTimeSeconds)
  }), [screenTimeSeconds, formatTime]);

  // Update today's data in weekly overview - only when value actually changes
  useEffect(() => {
    if (weeklyData.length > 0) {
      // Find today's index in weekly data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toDateString();
      
      const todayIndex = weeklyData.findIndex(day => {
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate.toDateString() === todayStr;
      });
      
      // Only update if today is found and time has actually changed
      if (todayIndex >= 0 && weeklyData[todayIndex].time !== todayData.time) {
        setWeeklyData(prev => {
          const updated = [...prev];
          updated[todayIndex] = {
            ...updated[todayIndex],
            time: todayData.time,
            formattedTime: todayData.formattedTime
          };
          return updated;
        });
        
        // Recalculate average for current week (only passed days)
        const currentDay = new Date().getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const daysPassed = daysFromMonday + 1;
        
        const updatedTotal = weeklyData.reduce((sum, day, idx) => {
          if (idx < daysPassed) {
            return sum + (idx === todayIndex ? todayData.time : day.time);
          }
          return sum;
        }, 0);
        setMonthlyAverage(updatedTotal / daysPassed);
        
        // Update week 4 average
        setWeeklyAverages(prev => ({
          ...prev,
          week4: updatedTotal / daysPassed
        }));
      }
    }
  }, [todayData, weeklyData.length]); // Only depends on memoized todayData

  const loadReportData = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.error('No user logged in');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      // Get current date and find the Monday of current week
      const today = new Date();
      const currentDay = today.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Sunday is 0, Monday is 1
      
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysFromMonday);
      monday.setHours(0, 0, 0, 0);
      
      // Load current week data (Monday to Sunday)
      const realWeeklyData = [];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dailyKey = `screenTime_${userId}_${date.toDateString()}`;
        
        const storedData = await AsyncStorage.getItem(dailyKey);
        const timeInSeconds = storedData ? parseInt(storedData, 10) : 0;
        
        realWeeklyData.push({
          date: date.toISOString(),
          time: timeInSeconds,
          formattedTime: formatTime(timeInSeconds),
          isPast: date <= today
        });
      }
      
      setWeeklyData(realWeeklyData);
      
      // Calculate average for only the days that have passed in current week
      const daysPassed = daysFromMonday + 1;
      const passedDaysData = realWeeklyData.slice(0, daysPassed);
      const totalPassedTime = passedDaysData.reduce((sum, day) => sum + day.time, 0);
      setMonthlyAverage(totalPassedTime / daysPassed);
      
      // Calculate weekly averages for past 4 weeks
      const weekAverages = { week1: 0, week2: 0, week3: 0, week4: 0 };
      
      // Week 4 (current week) - only days that have passed
      weekAverages.week4 = totalPassedTime / daysPassed;
      
      // Week 3 (last week)
      let week3Total = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() - 7 + i);
        const dailyKey = `screenTime_${userId}_${date.toDateString()}`;
        const storedData = await AsyncStorage.getItem(dailyKey);
        week3Total += storedData ? parseInt(storedData, 10) : 0;
      }
      weekAverages.week3 = week3Total / 7;
      
      // Week 2 (2 weeks ago)
      let week2Total = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() - 14 + i);
        const dailyKey = `screenTime_${userId}_${date.toDateString()}`;
        const storedData = await AsyncStorage.getItem(dailyKey);
        week2Total += storedData ? parseInt(storedData, 10) : 0;
      }
      weekAverages.week2 = week2Total / 7;
      
      // Week 1 (3 weeks ago)
      let week1Total = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() - 21 + i);
        const dailyKey = `screenTime_${userId}_${date.toDateString()}`;
        const storedData = await AsyncStorage.getItem(dailyKey);
        week1Total += storedData ? parseInt(storedData, 10) : 0;
      }
      weekAverages.week1 = week1Total / 7;
      
      setWeeklyAverages(weekAverages);
      
      console.log('✅ Loaded weekly data from AsyncStorage:', realWeeklyData);
      console.log('✅ Weekly averages:', weekAverages);
    } catch (error) {
      console.error('❌ Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  }, [formatTime]);

  const loadBlinkStats = useCallback(async () => {
    try {
      const stats = await BlinkTrackingService.getBlinkStats();
      
      // Calculate averageBlinksPerMinute
      // Since blinks are already normalized (multiplied by 2 for 30-second sessions),
      // average blinks per minute = total normalized blinks / total measurements
      // Example: 40 + 68 = 108 total blinks, 2 measurements → 108/2 = 54 blinks/minute
      const averageBlinksPerMinute = stats.currentWeekMeasurements > 0 
        ? stats.currentWeekBlinks / stats.currentWeekMeasurements
        : 0;
      
      const statsWithMinute = {
        ...stats,
        averageBlinksPerMinute
      };
      setBlinkStats(statsWithMinute);
      console.log('[Report] ✅ Blink stats loaded:', {
        ...statsWithMinute,
        calculation: {
          totalNormalizedBlinks: stats.currentWeekBlinks,
          totalMeasurements: stats.currentWeekMeasurements,
          averageBlinksPerMinute: averageBlinksPerMinute
        }
      });
    } catch (error) {
      console.error('[Report] ❌ Failed to load blink stats:', error);
    }
  }, []);

  const refreshFromFirestore = useCallback(async () => {
    try {
      setRefreshing(true);
      console.log('[Report] Refreshing data from Firestore...');
      
      // ScreenTimeSyncService is already a singleton instance (default export)
      // Access private method through reflection (TypeScript workaround)
      await (ScreenTimeSyncService as any).fetchTodayData?.();
      
      // Wait a bit for AsyncStorage to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload local data
      await loadReportData();
      await loadBlinkStats();
      
      console.log('[Report] ✅ Data refreshed successfully');
    } catch (error) {
      console.error('[Report] ❌ Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadReportData, loadBlinkStats]);

  const getHealthRecommendation = useMemo((): { title: string, message: string, color: string, icon: string } => {
    const hours = screenTimeSeconds / 3600;
    
    if (hours <= 2) {
      return {
        title: 'Excellent Eye Health!',
        message: 'Your screen time is within healthy limits. Keep up the good habits!',
        color: colors.success,
        icon: 'checkmark-circle'
      };
    } else if (hours <= 4) {
      return {
        title: 'Good Progress',
        message: 'Consider taking more frequent breaks and doing eye exercises.',
        color: colors.warning,
        icon: 'warning'
      };
    } else {
      return {
        title: 'Take Action',
        message: 'Your screen time is high. Take regular breaks and follow the 20-20-20 rule.',
        color: colors.error,
        icon: 'alert-circle'
      };
    }
  }, [colors.error, colors.success, colors.warning, screenTimeSeconds]);

  const recommendation = getHealthRecommendation;

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontSize: fonts.xxlarge }]}>Eye Health Report</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fonts.medium }]}>Your weekly eye care summary</Text>
      </View>

      {/* Today's Summary */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="today-outline" size={24} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fonts.large }]}>Today&apos;s Summary</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Screen Time:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>{todayScreenTime}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Eye Breaks Taken:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>0</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Avg Blinks/Min:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>
            {blinkStats.averageBlinksPerMinute > 0 ? blinkStats.averageBlinksPerMinute.toFixed(1) : 'No data yet'}
          </Text>
        </View>
      </View>

      {/* Blink & Distance Statistics */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="eye-outline" size={24} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fonts.large }]}>Blink & Distance Stats</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Total Blinks Measured:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>{blinkStats.currentWeekBlinks || 0}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Times Measured:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>{blinkStats.currentWeekMeasurements || 0}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Avg Screen Distance:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>
            {blinkStats.currentWeekDistance > 0 
              ? blinkStats.currentWeekDistance.toFixed(1) 
              : '0.0'} cm
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Avg Blinks/Day:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>
            {blinkStats.averageBlinksPerDay > 0 ? blinkStats.averageBlinksPerDay.toFixed(1) : '0.0'}
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 12 }]}
          onPress={() => router.push('/blink-test')}
        >
          <Ionicons name="analytics" size={20} color={colors.background} />
          <Text style={[styles.actionButtonText, { color: colors.background, fontSize: fonts.medium }]}>Run Blink Test</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Overview */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar-outline" size={24} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fonts.large }]}>Current Week (Mon-Sun)</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Week Average:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>{formatTime(monthlyAverage)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: fonts.medium }]}>Total Time:</Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fonts.medium }]}>
            {formatTime(weeklyData.filter(d => d.isPast).reduce((sum, day) => sum + day.time, 0))}
          </Text>
        </View>
        
        <View style={styles.weeklyContainer}>
          {weeklyData.map((day, index) => {
            const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' });
            const dayDate = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <View key={index} style={[styles.dayItem, { borderBottomColor: colors.border }]}>
                <Text style={[styles.dayName, { color: day.isPast ? colors.text : colors.textSecondary, fontSize: fonts.medium }]}>
                  {dayName} ({dayDate})
                </Text>
                <Text style={[styles.dayTime, { color: day.isPast ? colors.text : colors.textSecondary, fontSize: fonts.medium }]}>
                  {day.isPast ? day.formattedTime : '-'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Monthly Averages */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="stats-chart-outline" size={24} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fonts.large }]}>Monthly Breakdown</Text>
        </View>
        
        <View style={styles.weeklyAveragesContainer}>
          <View style={[styles.weekBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.weekLabel, { color: colors.textSecondary, fontSize: fonts.small }]}>1st Week</Text>
            <Text style={[styles.weekValue, { color: colors.text, fontSize: fonts.large }]}>{formatTime(weeklyAverages.week1)}</Text>
          </View>
          
          <View style={[styles.weekBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.weekLabel, { color: colors.textSecondary, fontSize: fonts.small }]}>2nd Week</Text>
            <Text style={[styles.weekValue, { color: colors.text, fontSize: fonts.large }]}>{formatTime(weeklyAverages.week2)}</Text>
          </View>
          
          <View style={[styles.weekBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.weekLabel, { color: colors.textSecondary, fontSize: fonts.small }]}>3rd Week</Text>
            <Text style={[styles.weekValue, { color: colors.text, fontSize: fonts.large }]}>{formatTime(weeklyAverages.week3)}</Text>
          </View>
          
          <View style={[styles.weekBox, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={[styles.weekLabel, { color: colors.background, fontSize: fonts.small }]}>4th Week (Current)</Text>
            <Text style={[styles.weekValue, { color: colors.background, fontSize: fonts.large, fontWeight: 'bold' }]}>{formatTime(weeklyAverages.week4)}</Text>
          </View>
        </View>
        
        {/* Refresh Button */}
        <TouchableOpacity 
          style={[styles.refreshButton, { backgroundColor: colors.primary }]}
          onPress={refreshFromFirestore}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={colors.background} />
          )}
          <Text style={[styles.refreshButtonText, { color: colors.background, fontSize: fonts.medium }]}>  
            {refreshing ? 'Refreshing...' : 'Refresh from Database'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Health Recommendation */}
      <View style={[styles.recommendationCard, { backgroundColor: colors.card, borderLeftColor: recommendation.color }]}>
        <View style={styles.recommendationHeader}>
          <Ionicons name={recommendation.icon as any} size={24} color={recommendation.color} />
          <Text style={[styles.recommendationTitle, { color: recommendation.color, fontSize: fonts.large }]}>{recommendation.title}</Text>
        </View>
        <Text style={[styles.recommendationMessage, { color: colors.text, fontSize: fonts.medium }]}>{recommendation.message}</Text>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            console.log('🔍 Navigating to analytics page');
            router.push('/analytics');
          }}
        >
          <Ionicons name="analytics-outline" size={20} color={colors.background} />
          <Text style={[styles.actionButtonText, { color: colors.background, fontSize: fonts.medium }]}>View Detailed Analytics</Text>
        </TouchableOpacity>
      </View>

      {/* Tips Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="bulb-outline" size={24} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fonts.large }]}>Eye Care Tips</Text>
        </View>
        <Text style={[styles.recommendationMessage, { color: colors.text, fontSize: fonts.medium }]}>
          • Follow the 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds{"\n"}
          • Blink frequently to keep your eyes moist{"\n"}
          • Adjust screen brightness to match your surroundings{"\n"}
          • Take regular breaks from screen time
        </Text>
      </View>
    </ScrollView>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default React.memo(ReportScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: width * 0.05,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
  },
  card: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '600',
    marginLeft: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
  },
  statValue: {
    fontWeight: 'bold',
  },
  recommendationCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationTitle: {
    fontWeight: 'bold',
    marginLeft: 8,
  },
  recommendationMessage: {
    lineHeight: 22,
  },
  actionButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  actionButtonText: {
    fontWeight: '600',
    marginLeft: 8,
  },
  weeklyContainer: {
    marginTop: 8,
  },
  dayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dayName: {
  },
  dayTime: {
    fontWeight: 'bold',
  },
  weeklyAveragesContainer: {
    marginTop: 12,
    gap: 12,
  },
  weekBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  weekLabel: {
    fontWeight: '600',
    marginBottom: 8,
  },
  weekValue: {
    fontWeight: 'bold',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  refreshButtonText: {
    fontWeight: '600',
    marginLeft: 8,
  },
});
