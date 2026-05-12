import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OfflineSyncService, { ConflictData } from '../services/OfflineSyncService';

import { useTheme } from '../hooks/useTheme';

interface ConflictResolutionModalProps {
  visible: boolean;
  conflicts: ConflictData[];
  onClose: () => void;
  onResolved: () => void;
}
// Conflict Resolution Modal Component
interface FieldComparison {
  field: string;
  localValue: any;
  serverValue: any;
  isDifferent: boolean;
  selectedSource: 'local' | 'server' | 'merged';
  customValue?: any;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflicts,
  onClose,
  onResolved,
}) => {
  const { colors, fonts, spacing } = useTheme();
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [fieldComparisons, setFieldComparisons] = useState<FieldComparison[]>([]);
  const [autoResolveEnabled, setAutoResolveEnabled] = useState(false);
  const [resolving, setResolving] = useState(false);

  const currentConflict = conflicts[currentConflictIndex];

  useEffect(() => {
    if (currentConflict) {
      analyzeFieldConflicts();
    }
  }, [currentConflict]);

  const analyzeFieldConflicts = () => {
    if (!currentConflict) return;

    const { localData, serverData } = currentConflict;
    const allFields = new Set([...Object.keys(localData), ...Object.keys(serverData)]);
    const ignoredFields = ['lastModified', 'updatedAt', 'createdAt', '_offline', '_lastSaved'];

    const comparisons: FieldComparison[] = [];

    allFields.forEach(field => {
      if (ignoredFields.includes(field)) return;

      const localValue = localData[field];
      const serverValue = serverData[field];
      const isDifferent = JSON.stringify(localValue) !== JSON.stringify(serverValue);

      comparisons.push({
        field,
        localValue,
        serverValue,
        isDifferent,
        selectedSource: isDifferent ? 'local' : 'server', // Default to local for conflicts
      });
    });

    setFieldComparisons(comparisons.sort((a, b) => (b.isDifferent ? 1 : 0) - (a.isDifferent ? 1 : 0)));
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  const getRecommendedStrategy = (field: string, localValue: any, serverValue: any): 'local' | 'server' | 'merged' => {
    // Smart recommendation logic
    if (field.includes('count') || field.includes('total') || field.includes('sum')) {
      return 'merged'; // Sum numeric values
    }
    if (Array.isArray(localValue) && Array.isArray(serverValue)) {
      return 'merged'; // Merge arrays
    }
    if (field.includes('timestamp') || field.includes('time') || field.includes('date')) {
      const localTime = typeof localValue === 'number' ? localValue : new Date(localValue).getTime();
      const serverTime = typeof serverValue === 'number' ? serverValue : new Date(serverValue).getTime();
      return localTime > serverTime ? 'local' : 'server'; // Use more recent timestamp
    }
    return 'local'; // Default to local (user's latest changes)
  };

  const updateFieldSelection = (fieldIndex: number, source: 'local' | 'server' | 'merged') => {
    const updated = [...fieldComparisons];
    updated[fieldIndex].selectedSource = source;
    
    if (source === 'merged') {
      const field = updated[fieldIndex];
      const { localValue, serverValue } = field;
      
      // Apply smart merging logic
      if (field.field.includes('count') || field.field.includes('total')) {
        field.customValue = (localValue || 0) + (serverValue || 0);
      } else if (Array.isArray(localValue) && Array.isArray(serverValue)) {
        field.customValue = [...new Set([...serverValue, ...localValue])];
      } else {
        field.customValue = localValue; // Fallback to local
      }
    }
    
    setFieldComparisons(updated);
  };

  const applyAutoResolve = () => {
    const updated = fieldComparisons.map(field => {
      if (field.isDifferent) {
        const recommended = getRecommendedStrategy(field.field, field.localValue, field.serverValue);
        field.selectedSource = recommended;
        
        if (recommended === 'merged') {
          if (field.field.includes('count') || field.field.includes('total')) {
            field.customValue = (field.localValue || 0) + (field.serverValue || 0);
          } else if (Array.isArray(field.localValue) && Array.isArray(field.serverValue)) {
            field.customValue = [...new Set([...field.serverValue, ...field.localValue])];
          }
        }
      }
      return field;
    });
    
    setFieldComparisons(updated);
  };

  const resolveConflict = async () => {
    if (!currentConflict) return;

    setResolving(true);
    try {
      // Build merged data based on field selections
      const mergedData = { ...currentConflict.serverData };
      
      fieldComparisons.forEach(field => {
        switch (field.selectedSource) {
          case 'local':
            mergedData[field.field] = field.localValue;
            break;
          case 'server':
            mergedData[field.field] = field.serverValue;
            break;
          case 'merged':
            mergedData[field.field] = field.customValue || field.localValue;
            break;
        }
      });

      await OfflineSyncService.resolveConflictManually(
        currentConflict.id,
        'use_merged',
        mergedData
      );

      // Move to next conflict or close
      if (currentConflictIndex < conflicts.length - 1) {
        setCurrentConflictIndex(currentConflictIndex + 1);
      } else {
        onResolved();
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve conflict');
      console.error('Conflict resolution error:', error);
    } finally {
      setResolving(false);
    }
  };

  const resolveAllConflicts = async (strategy: 'use_local' | 'use_server' | 'use_merged') => {
    setResolving(true);
    try {
      for (const conflict of conflicts) {
        await OfflineSyncService.resolveConflictManually(conflict.id, strategy);
      }
      onResolved();
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve all conflicts');
      console.error('Bulk conflict resolution error:', error);
    } finally {
      setResolving(false);
    }
  };

  if (!visible || !currentConflict) return null;

  const conflictedFields = fieldComparisons.filter(f => f.isDifferent);

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: spacing.lg,
      width: '90%',
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: spacing.md,
    },
    title: {
      fontSize: fonts.xlarge,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    conflictInfo: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    conflictTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    conflictDetails: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    progressIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    progressText: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      marginHorizontal: spacing.sm,
    },
    autoResolveSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    autoResolveText: {
      fontSize: fonts.medium,
      color: colors.text,
      flex: 1,
    },
    fieldComparison: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    fieldHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBackground,
      padding: spacing.md,
    },
    fieldName: {
      fontSize: fonts.medium,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    conflictBadge: {
      backgroundColor: colors.error,
      borderRadius: 12,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    conflictBadgeText: {
      fontSize: fonts.small,
      color: colors.surface,
      fontWeight: '600',
    },
    valueComparison: {
      flexDirection: 'row',
    },
    valueSection: {
      flex: 1,
      padding: spacing.md,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    valueSectionLast: {
      borderRightWidth: 0,
    },
    valueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    valueHeaderText: {
      fontSize: fonts.small,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: spacing.xs,
    },
    valueText: {
      fontSize: fonts.small,
      color: colors.text,
      fontFamily: 'monospace',
      backgroundColor: colors.surface,
      padding: spacing.sm,
      borderRadius: 8,
    },
    selectionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: spacing.md,
      backgroundColor: colors.surface,
    },
    selectionButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    selectionButtonText: {
      fontSize: fonts.small,
      color: colors.textSecondary,
    },
    selectedButtonText: {
      color: colors.surface,
      fontWeight: '600',
    },
    bulkActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bulkButton: {
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
    bulkButtonText: {
      fontSize: fonts.medium,
      color: colors.text,
      textAlign: 'center',
    },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: '600',
    },
    navigation: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.cardBackground,
    },
    navButtonDisabled: {
      opacity: 0.5,
    },
    navButtonText: {
      fontSize: fonts.medium,
      color: colors.primary,
      marginHorizontal: spacing.xs,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Resolve Data Conflict</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.conflictInfo}>
            <Text style={styles.conflictTitle}>
              {currentConflict.collection}/{currentConflict.documentId}
            </Text>
            <Text style={styles.conflictDetails}>
              Local: {new Date(currentConflict.localTimestamp).toLocaleString()}
            </Text>
            <Text style={styles.conflictDetails}>
              Server: {new Date(currentConflict.serverTimestamp).toLocaleString()}
            </Text>
          </View>

          <View style={styles.progressIndicator}>
            <Ionicons name="git-compare" size={20} color={colors.primary} />
            <Text style={styles.progressText}>
              Conflict {currentConflictIndex + 1} of {conflicts.length}
            </Text>
          </View>

          <View style={styles.autoResolveSection}>
            <Text style={styles.autoResolveText}>Auto-resolve using smart strategies</Text>
            <Switch
              value={autoResolveEnabled}
              onValueChange={(enabled) => {
                setAutoResolveEnabled(enabled);
                if (enabled) {
                  applyAutoResolve();
                }
              }}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.conflictTitle}>
              {conflictedFields.length} field{conflictedFields.length !== 1 ? 's' : ''} with conflicts
            </Text>

            {fieldComparisons.map((field, index) => (
              <View key={field.field} style={styles.fieldComparison}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.fieldName}>{field.field}</Text>
                  {field.isDifferent && (
                    <View style={styles.conflictBadge}>
                      <Text style={styles.conflictBadgeText}>CONFLICT</Text>
                    </View>
                  )}
                </View>

                {field.isDifferent && (
                  <>
                    <View style={styles.valueComparison}>
                      <View style={styles.valueSection}>
                        <View style={styles.valueHeader}>
                          <Ionicons name="phone-portrait" size={16} color={colors.primary} />
                          <Text style={styles.valueHeaderText}>Local (Your Device)</Text>
                        </View>
                        <Text style={styles.valueText} numberOfLines={3}>
                          {formatValue(field.localValue)}
                        </Text>
                      </View>

                      <View style={[styles.valueSection, styles.valueSectionLast]}>
                        <View style={styles.valueHeader}>
                          <Ionicons name="cloud" size={16} color={colors.secondary} />
                          <Text style={styles.valueHeaderText}>Server (Cloud)</Text>
                        </View>
                        <Text style={styles.valueText} numberOfLines={3}>
                          {formatValue(field.serverValue)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.selectionButtons}>
                      <TouchableOpacity
                        style={[
                          styles.selectionButton,
                          field.selectedSource === 'local' && styles.selectedButton,
                        ]}
                        onPress={() => updateFieldSelection(index, 'local')}
                      >
                        <Text
                          style={[
                            styles.selectionButtonText,
                            field.selectedSource === 'local' && styles.selectedButtonText,
                          ]}
                        >
                          Use Local
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.selectionButton,
                          field.selectedSource === 'server' && styles.selectedButton,
                        ]}
                        onPress={() => updateFieldSelection(index, 'server')}
                      >
                        <Text
                          style={[
                            styles.selectionButtonText,
                            field.selectedSource === 'server' && styles.selectedButtonText,
                          ]}
                        >
                          Use Server
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.selectionButton,
                          field.selectedSource === 'merged' && styles.selectedButton,
                        ]}
                        onPress={() => updateFieldSelection(index, 'merged')}
                      >
                        <Text
                          style={[
                            styles.selectionButtonText,
                            field.selectedSource === 'merged' && styles.selectedButtonText,
                          ]}
                        >
                          Smart Merge
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.navigation}>
            <TouchableOpacity
              style={[
                styles.navButton,
                currentConflictIndex === 0 && styles.navButtonDisabled,
              ]}
              onPress={() => setCurrentConflictIndex(Math.max(0, currentConflictIndex - 1))}
              disabled={currentConflictIndex === 0}
            >
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bulkButton, styles.primaryButton]}
              onPress={resolveConflict}
              disabled={resolving}
            >
              <Text style={[styles.bulkButtonText, styles.primaryButtonText]}>
                {resolving ? 'Resolving...' : 'Resolve This Conflict'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navButton,
                currentConflictIndex >= conflicts.length - 1 && styles.navButtonDisabled,
              ]}
              onPress={() => 
                setCurrentConflictIndex(Math.min(conflicts.length - 1, currentConflictIndex + 1))
              }
              disabled={currentConflictIndex >= conflicts.length - 1}
            >
              <Text style={styles.navButtonText}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={styles.bulkButton}
              onPress={() => resolveAllConflicts('use_local')}
              disabled={resolving}
            >
              <Text style={styles.bulkButtonText}>Use All Local</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bulkButton}
              onPress={() => resolveAllConflicts('use_server')}
              disabled={resolving}
            >
              <Text style={styles.bulkButtonText}>Use All Server</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConflictResolutionModal;
