// services/OfflineSyncService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  documentId: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  userId: string;
  conflictResolution: 'client_wins' | 'server_wins' | 'merge' | 'manual';
  priority: 'high' | 'medium' | 'low';
  estimatedSize: number;  
  dependencies?: string[]; // Other sync items this depends on
  retryBackoffMs: number; // Exponential backoff for retries
  lastRetryTime?: number; // When last retry was attempted
}

export interface ConflictData {
  id: string;
  localData: any;
  serverData: any;
  localTimestamp: number;
  serverTimestamp: number;
  collection: string;
  documentId: string;
  status: 'pending' | 'resolved' | 'failed';
}

export interface SyncStatus {
  isOnline: boolean;
  queueSize: number;
  syncInProgress: boolean;
  lastSyncTime: number | null;
  conflictsCount: number;
  failedSyncs: number;
}

class OfflineSyncService {
  private static instance: OfflineSyncService;
  private syncQueue: SyncQueueItem[] = [];
  private conflicts: ConflictData[] = [];
  private isSyncing: boolean = false;
  private isOnline: boolean = true;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  
  // Storage keys
  private readonly SYNC_QUEUE_KEY = 'offline_sync_queue';
  private readonly CONFLICTS_KEY = 'offline_conflicts';
  private readonly LAST_SYNC_KEY = 'last_sync_timestamp';
  private readonly OFFLINE_DATA_PREFIX = 'offline_data_';

  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  // Initialize the sync service
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Offline Sync Service...');
      
      // Load persisted sync queue and conflicts
      await this.loadSyncQueue();
      await this.loadConflicts();
      
      // Set up network status monitoring
      this.setupNetworkMonitoring();
      
      // Set up periodic sync (every 30 seconds when online)
      this.setupPeriodicSync();
      
      // Try initial sync if online
      if (this.isOnline) {
        await this.processSyncQueue();
      }
      
