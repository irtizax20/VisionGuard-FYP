import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import OfflineSyncService, { SyncStatus, ConflictData } from '../services/OfflineSyncService';
import ConflictResolutionModal from './ConflictResolutionModal';

interface SyncStats {
  total: number;
  byPriority: { high: number; medium: number; low: number };
  byStatus: { pending: number; retrying: number; failed: number };
  totalSize: number;
  averageSize: number;
}
// Enhanced Sync Status Component
const EnhancedSyncStatus: React.FC = () => {
  const { colors, fonts, spacing } = useTheme();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  useEffect(() => {
    loadSyncData();
    
    // Subscribe to sync status updates
    const unsubscribe = OfflineSyncService.addStatusListener((status) => {
      setSyncStatus(status);
      setLastUpdateTime(new Date());
    });

    // Periodic updates
    const interval = setInterval(loadSyncData, 10000); // Every 10 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const loadSyncData = async () => {
    try {
      const status = OfflineSyncService.getSyncStatus();
      const stats = OfflineSyncService.getSyncQueueStats();
      const pendingConflicts = OfflineSyncService.getPendingConflicts();
      
      setSyncStatus(status);
      setSyncStats(stats);
      setConflicts(pendingConflicts);
      setLastUpdateTime(new Date());
    } catch (error) {
      console.error('Error loading sync data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSyncData();
    setRefreshing(false);
  };

  const forceSync = async () => {
    try {
      await OfflineSyncService.forcSync();
      Alert.alert('Sync Started', 'Manual sync has been initiated.');
      await loadSyncData();
    } catch (error) {
      Alert.alert('Sync Error', 'Failed to start manual sync.');
    }
  };

  const clearOfflineData = async () => {
    Alert.alert(
      'Clear Offline Data',
      'This will remove all offline data and sync queue. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineSyncService.clearOfflineData();
              Alert.alert('Success', 'Offline data cleared.');
              await loadSyncData();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear offline data.');
            }
          },
        },
      ]
    );
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const getStatusColor = (status?: SyncStatus): string => {
    if (!status) return colors.textSecondary;
    if (!status.isOnline) return colors.error;
    if (status.syncInProgress) return colors.warning;
    if (status.failedSyncs > 0) return colors.warning;
    if (status.conflictsCount > 0) return colors.warning;
    return colors.success;
  };

  const getStatusText = (status?: SyncStatus): string => {
    if (!status) return 'Loading...';
    if (!status.isOnline) return 'Offline';
    if (status.syncInProgress) return 'Syncing...';
    if (status.conflictsCount > 0) return 'Conflicts Need Resolution';
    if (status.failedSyncs > 0) return 'Some Items Failed';
    if (status.queueSize > 0) return 'Items Queued';
    return 'All Synced';
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      case 'low': return colors.success;
      default: return colors.textSecondary;
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.lg,
      marginVertical: spacing.sm,
      marginHorizontal: spacing.md,
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
      marginBottom: spacing.md,
    },
    cardTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: spacing.sm,
    },
    statusText: {
      fontSize: fonts.medium,
      fontWeight: '500',
    },
    mainStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: spacing.lg,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: fonts.xxlarge,
      fontWeight: 'bold',
      color: colors.text,
    },
    statLabel: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailLabel: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
    },
    detailValue: {
      fontSize: fonts.medium,
      color: colors.text,
      fontWeight: '500',
    },
    priorityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    priorityItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.xs,
    },
    priorityText: {
      fontSize: fonts.small,
      color: colors.textSecondary,
    },
    priorityCount: {
      fontSize: fonts.small,
      color: colors.text,
      fontWeight: '600',
      marginLeft: spacing.xs,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dangerButton: {
      backgroundColor: colors.error,
      borderColor: colors.error,
    },
    buttonText: {
      fontSize: fonts.medium,
      color: colors.text,
      marginLeft: spacing.xs,
    },
    primaryButtonText: {
      color: colors.surface,
    },
    conflictAlert: {
      backgroundColor: colors.errorBackground,
      borderRadius: 8,
      padding: spacing.md,
      marginVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    conflictText: {
      fontSize: fonts.medium,
      color: colors.error,
      flex: 1,
      marginLeft: spacing.sm,
    },
    conflictButton: {
      backgroundColor: colors.error,
      borderRadius: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    conflictButtonText: {
      fontSize: fonts.small,
      color: colors.surface,
      fontWeight: '600',
    },
    lastUpdate: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.md,
      fontStyle: 'italic',
    },
    sectionTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Main Status Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Sync Status</Text>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(syncStatus || undefined) },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(syncStatus || undefined) },
              ]}
            >
              {getStatusText(syncStatus || undefined)}
            </Text>
          </View>
        </View>

        <View style={styles.mainStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{syncStatus?.queueSize || 0}</Text>
            <Text style={styles.statLabel}>Queued</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{syncStatus?.conflictsCount || 0}</Text>
            <Text style={styles.statLabel}>Conflicts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{syncStatus?.failedSyncs || 0}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Network Status</Text>
          <Text style={styles.detailValue}>
            {syncStatus?.isOnline ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sync In Progress</Text>
          <Text style={styles.detailValue}>
            {syncStatus?.syncInProgress ? '🔄 Yes' : '✅ No'}
          </Text>
        </View>

        {syncStats && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Data Size</Text>
            <Text style={styles.detailValue}>
              {formatSize(syncStats.totalSize)}
            </Text>
          </View>
        )}

        <Text style={styles.lastUpdate}>
          Last updated: {lastUpdateTime.toLocaleTimeString()}
        </Text>
      </View>

      {/* Conflict Alert */}
      {conflicts.length > 0 && (
        <View style={styles.card}>
          <View style={styles.conflictAlert}>
            <Ionicons name="warning" size={24} color={colors.error} />
            <Text style={styles.conflictText}>
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} require{conflicts.length === 1 ? 's' : ''} resolution
            </Text>
            <TouchableOpacity
              style={styles.conflictButton}
              onPress={() => setShowConflictModal(true)}
            >
              <Text style={styles.conflictButtonText}>RESOLVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Priority Breakdown */}
      {syncStats && syncStats.total > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Queue Breakdown</Text>
          
          <View style={styles.priorityRow}>
            <Text style={styles.detailLabel}>By Priority</Text>
          </View>
          
          <View style={styles.priorityRow}>
            <View style={styles.priorityItem}>
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor('high') }]} />
              <Text style={styles.priorityText}>High</Text>
              <Text style={styles.priorityCount}>{syncStats.byPriority.high}</Text>
            </View>
            
            <View style={styles.priorityItem}>
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor('medium') }]} />
              <Text style={styles.priorityText}>Medium</Text>
              <Text style={styles.priorityCount}>{syncStats.byPriority.medium}</Text>
            </View>
            
            <View style={styles.priorityItem}>
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor('low') }]} />
              <Text style={styles.priorityText}>Low</Text>
              <Text style={styles.priorityCount}>{syncStats.byPriority.low}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Average Item Size</Text>
            <Text style={styles.detailValue}>
              {formatSize(syncStats.averageSize)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pending Items</Text>
            <Text style={styles.detailValue}>{syncStats.byStatus.pending}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Retrying Items</Text>
            <Text style={styles.detailValue}>{syncStats.byStatus.retrying}</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.card}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={forceSync}
            disabled={!syncStatus?.isOnline || syncStatus?.syncInProgress}
          >
            <Ionicons name="sync" size={18} color={colors.surface} />
            <Text style={[styles.buttonText, styles.primaryButtonText]}>
              Force Sync
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={clearOfflineData}
          >
            <Ionicons name="trash" size={18} color={colors.surface} />
            <Text style={[styles.buttonText, styles.primaryButtonText]}>
              Clear Data
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        visible={showConflictModal}
        conflicts={conflicts}
        onClose={() => setShowConflictModal(false)}
        onResolved={async () => {
          await loadSyncData();
          Alert.alert('Success', 'Conflicts resolved successfully!');
        }}
      />
    </ScrollView>
  );
};

export default EnhancedSyncStatus;
