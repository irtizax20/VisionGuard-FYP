import * as Brightness from 'expo-brightness';
import { AppState, AppStateStatus } from 'react-native';

export interface BrightnessConfig {
  autoManage: boolean; 
  restoreOnBackground: boolean; // Restore brightness when app goes to background
  maxBrightness: number; // Maximum brightness level (0-1)
}

class BrightnessService {
  private static instance: BrightnessService;
  private originalBrightness: number | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: any = null;
  private isBrightnessManaged: boolean = false;
  
  private config: BrightnessConfig = {
    autoManage: true,
    restoreOnBackground: true,
    maxBrightness: 1.0,
  };

  static getInstance(): BrightnessService {
    if (!BrightnessService.instance) {
      BrightnessService.instance = new BrightnessService();
    }
    return BrightnessService.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔆 Initializing Brightness Service...');
      
      this.setupAppStateListener();
      
      console.log('✅ Brightness Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Brightness Service:', error);
    }
  }

  private setupAppStateListener(): void {
    this.appState = AppState.currentState;
    
    this.appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      const previousState = this.appState;
      this.appState = nextState;

      console.log(`📱 App state changed: ${previousState} → ${nextState}`);

      // Restore brightness when app goes to background
      if (this.config.restoreOnBackground && 
          this.isBrightnessManaged && 
          (nextState === 'background' || nextState === 'inactive')) {
        await this.restoreBrightness();
      }
    });
  }

  /**
   * Set brightness to maximum for better camera visibility
   */
  async setMaxBrightness(): Promise<void> {
    try {
      // Only save original brightness if not already managed
      if (!this.isBrightnessManaged) {
        this.originalBrightness = await Brightness.getBrightnessAsync();
        console.log(`🔆 Saved original brightness: ${this.originalBrightness}`);
      }
      
      await Brightness.setBrightnessAsync(this.config.maxBrightness);
      this.isBrightnessManaged = true;
      console.log(`✅ Brightness set to ${this.config.maxBrightness}`);
    } catch (error) {
      console.error('❌ Failed to set max brightness:', error);
    }
  }

  /**
   * Set brightness to a specific level
   */
  async setBrightness(level: number): Promise<void> {
    try {
      // Clamp brightness between 0 and 1
      const clampedLevel = Math.max(0, Math.min(1, level));
      
      // Save original brightness if not already managed
      if (!this.isBrightnessManaged) {
        this.originalBrightness = await Brightness.getBrightnessAsync();
        console.log(`🔆 Saved original brightness: ${this.originalBrightness}`);
      }
      
      await Brightness.setBrightnessAsync(clampedLevel);
      this.isBrightnessManaged = true;
      console.log(`✅ Brightness set to ${clampedLevel}`);
    } catch (error) {
      console.error('❌ Failed to set brightness:', error);
    }
  }

  /**
   * Restore brightness to original level
   */
  async restoreBrightness(): Promise<void> {
    try {
      if (this.originalBrightness !== null) {
        await Brightness.setBrightnessAsync(this.originalBrightness);
        console.log(`✅ Brightness restored to ${this.originalBrightness}`);
        this.originalBrightness = null;
        this.isBrightnessManaged = false;
      } else {
        console.log('ℹ️ No original brightness to restore');
      }
    } catch (error) {
      console.error('❌ Failed to restore brightness:', error);
    }
  }

  /**
   * Get current brightness level
   */
  async getCurrentBrightness(): Promise<number> {
    try {
      return await Brightness.getBrightnessAsync();
    } catch (error) {
      console.error('❌ Failed to get current brightness:', error);
      return 0.5; // Default fallback
    }
  }

  /**
   * Check if brightness is currently being managed
   */
  isManagedBrightness(): boolean {
    return this.isBrightnessManaged;
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<BrightnessConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ Brightness service config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): BrightnessConfig {
    return { ...this.config };
  }

  /**
   * Cleanup and restore brightness
   */
  async cleanup(): Promise<void> {
    try {
      await this.restoreBrightness();
      
      if (this.appStateSubscription) {
        this.appStateSubscription.remove?.();
        this.appStateSubscription = null;
      }
      
      console.log('✅ Brightness Service cleaned up');
    } catch (error) {
      console.error('❌ Brightness cleanup failed:', error);
    }
  }
}

export default BrightnessService;

