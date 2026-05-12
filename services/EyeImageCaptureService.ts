import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { NativeModules } from 'react-native';

const { BlinkDetectionModule } = NativeModules;

export interface EyeImageData {
  leftEyeUri: string;
  rightEyeUri: string;
  timestamp: number;
}

export interface EyeImageMetadata {
  leftPath: string;
  rightPath: string;
  timestamp: number;
  userId: string | null;
  analyzed: boolean;
  analysisResult: {
    redness?: number;
    fatigue?: number;
    dryness?: number;
  } | null;
  syncedToFirestore: boolean;
  tags?: string[];
}

/**
 * Service to capture and extract eye images during face detection
 * Eye images are saved before blink detection analysis
 * Metadata is stored in AsyncStorage for offline access
 */
class EyeImageCaptureService {
  private eyeImagesDirectory = `${FileSystem.documentDirectory}eye-images/`;
  private metadataKey = 'eyeImageMetadata';

  /**
   * Ensure the eye images directory exists
   */
  async ensureDirectoryExists(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.eyeImagesDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.eyeImagesDirectory, { intermediates: true });
      console.log('✅ Eye images directory created:', this.eyeImagesDirectory);
    }
  }

  /**
   * Get all metadata from AsyncStorage
   */
  private async getMetadata(): Promise<Record<string, EyeImageMetadata>> {
    try {
      const data = await AsyncStorage.getItem(this.metadataKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return {};
    }
  }

  /**
   * Save metadata to AsyncStorage
   */
  private async saveMetadata(metadata: Record<string, EyeImageMetadata>): Promise<void> {
    try {
      await AsyncStorage.setItem(this.metadataKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }

  /**
   * Add or update metadata for an image
   */
  async addImageMetadata(
    timestamp: number,
    leftPath: string,
    rightPath: string,
    userId: string | null
  ): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      metadata[timestamp.toString()] = {
        leftPath,
        rightPath,
        timestamp,
        userId,
        analyzed: false,
        analysisResult: null,
        syncedToFirestore: false,
        tags: [],
      };
      await this.saveMetadata(metadata);
      console.log(`✅ Metadata saved for image: ${timestamp}`);
    } catch (error) {
      console.error('Failed to add image metadata:', error);
    }
  }

  /**
   * Mark image as analyzed with results
   */
  async markAsAnalyzed(
    timestamp: number,
    results: { redness?: number; fatigue?: number; dryness?: number }
  ): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      const key = timestamp.toString();
      if (metadata[key]) {
        metadata[key].analyzed = true;
        metadata[key].analysisResult = results;
        await this.saveMetadata(metadata);
        console.log(`✅ Image ${timestamp} marked as analyzed`);
      }
    } catch (error) {
      console.error('Failed to mark as analyzed:', error);
    }
  }

  /**
   * Get all images pending analysis
   */
  async getPendingAnalysis(): Promise<EyeImageData[]> {
    try {
      const metadata = await this.getMetadata();
      const pending: EyeImageData[] = [];
      
      for (const [timestamp, data] of Object.entries(metadata)) {
        if (!data.analyzed) {
          pending.push({
            leftEyeUri: data.leftPath,
            rightEyeUri: data.rightPath,
            timestamp: data.timestamp,
          });
        }
      }
      
      return pending.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Failed to get pending analysis:', error);
      return [];
    }
  }

  /**
   * Clear all metadata and files (called on logout)
   */
  async clearAllData(): Promise<void> {
    try {
      console.log('🗑️ Clearing all eye image data...');
      
      // Clear metadata from AsyncStorage
      await AsyncStorage.removeItem(this.metadataKey);
      console.log('✅ Eye image metadata cleared from AsyncStorage');
      
      // Delete all image files
      const dirInfo = await FileSystem.getInfoAsync(this.eyeImagesDirectory);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.eyeImagesDirectory, { idempotent: true });
        await this.ensureDirectoryExists();
        console.log('✅ All eye image files deleted');
      }
      
      console.log('✅ All eye image data cleared');
    } catch (error) {
      console.error('❌ Failed to clear eye image data:', error);
      throw error;
    }
  }

  /**
   * Enable eye image capture during detection
   * This must be called before starting blink detection
   */
  async enableEyeCapture(): Promise<void> {
    if (!BlinkDetectionModule) {
      throw new Error('BlinkDetectionModule not available');
    }

    try {
      await this.ensureDirectoryExists();
      await BlinkDetectionModule.enableEyeImageCapture(this.eyeImagesDirectory);
      console.log('✅ Eye image capture enabled');
    } catch (error) {
      console.error('Failed to enable eye capture:', error);
      throw error;
    }
  }

  /**
   * Disable eye image capture
   */
  async disableEyeCapture(): Promise<void> {
    if (!BlinkDetectionModule) {
      throw new Error('BlinkDetectionModule not available');
    }

    try {
      await BlinkDetectionModule.disableEyeImageCapture();
      console.log('✅ Eye image capture disabled');
    } catch (error) {
      console.error('Failed to disable eye capture:', error);
      throw error;
    }
  }

  /**
   * Get the most recently captured eye images
   */
  async getLatestEyeImages(): Promise<EyeImageData | null> {
    try {
      console.log('🔍 Looking for eye images in:', this.eyeImagesDirectory);
      await this.ensureDirectoryExists();
      
      // Add small delay to ensure file system sync (native -> JS bridge)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const files = await FileSystem.readDirectoryAsync(this.eyeImagesDirectory);
      console.log(`📂 Found ${files.length} files in eye images directory:`, files);
      
      if (files.length === 0) {
        console.warn('⚠️ No eye images found in directory');
        return null;
      }

      // Sort by timestamp (files are named with timestamps)
      const sortedFiles = files.sort().reverse();
      console.log('📋 Sorted files:', sortedFiles.slice(0, 4)); // Show first 4
      
      // Find the latest pair of eye images
      let leftEyeUri = '';
      let rightEyeUri = '';
      
      for (const file of sortedFiles) {
        if (file.includes('left_eye') && !leftEyeUri) {
          leftEyeUri = `${this.eyeImagesDirectory}${file}`;
        }
        if (file.includes('right_eye') && !rightEyeUri) {
          rightEyeUri = `${this.eyeImagesDirectory}${file}`;
        }
        
        if (leftEyeUri && rightEyeUri) {
          break;
        }
      }

      if (!leftEyeUri || !rightEyeUri) {
        console.warn('⚠️ Could not find matching left/right eye pair');
        console.warn('Left eye found:', !!leftEyeUri, 'Right eye found:', !!rightEyeUri);
        return null;
      }

      // Extract timestamp from filename
      const timestampMatch = leftEyeUri.match(/(\d+)_left_eye/);
      const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : Date.now();

      console.log('✅ Eye images found:', { leftEyeUri, rightEyeUri, timestamp });

      // Save metadata to AsyncStorage for offline access
      try {
        const { auth } = await import('../firebase/firebaseConfig');
        const userId = auth.currentUser?.uid || null;
        await this.addImageMetadata(timestamp, leftEyeUri, rightEyeUri, userId);
      } catch (metadataError) {
        console.warn('⚠️ Failed to save metadata:', metadataError);
        // Continue even if metadata save fails
      }

      return {
        leftEyeUri,
        rightEyeUri,
        timestamp,
      };
    } catch (error) {
      console.error('❌ Failed to get eye images:', error);
      return null;
    }
  }

  /**
   * Delete all captured eye images
   */
  async clearAllEyeImages(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.eyeImagesDirectory);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.eyeImagesDirectory, { idempotent: true });
        await this.ensureDirectoryExists();
        console.log('✅ All eye images cleared');
      }
    } catch (error) {
      console.error('Failed to clear eye images:', error);
      throw error;
    }
  }

  /**
   * Delete old eye images (older than specified days)
   */
  async cleanupOldImages(daysToKeep: number = 7): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      const files = await FileSystem.readDirectoryAsync(this.eyeImagesDirectory);
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const timestampMatch = file.match(/(\d+)_/);
        if (timestampMatch) {
          const fileTimestamp = parseInt(timestampMatch[1]);
          if (fileTimestamp < cutoffTime) {
            await FileSystem.deleteAsync(`${this.eyeImagesDirectory}${file}`, { idempotent: true });
            console.log(`🗑️ Deleted old eye image: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old images:', error);
    }
  }

  /**
   * Get total count of stored eye image pairs
   */
  async getStoredImageCount(): Promise<number> {
    try {
      await this.ensureDirectoryExists();
      const files = await FileSystem.readDirectoryAsync(this.eyeImagesDirectory);
      // Each capture creates 2 files (left + right), so divide by 2
      return Math.floor(files.length / 2);
    } catch (error) {
      console.error('Failed to get image count:', error);
      return 0;
    }
  }

  /**
   * Get the directory path where images are stored
   * Useful for debugging or file access
   */
  getStorageDirectory(): string {
    return this.eyeImagesDirectory;
  }

  /**
   * List all captured eye image files
   */
  async listAllImages(): Promise<string[]> {
    try {
      await this.ensureDirectoryExists();
      const files = await FileSystem.readDirectoryAsync(this.eyeImagesDirectory);
      console.log(`📁 Found ${files.length} files in: ${this.eyeImagesDirectory}`);
      files.forEach(file => console.log(`  - ${file}`));
      return files;
    } catch (error) {
      console.error('Failed to list images:', error);
      return [];
    }
  }

  /**
   * Request media library permissions
   */
  async requestGalleryPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Gallery permission denied');
        return false;
      }
      console.log('✅ Gallery permission granted');
      return true;
    } catch (error) {
      console.error('Failed to request gallery permissions:', error);
      return false;
    }
  }

  /**
   * Save captured eye images to phone gallery
   * Creates an album called "Vision Guard Eye Images"
   * @param eyeImages - Images to save (if null, uses latest)
   * @param autoSave - If true, don't show warnings for missing images
   */
  async saveToGallery(eyeImages: EyeImageData | null = null, autoSave: boolean = false): Promise<{success: boolean, albumName?: string}> {
    try {
      // Request permission first
      const hasPermission = await this.requestGalleryPermissions();
      if (!hasPermission) {
        if (!autoSave) console.warn('⚠️ Cannot save to gallery without permission');
        return {success: false};
      }

      // Get images to save (use provided or fetch latest)
      const imagesToSave = eyeImages || await this.getLatestEyeImages();
      if (!imagesToSave) {
        if (!autoSave) console.warn('⚠️ No eye images to save to gallery');
        return {success: false};
      }

      console.log('💾 Saving eye images to gallery...');

      // Save left eye image
      const leftAsset = await MediaLibrary.createAssetAsync(imagesToSave.leftEyeUri);
      console.log('✅ Left eye image saved to gallery');

      // Save right eye image
      const rightAsset = await MediaLibrary.createAssetAsync(imagesToSave.rightEyeUri);
      console.log('✅ Right eye image saved to gallery');

      // Create or get album
      const albumName = 'Vision Guard Eye Images';
      let album = await MediaLibrary.getAlbumAsync(albumName);
      if (!album) {
        album = await MediaLibrary.createAlbumAsync(albumName, leftAsset, false);
        console.log(`📁 Created album: ${albumName}`);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([leftAsset, rightAsset], album, false);
      }

      console.log(`✅ Eye images saved to gallery album: ${albumName}`);
      return {success: true, albumName};
    } catch (error) {
      console.error('❌ Failed to save images to gallery:', error);
      return {success: false};
    }
  }
  /**
   * Get all captured eye image pairs with metadata
   * Returns array sorted by timestamp (newest first)
   */
  async getAllEyeImages(): Promise<Array<EyeImageData>> {
    try {
      await this.ensureDirectoryExists();
      const files = await FileSystem.readDirectoryAsync(this.eyeImagesDirectory);
      
      if (files.length === 0) {
        return [];
      }

      // Group files by timestamp
      const imageGroups = new Map<number, { left?: string; right?: string }>();
      
      for (const file of files) {
        const timestampMatch = file.match(/(\d+)_(left|right)_eye/);
        if (timestampMatch) {
          const timestamp = parseInt(timestampMatch[1]);
          const side = timestampMatch[2];
          
          if (!imageGroups.has(timestamp)) {
            imageGroups.set(timestamp, {});
          }
          
          const group = imageGroups.get(timestamp)!;
          if (side === 'left') {
            group.left = `${this.eyeImagesDirectory}${file}`;
          } else {
            group.right = `${this.eyeImagesDirectory}${file}`;
          }
        }
      }

      // Convert to array and filter complete pairs
      const eyeImages: EyeImageData[] = [];
      for (const [timestamp, group] of imageGroups.entries()) {
        if (group.left && group.right) {
          eyeImages.push({
            leftEyeUri: group.left,
            rightEyeUri: group.right,
            timestamp,
          });
        }
      }

      // Sort by timestamp (newest first)
      eyeImages.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`📁 Found ${eyeImages.length} complete eye image pairs`);
      return eyeImages;
    } catch (error) {
      console.error('Failed to get all eye images:', error);
      return [];
    }
  }
}

export default new EyeImageCaptureService();
