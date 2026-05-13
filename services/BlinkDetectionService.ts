import { NativeEventEmitter, NativeModules } from 'react-native';

const { BlinkDetectionModule } = NativeModules;


if (!BlinkDetectionModule) {
  console.warn('⚠️ BlinkDetectionModule not available - native module not linked properly');
}

const eventEmitter = BlinkDetectionModule 
  ? new NativeEventEmitter(BlinkDetectionModule)
  : null;

export interface BlinkDetectionResult {
  blinkCount: number;
  averageScreenDistance: number;
  distanceMeasurements: number;
  durationSeconds: number;
}

export interface BlinkDetectionStatus {
  isDetecting: boolean;
  currentBlinkCount: number;
  currentDistanceMeasurements: number;
}

class BlinkDetectionService {
  /**
   * Start blink detection session (30 seconds)
   * Will automatically stop after duration
   */
  async startDetection(): Promise<void> {
    if (!BlinkDetectionModule) {
      throw new Error('BlinkDetectionModule not available');
    }
    
    try {
      await BlinkDetectionModule.startDetection();
      console.log('Blink detection started');
    } catch (error) {
      console.error('Failed to start blink detection:', error);
      throw error;
    }
  }

  /**
   * Stop blink detection session early
   */
  async stopDetection(): Promise<BlinkDetectionResult | null> {
    if (!BlinkDetectionModule) {
      throw new Error('BlinkDetectionModule not available');
    }
    
    try {
      const results = await BlinkDetectionModule.stopDetection();
      console.log('Blink detection stopped early');
      return results as BlinkDetectionResult;
    } catch (error: any) {
      if (error?.message === 'No detection in progress') {
         return null;
      }
      console.error('Failed to stop blink detection:', error);
      throw error;
    }
  }


  /**
   * Get current detection status
   */
  async getDetectionStatus(): Promise<BlinkDetectionStatus> {
    if (!BlinkDetectionModule) {
      throw new Error('BlinkDetectionModule not available');
    }
    
    try {
      const status = await BlinkDetectionModule.getDetectionStatus();
      return status;
    } catch (error) {
      console.error('Failed to get detection status:', error);
      throw error;
    }
  }

  /**
   * Listen for real-time distance warnings (e.g. phone too close)
   * @param callback Function to call when a warning occurs
   * @returns A function to remove the listener
   */
  onDistanceWarning(callback: (distance: number) => void): () => void {
    if (!eventEmitter) return () => {};
    
    const subscription = eventEmitter.addListener('onDistanceWarning', (data: { distance: number }) => {
      callback(data.distance);
    });
    
    return () => subscription.remove();
  }

  /**
   * Listen for real-time blink events (fires on EVERY blink immediately)
   * @param callback Function to call with updated blink count
   * @returns A function to remove the listener
   */
  onBlinkDetected(callback: (blinkCount: number) => void): () => void {
    if (!eventEmitter) return () => {};
    
    const subscription = eventEmitter.addListener('onBlinkDetected', (data: { blinkCount: number }) => {
      callback(data.blinkCount);
    });
    
    return () => subscription.remove();
  }

  /**
   * Run complete detection session and return results
   * Convenience method that starts, waits, and returns results
   */
  async runDetectionSession(): Promise<BlinkDetectionResult> {
    return new Promise((resolve, reject) => {
      if (!eventEmitter) {
        reject(new Error('BlinkDetectionModule not available - please rebuild the app'));
        return;
      }
      
      // Listen for completion event
      const subscription = eventEmitter.addListener('onDetectionComplete', (result: BlinkDetectionResult) => {
        subscription.remove();
        resolve(result);
      });

      // Start detection
      this.startDetection()
        .then(() => {
          console.log('Detection started, waiting for completion...');
        })
        .catch((error) => {
          subscription.remove();
          reject(error);
        });
      
      // Fallback: Auto-resolve after 32 seconds if event not received
      // Don't call stopDetection as it will auto-stop at 30s
      setTimeout(() => {
        if (subscription) {
          console.log('⚠️ Timeout reached, waiting for auto-stop event...');
          // Event should have been received by now, but we wait a bit more
        }
      }, 32000); // 30 seconds + 2 second buffer
    });
  }
}

export default new BlinkDetectionService();
