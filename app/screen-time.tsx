
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppUsageList,
  DailyScreenTimeCard,
  ScreenTimePermissionCard,
  WeeklyScreenTimeSummary
} from '../components/ScreenTime';
import { ScreenTimeProvider } from '../contexts/ScreenTimeContext';
import { useTheme } from '../hooks/useTheme';
const ScreenTimeContent: React.FC = () => {
  const router = useRouter();
  const refreshDailyUsage = async () => { };
  const hasPermission = false;
  const isLoading = false;
  const { colors, fonts, spacing, borderRadius } = useTheme();

  const styles = React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
    header: { paddingVertical: spacing.md, alignItems: 'center' },
    title: { fontSize: fonts.xxlarge, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
    subtitle: { fontSize: fonts.medium, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg },
    notSupportedCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      marginVertical: spacing.sm,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderLeftWidth: 4,
      borderLeftColor: '#FF9500',
      borderColor: colors.border,
      borderWidth: 1,
    },
    notSupportedTitle: { fontSize: fonts.large, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    notSupportedText: { fontSize: fonts.small, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginVertical: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderLeftWidth: 4,
      borderLeftColor: '#34C759',
      borderColor: colors.border,
      borderWidth: 1,
    },
    infoTitle: { fontSize: fonts.large, fontWeight: '600', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
    infoContent: { gap: spacing.sm },
    infoText: { fontSize: fonts.medium, color: colors.text, lineHeight: 22 },
    infoNote: { fontSize: fonts.small, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },
    analyticsButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginVertical: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    analyticsButtonText: {
      fontSize: fonts.medium,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: spacing.sm,
    },
  }), [colors, fonts, spacing, borderRadius]);

  // Force refresh on screen focus - optimized to prevent loops
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Screen time page focused - refreshing data');
      // Only refresh if we have permission, on Android, and not currently loading
      if (hasPermission && Platform.OS === 'android' && !isLoading) {
        // Use setTimeout to prevent immediate re-render loops
        const timeoutId = setTimeout(() => {
          refreshDailyUsage().catch(error => {
            console.error('❌ Error refreshing on focus:', error);
          });
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }, [hasPermission, isLoading]) // Removed refreshDailyUsage to prevent infinite dependency
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Screen Time</Text>
          <Text style={styles.subtitle}>
            Monitor your daily device usage and app habits
          </Text>
        </View>

        {/* Platform Check */}
        {Platform.OS !== 'android' && (
          <View style={styles.notSupportedCard}>
            <Text style={styles.notSupportedTitle}>Not Available</Text>
            <Text style={styles.notSupportedText}>
              Screen time tracking is only available on Android devices
            </Text>
          </View>
        )}

        {Platform.OS === 'android' && (
          <>
            {/* Permission Card */}
            <ScreenTimePermissionCard />

            {/* Daily Usage Card */}
            <DailyScreenTimeCard
              showAppsCount={true}
              showMostUsed={true}
            />

            {/* App Usage List */}
            <AppUsageList
              maxItems={10}
              showPercentage={true}
            />

            {/* Weekly Summary */}
            <WeeklyScreenTimeSummary showChart={true} />

            {/* View Detailed Analytics Button */}
            <TouchableOpacity 
              style={styles.analyticsButton}
              onPress={() => router.push('/analytics')}
            >
              <Ionicons name="stats-chart" size={20} color="#FFFFFF" />
              <Text style={styles.analyticsButtonText}>View Detailed Analytics</Text>
            </TouchableOpacity>

            {/* Info Section */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>About Screen Time Tracking</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoText}>
                  • Tracks daily app usage and screen time{'\n'}
                  • Shows your most used applications{'\n'}
                  • Provides weekly usage summaries{'\n'}
                  • Helps monitor digital wellness{'\n'}
                  • Updates automatically throughout the day
                </Text>

                <Text style={styles.infoNote}>
                  Note: This feature requires Usage Access permission to read app usage statistics from your device.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const ScreenTimeScreen: React.FC = () => {
  const nav = useNavigation();

  useEffect(() => {
    // Ensure navbar is visible with title
    nav.setOptions({ headerShown: true, title: 'Screen Time' });
  }, [nav]);

  return (
    <ScreenTimeProvider>
      <ScreenTimeContent />
    </ScreenTimeProvider>
  );
};

export default ScreenTimeScreen;
