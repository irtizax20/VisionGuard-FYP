import { NativeModules, Platform } from 'react-native';

type NativeScreenBreakModule = {
  setBreakInterval(intervalMinutes: number): Promise<boolean>;
  getBreakInterval(): Promise<number>;
};

const getNativeModule = (): NativeScreenBreakModule | null => {
  const nativeModule = NativeModules.ScreenBreakModule as NativeScreenBreakModule | undefined;
  if (!nativeModule) {
    console.warn(
      '[ScreenBreakService] Native module not found. Please rebuild the Android app to link ScreenBreakModule.'
    );
    return null;
  }
  return nativeModule;
};

class ScreenBreakServiceImpl {
  async setBreakInterval(intervalMinutes: number): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('Screen break intervals are only supported on Android');
      return false;
    }

    const nativeModule = getNativeModule();
    if (!nativeModule) {
      return false;
    }

    try {
      const result = await nativeModule.setBreakInterval(intervalMinutes);
      console.log(`✅ Break interval set to ${intervalMinutes} minutes`);
      return result;
    } catch (error) {
      console.error('❌ Failed to set break interval:', error);
      throw error;
    }
  }

  async getBreakInterval(): Promise<number> {
    if (Platform.OS !== 'android') {
      return 30; // Default 30 minutes
    }

    const nativeModule = getNativeModule();
    if (!nativeModule) {
      return 30;
    }

    try {
      const interval = await nativeModule.getBreakInterval();
      console.log(`📊 Current break interval: ${interval} minutes`);
      return interval;
    } catch (error) {
      console.error('❌ Failed to get break interval:', error);
      return 30; // Default fallback
    }
  }
}

export default new ScreenBreakServiceImpl();
