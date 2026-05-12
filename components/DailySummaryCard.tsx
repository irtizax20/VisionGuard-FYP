import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import DailySummaryService, { DailyEyeHealthMetrics } from '../services/DailySummaryService';

const { width } = Dimensions.get('window');

interface DailySummaryCardProps {
  visible: boolean;
  onClose: () => void;
  date?: string;
}
// Daily Summary Card Component
export function DailySummaryCard({ visible, onClose, date }: DailySummaryCardProps) {
  const { colors, fonts, spacing, borderRadius } = useTheme();
  const [metrics, setMetrics] = useState<DailyEyeHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    console.log(`🔄 DailySummaryCard visibility changed: ${visible}`);
    if (visible) {
      console.log('📊 Loading daily metrics...');
      loadDailyMetrics();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadDailyMetrics = async () => {
    console.log('🔍 Starting to load daily metrics...');
    setLoading(true);
    try {
      const dailyMetrics = await DailySummaryService.calculateDailyMetrics(date);
      console.log('✅ Daily metrics loaded:', dailyMetrics);
      setMetrics(dailyMetrics);
    } catch (error) {
      console.error('❌ Error loading daily metrics:', error);
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.xl,
      width: width * 0.9,
      maxHeight: '80%',
      padding: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: fonts.xlarge,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: spacing.sm,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 200,
    },
    loadingText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    summaryContainer: {
      flex: 1,
    },
    scoreSection: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      marginBottom: spacing.lg,
    },
    scoreCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    scoreText: {
      fontSize: 32,
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
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      width: '48%',
      marginBottom: spacing.md,
      alignItems: 'center',
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
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    recommendationText: {
      fontSize: fonts.medium,
      color: colors.text,
      flex: 1,
      lineHeight: 20,
    },
    dateText: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <Text style={styles.title}>📊 Daily Eye Health Summary</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="analytics" size={48} color={colors.primary} />
              <Text style={styles.loadingText}>Calculating your eye health metrics...</Text>
            </View>
          ) : metrics ? (
            <ScrollView style={styles.summaryContainer} showsVerticalScrollIndicator={false}>
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
            </ScrollView>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
              <Text style={styles.loadingText}>Unable to load daily metrics</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

interface QuickSummaryProps {
  onPress?: () => void;
}

export function QuickSummaryCard({ onPress }: QuickSummaryProps) {
  const { colors, fonts, spacing, borderRadius } = useTheme();
  const [todayMetrics, setTodayMetrics] = useState<DailyEyeHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayMetrics();
  }, []);

  const loadTodayMetrics = async () => {
    try {
      const metrics = await DailySummaryService.calculateDailyMetrics();
      setTodayMetrics(metrics);
      console.log('✅ QuickSummaryCard loaded metrics:', metrics);
    } catch (error) {
      console.error('❌ Error loading today metrics:', error);
      // Fallback to dummy data for testing
      setTodayMetrics({
        date: new Date().toDateString(),
        screenTime: 317,
        estimatedBlinks: 8900,
        breaksTaken: 13,
        eyeStrainEvents: 0,
        averageScreenDistance: 45,
        healthScore: 59,
        recommendations: ['Take regular breaks', 'Follow 20-20-20 rule']
      });
    }
    setLoading(false);
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      margin: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
    },
    expandIcon: {
      opacity: 0.7,
    },
    content: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    scoreContainer: {
      alignItems: 'center',
    },
    score: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
    },
    scoreLabel: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    statsContainer: {
      flex: 1,
      marginLeft: spacing.lg,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    statLabel: {
      fontSize: fonts.small,
      color: colors.textSecondary,
    },
    statValue: {
      fontSize: fonts.small,
      color: colors.text,
      fontWeight: '500',
    },
    loadingText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      textAlign: 'center',
      padding: spacing.lg,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading today&apos;s summary...</Text>
      </View>
    );
  }

  if (!todayMetrics) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title}>Today&apos;s Eye Health</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.text} style={styles.expandIcon} />
      </View>

      <View style={styles.content}>
        <View style={styles.scoreContainer}>
          <Text style={[styles.score, { color: getScoreColor(todayMetrics.healthScore) }]}>
            {todayMetrics.healthScore}
          </Text>
          <Text style={styles.scoreLabel}>Health Score</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Screen Time</Text>
            <Text style={styles.statValue}>{formatTime(todayMetrics.screenTime)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Breaks Taken</Text>
            <Text style={styles.statValue}>{todayMetrics.breaksTaken}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Strain Events</Text>
            <Text style={styles.statValue}>{todayMetrics.eyeStrainEvents}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