      console.log('✅ Offline Sync Service initialized');
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Error initializing Offline Sync Service:', error);
    }
  }

  // Add listener for sync status changes
  addStatusListener(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of status changes
  private notifyListeners(): void {
    const status = this.getSyncStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error notifying sync status listener:', error);
      }
    });
  }

  // Get current sync status
  getSyncStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      queueSize: this.syncQueue.length,
      syncInProgress: this.isSyncing,
      lastSyncTime: null, // Will be loaded from storage
      conflictsCount: this.conflicts.length,
      failedSyncs: this.syncQueue.filter(item => item.retryCount > 0).length,
    };
  }

  // Setup network monitoring
  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      console.log(`🌐 Network status changed: ${this.isOnline ? 'Online' : 'Offline'}`);
      
      // If we came back online, try to sync
      if (this.isOnline && !wasOnline) {
        console.log('📡 Reconnected - starting sync...');
        this.processSyncQueue();
      }
      
      this.notifyListeners();
    });
  }

  // Setup periodic sync
  private setupPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing && this.syncQueue.length > 0) {
        await this.processSyncQueue();
      }
    }, 30000) as unknown as NodeJS.Timeout; // Every 30 seconds
  }

  // Add operation to sync queue with enhanced optimization
  async queueOperation(
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    collection: string,
    documentId: string,
    data: any,
    conflictResolution: 'client_wins' | 'server_wins' | 'merge' | 'manual' = 'merge',
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      // Calculate estimated size for bandwidth optimization
      const estimatedSize = this.calculateDataSize(data);
      
      const queueItem: SyncQueueItem = {
        id: `${collection}_${documentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        collection,
        documentId,
        data: {
          ...data,
          lastModified: Date.now(),
          userId: auth.currentUser.uid,
        },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: priority === 'high' ? 5 : priority === 'medium' ? 3 : 2,
        userId: auth.currentUser.uid,
        conflictResolution,
        priority,
        estimatedSize,
        retryBackoffMs: 1000, // Initial backoff: 1 second
      };

      // Add to queue
      this.syncQueue.push(queueItem);
      
      // Save locally for offline access
      await this.saveOfflineData(collection, documentId, queueItem.data);
      
      // Persist queue
      await this.saveSyncQueue();
      
      console.log(`📝 Queued ${type} operation for ${collection}/${documentId}`);
      
      // Try to sync immediately if online
      if (this.isOnline && !this.isSyncing) {
        await this.processSyncQueue();
      }
      
      this.notifyListeners();
    } catch (error) {
      console.error('Error queuing operation:', error);
      throw error;
    }
  }

  // Process the sync queue
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    console.log(`🔄 Processing sync queue (${this.syncQueue.length} items)...`);
    
    try {
      const itemsToProcess = [...this.syncQueue];
      
      for (const item of itemsToProcess) {
        try {
          await this.processSyncItem(item);
          
          // Remove from queue on successful sync
          this.syncQueue = this.syncQueue.filter(queueItem => queueItem.id !== item.id);
        } catch (error) {
          console.error(`❌ Error syncing item ${item.id}:`, error);
          
          // Increment retry count
          const queueItem = this.syncQueue.find(q => q.id === item.id);
          if (queueItem) {
            queueItem.retryCount++;
            
            // Remove if max retries exceeded
            if (queueItem.retryCount >= queueItem.maxRetries) {
              console.error(`🚫 Max retries exceeded for ${item.id}, removing from queue`);
              this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
            }
          }
        }
      }
      
      // Save updated queue
      await this.saveSyncQueue();
      
      // Update last sync time
      await AsyncStorage.setItem(this.LAST_SYNC_KEY, Date.now().toString());
      
      console.log('✅ Sync queue processed successfully');
    } catch (error) {
      console.error('❌ Error processing sync queue:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  // Process individual sync item
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const docRef = doc(db, item.collection, item.documentId);
    
    try {
      switch (item.type) {
        case 'CREATE':
          await this.handleCreateOperation(docRef, item);
          break;
        case 'UPDATE':
          await this.handleUpdateOperation(docRef, item);
          break;
        case 'DELETE':
          await this.handleDeleteOperation(docRef, item);
          break;
      }
      
      console.log(`✅ Successfully synced ${item.type} for ${item.collection}/${item.documentId}`);
    } catch (error) {
      console.error(`❌ Failed to sync ${item.type} for ${item.collection}/${item.documentId}:`, error);
      throw error;
    }
  }

  // Handle create operation with conflict detection
  private async handleCreateOperation(docRef: any, item: SyncQueueItem): Promise<void> {
    // Check if document already exists (potential conflict)
    const serverDoc = await getDoc(docRef);
    
    if (serverDoc.exists()) {
      // Document exists on server - potential conflict
      await this.handleConflict(item, serverDoc.data());
    } else {
      // Safe to create
      await setDoc(docRef, {
        ...item.data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  // Handle update operation with conflict detection
  private async handleUpdateOperation(docRef: any, item: SyncQueueItem): Promise<void> {
    const serverDoc = await getDoc(docRef);
    
    if (!serverDoc.exists()) {
      // Document doesn't exist on server - convert to create
      await this.handleCreateOperation(docRef, item);
      return;
    }
    
    const serverData = serverDoc.data() as any;
    const serverTimestamp = serverData?.lastModified || serverData?.updatedAt?.seconds * 1000 || 0;
    const localTimestamp = item.data.lastModified || item.timestamp;
    
    // Check for conflicts
    if (serverTimestamp > localTimestamp && this.hasDataConflicts(item.data, serverData)) {
      await this.handleConflict(item, serverData);
    } else {
      // Safe to update - use merge to avoid overwriting other fields
      await setDoc(docRef, {
        ...item.data,
        updatedAt: Date.now(),
      }, { merge: true });
    }
  }

  // Handle delete operation
  private async handleDeleteOperation(docRef: any, item: SyncQueueItem): Promise<void> {
    const serverDoc = await getDoc(docRef);
    
    if (serverDoc.exists()) {
      const serverData = serverDoc.data() as any;
      const serverTimestamp = serverData?.lastModified || serverData?.updatedAt?.seconds * 1000 || 0;
      
      // Check if server version is newer
      if (serverTimestamp > item.timestamp) {
        await this.handleConflict(item, serverData);
      } else {
        // Safe to delete
        await docRef.delete();
      }
    }
    // If document doesn't exist, deletion is already complete
  }

  // Handle data conflicts
  private async handleConflict(item: SyncQueueItem, serverData: any): Promise<void> {
    const conflict: ConflictData = {
      id: `conflict_${item.id}`,
      localData: item.data,
      serverData,
      localTimestamp: item.data.lastModified || item.timestamp,
      serverTimestamp: serverData.lastModified || serverData.updatedAt?.seconds * 1000 || 0,
      collection: item.collection,
      documentId: item.documentId,
      status: 'pending',
    };
    
    // Apply conflict resolution strategy
    switch (item.conflictResolution) {
      case 'client_wins':
        await this.resolveConflictClientWins(item);
        break;
      case 'server_wins':
        await this.resolveConflictServerWins(item, serverData);
        break;
      case 'merge':
        await this.resolveConflictMerge(item, serverData);
        break;
      case 'manual':
        this.conflicts.push(conflict);
        await this.saveConflicts();
        console.log(`⚠️ Manual conflict resolution required for ${item.collection}/${item.documentId}`);
        break;
    }
  }

  // Client wins conflict resolution
  private async resolveConflictClientWins(item: SyncQueueItem): Promise<void> {
    const docRef = doc(db, item.collection, item.documentId);
    await setDoc(docRef, {
      ...item.data,
      updatedAt: Date.now(),
      conflictResolved: true,
      resolutionStrategy: 'client_wins',
    }, { merge: true });
    console.log(`✅ Conflict resolved (client wins) for ${item.collection}/${item.documentId}`);
  }

  // Server wins conflict resolution
  private async resolveConflictServerWins(item: SyncQueueItem, serverData: any): Promise<void> {
    // Update local data with server data
    await this.saveOfflineData(item.collection, item.documentId, {
      ...serverData,
      conflictResolved: true,
      resolutionStrategy: 'server_wins',
    });
    console.log(`✅ Conflict resolved (server wins) for ${item.collection}/${item.documentId}`);
  }

  // Merge conflict resolution
  private async resolveConflictMerge(item: SyncQueueItem, serverData: any): Promise<void> {
    const mergedData = this.mergeData(item.data, serverData);
    const docRef = doc(db, item.collection, item.documentId);
    
    await setDoc(docRef, {
      ...mergedData,
      updatedAt: Date.now(),
      conflictResolved: true,
      resolutionStrategy: 'merge',
    }, { merge: true });
    
    // Update local data
    await this.saveOfflineData(item.collection, item.documentId, mergedData);
    console.log(`✅ Conflict resolved (merge) for ${item.collection}/${item.documentId}`);
  }

  // Intelligent data merging
  private mergeData(localData: any, serverData: any): any {
    const merged = { ...serverData }; // Start with server data as base
    
    // Merge specific fields with intelligent rules
    Object.keys(localData).forEach(key => {
      if (key === 'lastModified' || key === 'updatedAt') {
        // Use most recent timestamp
        merged[key] = Math.max(localData[key] || 0, serverData[key] || 0);
      } else if (Array.isArray(localData[key]) && Array.isArray(serverData[key])) {
        // Merge arrays (remove duplicates)
        merged[key] = [...new Set([...serverData[key], ...localData[key]])];
      } else if (typeof localData[key] === 'number' && typeof serverData[key] === 'number') {
        // For numeric values, use the larger value (assuming it's more recent/accurate)
        merged[key] = Math.max(localData[key], serverData[key]);
      } else if (localData[key] !== undefined && localData[key] !== null) {
        // For other types, prefer local data if it exists
        merged[key] = localData[key];
      }
    });
    
    return merged;
  }

  // Check if there are actual data conflicts
  private hasDataConflicts(localData: any, serverData: any): boolean {
    const ignoredFields = ['lastModified', 'updatedAt', 'createdAt'];
    
    return Object.keys(localData).some(key => {
      if (ignoredFields.includes(key)) return false;
      return localData[key] !== serverData[key];
    });
  }

  // Manually resolve a conflict
  async resolveConflictManually(
    conflictId: string,
    resolution: 'use_local' | 'use_server' | 'use_merged',
    mergedData?: any
  ): Promise<void> {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    const docRef = doc(db, conflict.collection, conflict.documentId);
    let finalData;

    switch (resolution) {
      case 'use_local':
        finalData = conflict.localData;
        break;
      case 'use_server':
        finalData = conflict.serverData;
        break;
      case 'use_merged':
        finalData = mergedData || this.mergeData(conflict.localData, conflict.serverData);
        break;
    }

    // Update server
    await setDoc(docRef, {
      ...finalData,
      updatedAt: Date.now(),
      conflictResolved: true,
      resolutionStrategy: resolution,
    }, { merge: true });

    // Update local data
    await this.saveOfflineData(conflict.collection, conflict.documentId, finalData);

    // Remove from conflicts
    this.conflicts = this.conflicts.filter(c => c.id !== conflictId);
    await this.saveConflicts();

    console.log(`✅ Manually resolved conflict ${conflictId} with ${resolution}`);
    this.notifyListeners();
  }

  // Save data locally for offline access
  private async saveOfflineData(collection: string, documentId: string, data: any): Promise<void> {
    const key = `${this.OFFLINE_DATA_PREFIX}${collection}_${documentId}`;
    await AsyncStorage.setItem(key, JSON.stringify({
      ...data,
      _offline: true,
      _lastSaved: Date.now(),
    }));
  }

  // Get offline data
  async getOfflineData(collection: string, documentId: string): Promise<any | null> {
    try {
      const key = `${this.OFFLINE_DATA_PREFIX}${collection}_${documentId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  }

  // Get all offline data for a collection
  async getAllOfflineData(collection: string): Promise<any[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const collectionKeys = keys.filter(key => 
        key.startsWith(`${this.OFFLINE_DATA_PREFIX}${collection}_`)
      );
      
      const data = await AsyncStorage.multiGet(collectionKeys);
      return data.map(([key, value]) => value ? JSON.parse(value) : null).filter(Boolean);
    } catch (error) {
      console.error('Error getting all offline data:', error);
      return [];
    }
  }

  // Persist sync queue to storage
  private async saveSyncQueue(): Promise<void> {
    await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
  }

  // Load sync queue from storage
  private async loadSyncQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      this.syncQueue = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }

  // Persist conflicts to storage
  private async saveConflicts(): Promise<void> {
    await AsyncStorage.setItem(this.CONFLICTS_KEY, JSON.stringify(this.conflicts));
  }

  // Load conflicts from storage
  private async loadConflicts(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.CONFLICTS_KEY);
      this.conflicts = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading conflicts:', error);
      this.conflicts = [];
    }
  }

  // Clear all offline data
  async clearOfflineData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => key.startsWith(this.OFFLINE_DATA_PREFIX));
      await AsyncStorage.multiRemove(offlineKeys);
      
      this.syncQueue = [];
      this.conflicts = [];
      await this.saveSyncQueue();
      await this.saveConflicts();
      
      console.log('✅ Cleared all offline data');
      this.notifyListeners();
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }

  // Force sync now
  async forcSync(): Promise<void> {
    if (this.isOnline && !this.isSyncing) {
      await this.processSyncQueue();
    }
  }

  // Get pending conflicts for manual resolution
  getPendingConflicts(): ConflictData[] {
    return this.conflicts.filter(c => c.status === 'pending');
  }

  // 🚀 ENHANCED OPTIMIZATION METHODS

  // Calculate data size for bandwidth optimization
  private calculateDataSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch (error) {
      // Fallback estimation
      return JSON.stringify(data || {}).length * 2; // Rough UTF-16 estimate
    }
  }

  // Sort sync queue by priority and retry backoff
  private sortSyncQueue(): SyncQueueItem[] {
    return this.syncQueue.sort((a, b) => {
      // First, sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by retry backoff (items ready for retry first)
      const now = Date.now();
      const aReadyTime = (a.lastRetryTime || 0) + a.retryBackoffMs;
      const bReadyTime = (b.lastRetryTime || 0) + b.retryBackoffMs;
      const aReady = now >= aReadyTime;
      const bReady = now >= bReadyTime;
      
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      
      // Finally by timestamp (oldest first)
      return a.timestamp - b.timestamp;
    });
  }

  // Enhanced process sync queue with batch processing
  private async processOptimizedSyncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    console.log(`🚀 Processing optimized sync queue (${this.syncQueue.length} items)...`);
    
    try {
      // Sort queue by priority and readiness
      const sortedQueue = this.sortSyncQueue();
      
      // Process in batches to avoid overwhelming the network
      const batchSize = this.calculateOptimalBatchSize();
      const batches = this.createBatches(sortedQueue, batchSize);
      
      for (const batch of batches) {
        const batchPromises = batch.map(item => this.processOptimizedSyncItem(item));
        
        // Process batch concurrently with some rate limiting
        const results = await Promise.allSettled(batchPromises);
        
        // Handle results
        results.forEach((result, index) => {
          const item = batch[index];
          if (result.status === 'fulfilled') {
            // Remove successful items
            this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
            console.log(`✅ Batch sync successful for ${item.collection}/${item.documentId}`);
          } else {
            // Handle failed items with exponential backoff
            this.handleSyncFailure(item, result.reason);
          }
        });
        
        // Small delay between batches to avoid rate limiting
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.delay(500); // 500ms between batches
        }
      }
      
      await this.saveSyncQueue();
      await AsyncStorage.setItem(this.LAST_SYNC_KEY, Date.now().toString());
      
      console.log('✅ Optimized sync queue processed successfully');
    } catch (error) {
      console.error('❌ Error processing optimized sync queue:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  // Calculate optimal batch size based on network and data size
  private calculateOptimalBatchSize(): number {
    const totalSize = this.syncQueue.reduce((sum, item) => sum + item.estimatedSize, 0);
    const averageSize = totalSize / (this.syncQueue.length || 1);
    
    // Adjust batch size based on average item size
    if (averageSize < 1024) { // Small items (< 1KB)
      return Math.min(10, this.syncQueue.length);
    } else if (averageSize < 10240) { // Medium items (< 10KB)
      return Math.min(5, this.syncQueue.length);
    } else { // Large items (>= 10KB)
      return Math.min(3, this.syncQueue.length);
    }
  }

  // Create batches from sorted queue
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  // Enhanced sync item processing with conflict prevention
  private async processOptimizedSyncItem(item: SyncQueueItem): Promise<void> {
    // Check dependencies first
    if (item.dependencies && item.dependencies.length > 0) {
      const unresolvedDeps = item.dependencies.filter(depId => 
        this.syncQueue.some(q => q.id === depId)
      );
      
      if (unresolvedDeps.length > 0) {
        console.log(`⏳ Skipping ${item.id} - waiting for dependencies: ${unresolvedDeps.join(', ')}`);
        throw new Error(`Dependencies not resolved: ${unresolvedDeps.join(', ')}`);
      }
    }

    // Check retry backoff
    const now = Date.now();
    const retryTime = (item.lastRetryTime || 0) + item.retryBackoffMs;
    if (now < retryTime) {
      throw new Error(`Item not ready for retry until ${new Date(retryTime).toISOString()}`);
    }

    // Process the item
    await this.processSyncItem(item);
  }

  // Handle sync failure with intelligent retry
  private handleSyncFailure(item: SyncQueueItem, error: any): void {
    console.error(`❌ Sync failed for ${item.id}:`, error);
    
    const queueItem = this.syncQueue.find(q => q.id === item.id);
    if (queueItem) {
      queueItem.retryCount++;
      queueItem.lastRetryTime = Date.now();
      
      // Exponential backoff with jitter
      const baseBackoff = 1000; // 1 second
      const maxBackoff = 300000; // 5 minutes
      const exponentialBackoff = Math.min(
        baseBackoff * Math.pow(2, queueItem.retryCount),
        maxBackoff
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * exponentialBackoff;
      queueItem.retryBackoffMs = exponentialBackoff + jitter;
      
      console.log(`🔄 Retry ${queueItem.retryCount}/${queueItem.maxRetries} for ${item.id} in ${Math.round(queueItem.retryBackoffMs/1000)}s`);
      
      // Remove if max retries exceeded
      if (queueItem.retryCount >= queueItem.maxRetries) {
        console.error(`🚫 Max retries exceeded for ${item.id}, removing from queue`);
        this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
      }
    }
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get sync queue statistics
  getSyncQueueStats(): {
    total: number;
    byPriority: { high: number; medium: number; low: number };
    byStatus: { pending: number; retrying: number; failed: number };
    totalSize: number;
    averageSize: number;
  } {
    const byPriority = { high: 0, medium: 0, low: 0 };
    const byStatus = { pending: 0, retrying: 0, failed: 0 };
    let totalSize = 0;

    this.syncQueue.forEach(item => {
      byPriority[item.priority]++;
      totalSize += item.estimatedSize;
      
      if (item.retryCount === 0) {
        byStatus.pending++;
      } else if (item.retryCount < item.maxRetries) {
        byStatus.retrying++;
      } else {
        byStatus.failed++;
      }
    });

    return {
      total: this.syncQueue.length,
      byPriority,
      byStatus,
      totalSize,
      averageSize: totalSize / (this.syncQueue.length || 1),
    };
  }

  // Add operation with dependencies
  async queueOperationWithDependencies(
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    collection: string,
    documentId: string,
    data: any,
    dependencies: string[] = [],
    priority: 'high' | 'medium' | 'low' = 'medium',
    conflictResolution: 'client_wins' | 'server_wins' | 'merge' | 'manual' = 'merge'
  ): Promise<string> {
    const estimatedSize = this.calculateDataSize(data);
    
    const queueItem: SyncQueueItem = {
      id: `${collection}_${documentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      collection,
      documentId,
      data: {
        ...data,
        lastModified: Date.now(),
        userId: auth.currentUser?.uid,
      },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: priority === 'high' ? 5 : priority === 'medium' ? 3 : 2,
      userId: auth.currentUser?.uid || '',
      conflictResolution,
      priority,
      estimatedSize,
      dependencies,
      retryBackoffMs: 1000,
    };

    this.syncQueue.push(queueItem);
    await this.saveOfflineData(collection, documentId, queueItem.data);
    await this.saveSyncQueue();
    
    console.log(`📝 Queued ${type} operation with dependencies for ${collection}/${documentId}`);
    
    if (this.isOnline && !this.isSyncing) {
      await this.processOptimizedSyncQueue();
    }
    
    this.notifyListeners();
    return queueItem.id;
  }


  // Cleanup - call when service is no longer needed
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners = [];
  }

  // Clear all offline data from AsyncStorage (called on logout)
  async clearAllData(): Promise<void> {
    try {
      console.log('🗑️ Clearing all offline sync data...');
      
      // Clear sync queue
      await AsyncStorage.removeItem(this.SYNC_QUEUE_KEY);
      this.syncQueue = [];
      
      // Clear conflicts
      await AsyncStorage.removeItem(this.CONFLICTS_KEY);
      this.conflicts = [];
      
      // Clear last sync timestamp
      await AsyncStorage.removeItem(this.LAST_SYNC_KEY);
      
      // Clear all offline cached data (offline_data_*)
      const allKeys = await AsyncStorage.getAllKeys();
      const offlineDataKeys = allKeys.filter(key => key.startsWith(this.OFFLINE_DATA_PREFIX));
      if (offlineDataKeys.length > 0) {
        await AsyncStorage.multiRemove(offlineDataKeys);
        console.log(`🗑️ Removed ${offlineDataKeys.length} offline data entries`);
      }
      
      console.log('✅ All offline sync data cleared');
    } catch (error) {
      console.error('❌ Error clearing offline sync data:', error);
      throw error;
    }
  }
}

export default OfflineSyncService.getInstance();
