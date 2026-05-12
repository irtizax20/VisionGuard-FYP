import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

const { ScreenTimeTracker, UsageStatsModule } = NativeModules as {
  ScreenTimeTracker?: {
    startTracking: () => Promise<boolean>;
    stopTracking: () => Promise<boolean>;
    getTodayScreenTime: () => Promise<number>; // seconds
    setTodayScreenTime: (seconds: number) => Promise<boolean>; // Set from Firestore
    clearTodayScreenTime: () => Promise<boolean>;
    isServiceRunning: () => Promise<boolean>;
    isIgnoringBatteryOptimizations?: () => Promise<boolean>;
    requestIgnoreBatteryOptimizations?: () => Promise<boolean>;
  };
  UsageStatsModule?: {
    hasUsagePermission: () => Promise<boolean>;
    requestUsagePermission: () => Promise<boolean>;
  };
};

const JS_CACHE_PREFIX = 'screenTime_';
let jsTracking = false;
let jsSeconds = 0;
let jsTimer: ReturnType<typeof setInterval> | null = null;

function todayStorageKey(): string {
  const d = new Date();
  return `${JS_CACHE_PREFIX}${d.toDateString()}`;
}

async function loadJsSeconds(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(todayStorageKey());
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}

async function saveJsSeconds(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(todayStorageKey(), String(value));
  } catch {
    // ignore
  }
}

function ensureJsTimer() {
  if (jsTimer) return;
  jsTimer = setInterval(async () => {
    if (!jsTracking) return;
    jsSeconds += 1; // increment per second for UI responsiveness
    await saveJsSeconds(jsSeconds);
  }, 1000);
}

function clearJsTimer() {
  if (jsTimer) {
    clearInterval(jsTimer);
    jsTimer = null;
  }
}

export interface ScreenTrackingStatus {
  isTracking: boolean;
  totalSeconds: number;
  hasUsageAccess: boolean;
  isIgnoringBatteryOpt: boolean;
}

export interface UploadTickPayload {
  totalSeconds: number;
  date: string; // e.g. 2025-01-17
}

// Simple internal event emitter using RN side timers rather than native events
const uploadListeners = new Set<(data: UploadTickPayload) => void>();
let uploadInterval: ReturnType<typeof setInterval> | null = null;

function ensureUploadInterval() {
  if (uploadInterval) return;
  uploadInterval = setInterval(async () => {
    try {
      const status = await NativeScreenTrackingService.getStatus();
      const today = new Date();
      const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
      const payload: UploadTickPayload = {
        totalSeconds: status.totalSeconds,
        date: dateKey,
      };
      uploadListeners.forEach((listener) => listener(payload));
    } catch (e) {
      // Swallow errors to avoid breaking the interval
      console.warn('NativeScreenTrackingService onUploadTick error', e);
    }
  }, 1 * 60 * 1000); // 1 minute
}

function clearUploadIntervalIfNeeded() {
  if (uploadListeners.size === 0 && uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }
}

export const NativeScreenTrackingService = {
  async startTracking(): Promise<boolean> {
    // Native path
    if (ScreenTimeTracker) {
      try {
        const started = await ScreenTimeTracker.startTracking();
        return !!started;
      } catch (e) {
        console.error('Failed to start native screen tracking', e);
        // fallthrough to JS fallback
      }
    }
    // JS fallback
    try {
      jsSeconds = await loadJsSeconds();
      jsTracking = true;
      ensureJsTimer();
      return true;
    } catch {
      return false;
    }
  },

  async stopTracking(): Promise<boolean> {
    // Native path if available
    if (ScreenTimeTracker) {
      try {
        const stopped = await ScreenTimeTracker.stopTracking();
        return !!stopped;
      } catch (e) {
        console.error('Failed to stop native screen tracking', e);
        // fallthrough to JS fallback
      }
    }
    // JS fallback
    jsTracking = false;
    clearJsTimer();
    return true;
  },

  async clearTodayScreenTime(): Promise<boolean> {
    if (!ScreenTimeTracker) {
      // JS fallback: reset local seconds and storage
      jsSeconds = 0;
      await saveJsSeconds(0);
      return true;
    }
    try {
      const cleared = await ScreenTimeTracker.clearTodayScreenTime();
      return !!cleared;
    } catch (e) {
      console.error('Failed to clear screen time', e);
      return false;
    }
  },

  async getStatus(): Promise<ScreenTrackingStatus> {
    try {
      if (!ScreenTimeTracker) {
        // JS fallback status
        if (!jsTracking && jsSeconds === 0) {
          // lazy load stored seconds for today
          try {
            jsSeconds = await loadJsSeconds();
          } catch (error) {
            console.error('❌ Error loading JS seconds:', error);
            jsSeconds = 0;
          }
        }
        const hasUsageAccess = await (UsageStatsModule?.hasUsagePermission?.().catch(() => false) ?? Promise.resolve(false));
        return {
          isTracking: jsTracking,
          totalSeconds: jsSeconds,
          hasUsageAccess: !!hasUsageAccess,
          // Battery optimization is irrelevant in JS fallback; report true to avoid prompting
          isIgnoringBatteryOpt: true,
        };
      }

      const [isTracking, totalSecondsRaw, hasUsageAccess, isIgnoringBatteryOpt] = await Promise.all([
        ScreenTimeTracker.isServiceRunning().catch(() => false),
        ScreenTimeTracker.getTodayScreenTime().catch(() => 0),
        UsageStatsModule?.hasUsagePermission?.().catch(() => false) ?? Promise.resolve(false),
        ScreenTimeTracker.isIgnoringBatteryOptimizations?.().catch(() => false) ?? Promise.resolve(true),
      ]);

      const totalSeconds = typeof totalSecondsRaw === 'number' ? totalSecondsRaw : 0;

      return {
        isTracking,
        totalSeconds,
        hasUsageAccess: !!hasUsageAccess,
        isIgnoringBatteryOpt: !!isIgnoringBatteryOpt,
      };
    } catch (error) {
      console.error('❌ Critical error in getStatus():', error);
      // Return safe defaults to prevent app crash
      return {
        isTracking: false,
        totalSeconds: 0,
        hasUsageAccess: false,
        isIgnoringBatteryOpt: true,
      };
    }
  },

  async openUsageAccessSettings(): Promise<boolean> {
    try {
      if (!UsageStatsModule?.requestUsagePermission) {
        console.warn('⚠️ UsageStatsModule.requestUsagePermission not available');
        return false;
      }
      return await UsageStatsModule.requestUsagePermission();
    } catch (e) {
      console.error('❌ Error opening usage access settings:', e);
      return false;
    }
  },

  async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    try {
      if (!ScreenTimeTracker?.requestIgnoreBatteryOptimizations) return false;
      return await ScreenTimeTracker.requestIgnoreBatteryOptimizations();
    } catch (e) {
      console.error('Failed to request ignore battery optimizations', e);
      return false;
    }
  },

  onUploadTick(callback: (data: UploadTickPayload) => void): () => void {
    uploadListeners.add(callback);
    ensureUploadInterval();

    // Fire immediately once with current status so UI has data
    this.getStatus()
      .then((status) => {
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10);
        callback({ totalSeconds: status.totalSeconds, date: dateKey });
      })
      .catch(() => { });

    return () => {
      uploadListeners.delete(callback);
      clearUploadIntervalIfNeeded();
    };
  },

  formatTime(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds <= 0) {
      return '0m';
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  },
};

export default NativeScreenTrackingService;
