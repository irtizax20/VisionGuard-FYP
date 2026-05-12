import { useEffect, useState } from 'react';
import NativeScreenTrackingService, {
  ScreenTrackingStatus,
} from '../services/NativeScreenTrackingService';

interface GlobalScreenTimerState {
  formattedTime: string;
  isTracking: boolean;
  sessionTime: number; // seconds in current session (approx)
  todayTime: number; // total seconds today
  lastUpdated: Date | null;
}

export function useGlobalScreenTimer(): GlobalScreenTimerState {
  const [state, setState] = useState<GlobalScreenTimerState>({
    formattedTime: '0m',
    isTracking: false,
    sessionTime: 0,
    todayTime: 0,
    lastUpdated: null,
  });

  useEffect(() => {
    let sessionTimer: ReturnType<typeof setInterval> | null = null;

    const applyStatus = (status: ScreenTrackingStatus) => {
      setState((prev) => ({
        formattedTime: NativeScreenTrackingService.formatTime(status.totalSeconds),
        isTracking: status.isTracking,
        todayTime: status.totalSeconds,
        // Reset sessionTime when tracking toggles off; otherwise keep incrementing
        sessionTime: status.isTracking ? prev.sessionTime : 0,
        lastUpdated: new Date(),
      }));
    };

    const init = async () => {
      try {
        const status = await NativeScreenTrackingService.getStatus();
        applyStatus(status);
      } catch (e) {
        console.warn('useGlobalScreenTimer init error', e);
      }
    };

    init();

    const unsubscribe = NativeScreenTrackingService.onUploadTick((data) => {
      setState((prev) => ({
        ...prev,
        formattedTime: NativeScreenTrackingService.formatTime(data.totalSeconds),
        todayTime: data.totalSeconds,
        lastUpdated: new Date(),
      }));
    });

    // Lightweight session timer – approximate seconds while tracking is active
    sessionTimer = setInterval(() => {
      setState((prev) => {
        if (!prev.isTracking) return prev;
        const nextSession = prev.sessionTime + 1;
        return {
          ...prev,
          sessionTime: nextSession,
        };
      });
    }, 1000);

    return () => {
      unsubscribe();
      if (sessionTimer) clearInterval(sessionTimer);
    };
  }, []);

  return state;
}

export default useGlobalScreenTimer;
