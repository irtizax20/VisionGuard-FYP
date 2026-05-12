import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDailyScreenTime, useScreenTime, useWeeklyScreenTime } from '../../contexts/ScreenTimeContext';
import ScreenTimeService from '../../services/ScreenTimeService';

// Daily Screen Time Card Component
export const DailyScreenTimeCard: React.FC<{
  onPress?: () => void;
  showAppsCount?: boolean;
  showMostUsed?: boolean;
}> = ({ onPress, showAppsCount = true, showMostUsed = true }) => {
  const { formattedTime, appsCount, mostUsedApp, isLoading, error, refresh } = useDailyScreenTime();

  const handleRefresh = () => {
    refresh();
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={24} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    return (
      <View style={styles.contentContainer}>
        <Text style={styles.timeText}>{formattedTime}</Text>
        <Text style={styles.labelText}>Today&apos;s Screen Time</Text>

        {showAppsCount && (
          <Text style={styles.subtitleText}>
            {appsCount} apps used
          </Text>
        )}

        {showMostUsed && mostUsedApp && (
          <Text style={styles.mostUsedText}>
            Most used: {ScreenTimeService.getAppName(mostUsedApp.packageName)}
          </Text>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Ionicons name="time-outline" size={24} color="#007AFF" />
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {renderContent()}
    </TouchableOpacity>
  );
};

// Weekly Screen Time Summary Component
export const WeeklyScreenTimeSummary: React.FC<{
  showChart?: boolean;
}> = ({ showChart = false }) => {
  const {
    formattedTotalTime,
    formattedAverageTime,
    usage,
    isLoading,
    error,
    refresh
  } = useWeeklyScreenTime();

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading weekly data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={24} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Weekly Summary</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.weeklyStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formattedTotalTime}</Text>
          <Text style={styles.statLabel}>Total this week</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formattedAverageTime}</Text>
          <Text style={styles.statLabel}>Daily average</Text>
        </View>
      </View>

      {showChart && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Daily breakdown</Text>
          <WeeklyChart data={usage} />
        </View>
      )}
    </View>
  );
};

// Simple weekly chart component
const WeeklyChart: React.FC<{ data: any[] }> = ({ data }) => {
  const maxTime = Math.max(...data.map(day => day.totalScreenTime));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.chart}>
      {data.map((dayData, index) => {
        const height = maxTime > 0 ? (dayData.totalScreenTime / maxTime) * 60 : 0;

        return (
          <View key={index} style={styles.chartBar}>
            <View
              style={[
                styles.barFill,
                {
                  height: Math.max(height, 2),
                  backgroundColor: dayData.totalScreenTime > 0 ? '#007AFF' : '#E5E5EA'
                }
              ]}
            />
            <Text style={styles.dayLabel}>{days[index]}</Text>
          </View>
        );
      })}
    </View>
  );
};

// Permission Request Component
export const ScreenTimePermissionCard: React.FC = () => {
  const { hasPermission, isLoading, requestPermission } = useScreenTime();

  if (hasPermission) {
    return null;
  }

  const handleRequestPermission = async () => {
    try {
      await requestPermission();
    } catch (error) {
      Alert.alert(
        'Permission Required',
        'To enable screen time tracking, please:\n\n1. Go to Settings\n2. Apps & notifications\n3. Special app access\n4. Usage access\n5. Enable for BlinkFit',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.card, styles.permissionCard]}>
      <Ionicons name="shield-checkmark-outline" size={48} color="#007AFF" />
      <Text style={styles.permissionTitle}>Enable Screen Time Tracking</Text>
      <Text style={styles.permissionDescription}>
        Grant usage access permission to track your daily screen time and app usage
      </Text>

      <TouchableOpacity
        style={[styles.permissionButton, isLoading && styles.disabledButton]}
        onPress={handleRequestPermission}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
            <Text style={styles.permissionButtonText}>Open Settings</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

// App Usage List Component
export const AppUsageList: React.FC<{
  maxItems?: number;
  showPercentage?: boolean;
}> = ({ maxItems = 5, showPercentage = true }) => {
  const { usage, isLoading, error } = useDailyScreenTime();

  if (isLoading || error || !usage) {
    return null;
  }

  const appsToShow = usage.usageByApp.slice(0, maxItems);
  const totalTime = usage.totalScreenTime;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Top Apps</Text>

      {appsToShow.map((app, index) => {
        const appName = ScreenTimeService.getAppName(app.packageName);
        const timeUsed = ScreenTimeService.formatTime(app.totalTimeInForeground);
        const percentage = totalTime > 0 ? Math.round((app.totalTimeInForeground / 1000 / totalTime) * 100) : 0;

        return (
          <View key={app.packageName} style={styles.appItem}>
            <View style={styles.appInfo}>
              <Text style={styles.appName}>{appName}</Text>
              <Text style={styles.appTime}>{timeUsed}</Text>
            </View>

            {showPercentage && (
              <Text style={styles.appPercentage}>{percentage}%</Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  refreshButton: {
    padding: 4,
  },
  contentContainer: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  labelText: {
    fontSize: 16,
    color: '#6D6D80',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  mostUsedText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#8E8E93',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    marginTop: 8,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  weeklyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 16,
  },
  chartContainer: {
    marginTop: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  barFill: {
    width: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 10,
    color: '#8E8E93',
  },
  permissionCard: {
    alignItems: 'center',
    paddingVertical: 24,
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#6D6D80',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  appItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  appTime: {
    fontSize: 14,
    color: '#6D6D80',
    marginTop: 2,
  },
  appPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default {
  DailyScreenTimeCard,
  WeeklyScreenTimeSummary,
  ScreenTimePermissionCard,
  AppUsageList,
};
