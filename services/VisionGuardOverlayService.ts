import { NativeModules } from 'react-native';

const { VisionGuardOverlay } = NativeModules;

class VisionGuardOverlayService {
  async startOverlayService(): Promise<boolean> {
    try {
      if (!VisionGuardOverlay) {
        console.warn("VisionGuardOverlay NativeModule not found");
        return false;
      }
      return await VisionGuardOverlay.startOverlayService();
    } catch (error) {
      console.error("Failed to start VisionGuardOverlay:", error);
      throw error;
    }
  }

  async stopOverlayService(): Promise<boolean> {
    try {
      if (!VisionGuardOverlay) {
        return false;
      }
      return await VisionGuardOverlay.stopOverlayService();
    } catch (error) {
      console.error("Failed to stop VisionGuardOverlay:", error);
      throw error;
    }
  }
}

export default new VisionGuardOverlayService();
