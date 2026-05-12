// components/BackgroundSyncSettings.tsx
// UI component for managing background sync settings
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
// DON'T import BackgroundSyncManager statically - load conditionally
// import BackgroundSyncManager from '../services/BackgroundSyncManager';
import type { BackgroundSyncSettings, BackgroundSyncStats } from '../services/BackgroundSyncManager';
// Background Sync Settings Component
export default function BackgroundSyncSettings() {
  const { colors, isDark } = useTheme();
  const [settings, setSettings] = useState<BackgroundSyncSettings | null>(null);
  const [stats, setStats] = useState<BackgroundSyncStats | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [canSyncNow, setCanSyncNow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isAndroid13Plus] = useState(Platform.OS === 'android' && Platform.Version >= 33);

  // Conditionally load BackgroundSyncManager (skip on Android 13+)
  const syncManager = isAndroid13Plus ? null : require('../services/BackgroundSyncManager').default.getInstance();

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    if (isAndroid13Plus) {
      // Show Android 13+ message instead of loading
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const status = await syncManager.getStatus();
      setSettings(status.settings);
      setStats(status.stats);
      setIsRegistered(status.isRegistered);
      setCanSyncNow(status.canSyncNow);
    } catch (error) {
      console.error('Error loading sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof BackgroundSyncSettings, value: any) => {
    if (isAndroid13Plus || !syncManager) return;
    
    try {
      await syncManager.updateSettings({ [key]: value });
      await loadStatus();
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleManualSync = async () => {
    if (isAndroid13Plus || !syncManager) return;
    
    try {
      setSyncing(true);
      const success = await syncManager.triggerImmediateSync();
      
      if (success) {
        Alert.alert('Success', 'Data synced successfully!');
      } else {
        Alert.alert('Info', 'Sync conditions not met or sync failed');
      }
      
      await loadStatus();
    } catch (error) {
      console.error('Error during manual sync:', error);
      Alert.alert('Error', 'Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetStats = async () => {
    if (isAndroid13Plus || !syncManager) return;
    
    Alert.alert(
      'Reset Statistics',
      'Are you sure you want to reset sync statistics?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await syncManager.resetStats();
            await loadStatus();
          },
        },
      ]
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading || (!isAndroid13Plus && (!settings || !stats))) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show Android 13+ message
  if (isAndroid13Plus) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Background Sync</Text>
        
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.infoText, { color: colors.warning || '#FFA500' }]}>
            ⚠️ Android 13+ Detected
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 12 }]}>
            Background sync is not available on Android 13 and above due to system restrictions.
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 8 }]}>
            Your data will sync automatically when the app is open (foreground sync).
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Background Sync</Text>

      {/* Status Section */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
            Status:
          </Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: isRegistered ? '#4CAF50' : '#FF9800' }
          ]}>
            <Text style={styles.statusText}>
              {isRegistered ? '✓ Active' : '⚠ Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Enable Background Sync
          </Text>
          <Switch
            value={settings?.enabled ?? false}
            onValueChange={(value) => updateSetting('enabled', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            WiFi Only
          </Text>
          <Switch
            value={settings?.wifiOnly ?? false}
            onValueChange={(value) => updateSetting('wifiOnly', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            disabled={!settings?.enabled}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Battery Optimized
          </Text>
          <Switch
            value={settings?.batteryOptimized ?? true}
            onValueChange={(value) => updateSetting('batteryOptimized', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            disabled={!settings?.enabled}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Sync on App Close
          </Text>
          <Switch
            value={settings?.syncOnAppClose ?? false}
            onValueChange={(value) => updateSetting('syncOnAppClose', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            disabled={!settings?.enabled}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Sync on Network Change
          </Text>
          <Switch
            value={settings?.syncOnNetworkChange ?? false}
            onValueChange={(value) => updateSetting('syncOnNetworkChange', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            disabled={!settings?.enabled}
          />
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Sync Interval: {settings?.syncInterval ?? 15} minutes
          </Text>
        </View>
      </View>

      {/* Statistics Section */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Statistics
          </Text>
          <TouchableOpacity onPress={handleResetStats}>
            <Text style={[styles.resetButton, { color: colors.primary }]}>
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Syncs:
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats?.totalSyncs ?? 0}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Successful:
          </Text>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {stats?.successfulSyncs ?? 0}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Failed:
          </Text>
          <Text style={[styles.statValue, { color: '#F44336' }]}>
            {stats?.failedSyncs ?? 0}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Data Synced:
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatBytes(stats?.dataSynced ?? 0)}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Avg Duration:
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats?.averageSyncDuration ?? 0}ms
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Last Sync:
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={2}>
            {formatDate(stats?.lastSyncTime ?? null)}
          </Text>
        </View>
      </View>

      {/* Manual Sync Button */}
      <TouchableOpacity
        style={[
          styles.syncButton,
          { 
            backgroundColor: canSyncNow && !syncing ? colors.primary : colors.border,
            opacity: canSyncNow && !syncing ? 1 : 0.5,
          }
        ]}
        onPress={handleManualSync}
        disabled={!canSyncNow || syncing}
      >
        {syncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.syncButtonText}>
            {canSyncNow ? '🔄 Sync Now' : '⚠️ Cannot Sync'}
          </Text>
        )}
      </TouchableOpacity>

      {!canSyncNow && (
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Sync conditions not met (check network, WiFi setting, or wait for interval)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  resetButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  settingLabel: {
    fontSize: 16,
    flex: 1,
  },
  infoRow: {
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  syncButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

