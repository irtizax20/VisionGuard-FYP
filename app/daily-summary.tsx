import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import DailySummaryService, { DailyEyeHealthMetrics } from '../services/DailySummaryService';

const { width } = Dimensions.get('window');

export default function DailySummaryScreen() {
  const router = useRouter();
  const { colors, fonts, spacing, borderRadius } = useTheme();
  
  const screenTime = 0; // Placeholder
  const [metrics, setMetrics] = useState<DailyEyeHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDailyMetrics();
  }, []);

  const loadDailyMetrics = async () => {
    console.log('🔍 Loading daily metrics...');
    setLoading(true);
    try {
      const dailyMetrics = await DailySummaryService.calculateDailyMetrics();
      console.log('✅ Daily metrics loaded:', dailyMetrics);
      setMetrics(dailyMetrics);
    } catch (error) {
      console.error('❌ Error loading daily metrics:', error);
      // Fallback metrics using current screen time
      setMetrics({
        date: new Date().toDateString(),
        screenTime: screenTime,
        estimatedBlinks: Math.floor(screenTime / 3) || 100,
        breaksTaken: Math.floor(screenTime / 1800) || 0,
        eyeStrainEvents: Math.floor(screenTime / 3600) || 0,
        averageScreenDistance: 45,
        healthScore: Math.max(0, Math.min(100, 100 - Math.floor(screenTime / 120))),
        recommendations: [
          '⏰ Take regular breaks from screen time',
          '👁️ Follow the 20-20-20 rule',
          '💡 Adjust screen brightness to match surroundings'
        ]
      });
    }
    setLoading(false);
  };

  const formatScreenTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const styles = StyleSheet.create({
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
      fontSize: fonts.xxlarge,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
    },
    loadingText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    dateText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    scoreSection: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scoreCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    scoreText: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.background,
    },
    scoreLabel: {
      fontSize: fonts.large,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    scoreLabelText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    metricCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      width: '48%',
      marginBottom: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricIcon: {
      marginBottom: spacing.sm,
    },
    metricValue: {
      fontSize: fonts.large,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    metricLabel: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    recommendationsSection: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.md,
    },
    recommendationCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 1,
      borderColor: colors.border,
    },
    recommendationText: {
      fontSize: fonts.medium,
      color: colors.text,
      flex: 1,
      lineHeight: 20,
    },
    refreshButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    refreshButtonText: {
      color: colors.background,
      fontSize: fonts.medium,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 Daily Eye Health Summary</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Calculating your eye health metrics...</Text>
        </View>
      ) : metrics ? (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.dateText}>
            {new Date(metrics.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>

          {/* Health Score */}
          <View style={styles.scoreSection}>
            <View
              style={[
                styles.scoreCircle,
                { backgroundColor: getHealthScoreColor(metrics.healthScore) }
              ]}
            >
              <Text style={styles.scoreText}>{metrics.healthScore}</Text>
            </View>
            <Text style={[styles.scoreLabel, { color: getHealthScoreColor(metrics.healthScore) }]}>
              {getHealthScoreLabel(metrics.healthScore)}
            </Text>
            <Text style={styles.scoreLabelText}>Eye Health Score</Text>
          </View>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="time" size={24} color={colors.primary} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{formatScreenTime(metrics.screenTime)}</Text>
              <Text style={styles.metricLabel}>Screen Time</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="eye" size={24} color={colors.secondary} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{metrics.estimatedBlinks.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Estimated Blinks</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="pause-circle" size={24} color="#4CAF50" style={styles.metricIcon} />
              <Text style={styles.metricValue}>{metrics.breaksTaken}</Text>
              <Text style={styles.metricLabel}>Breaks Taken</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="warning" size={24} color="#FF9800" style={styles.metricIcon} />
              <Text style={styles.metricValue}>{metrics.eyeStrainEvents}</Text>
              <Text style={styles.metricLabel}>Strain Events</Text>
            </View>
          </View>

          {/* Recommendations */}
          <View style={styles.recommendationsSection}>
            <Text style={styles.sectionTitle}>💡 Personalized Recommendations</Text>
            {metrics.recommendations.map((recommendation, index) => (
              <View key={index} style={styles.recommendationCard}>
                <Text style={styles.recommendationText}>{recommendation}</Text>
              </View>
            ))}
          </View>

          {/* Refresh Button */}
          <TouchableOpacity style={styles.refreshButton} onPress={loadDailyMetrics}>
            <Ionicons name="refresh" size={20} color={colors.background} />
            <Text style={styles.refreshButtonText}>Refresh Data</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.loadingText}>Unable to load daily metrics</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadDailyMetrics}>
            <Ionicons name="refresh" size={20} color={colors.background} />
            <Text style={styles.refreshButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
