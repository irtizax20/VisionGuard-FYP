import { NativeModules } from 'react-native';

const { UsageStatsModule } = NativeModules;

class NativeUsageStatsService {
  /**
   * Check if the app has usage access permission
   * @returns {Promise<boolean>} True if permission is granted
   */
  async hasUsagePermission() {
    try {
      if (!UsageStatsModule) {
        console.warn('UsageStatsModule is not available');
        return false;
      }
      return await UsageStatsModule.hasUsagePermission();
    } catch (error) {
      console.error('Error checking usage permission:', error);
      return false;
    }
  }

  /**
   * Request usage access permission by opening the settings page
   * @returns {Promise<boolean>} True if settings page was opened successfully
   */
  async requestUsagePermission() {
    try {
      if (!UsageStatsModule) {
        console.warn('UsageStatsModule is not available');
        return false;
      }
      return await UsageStatsModule.requestUsagePermission();
    } catch (error) {
      console.error('Error requesting usage permission:', error);
      return false;
    }
  }

  /**
   * Get usage statistics for a specific time range
   * @param {number} startTime - Start timestamp in milliseconds
   * @param {number} endTime - End timestamp in milliseconds
   * @returns {Promise<Array>} Array of usage stats objects
   */
  async getUsageStats(startTime, endTime) {
    try {
      if (!UsageStatsModule) {
        console.warn('UsageStatsModule is not available');
        return [];
      }
      return await UsageStatsModule.getUsageStats(startTime, endTime);
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return [];
    }
  }

  /**
   * Get today's usage statistics
   * @returns {Promise<Array>} Array of today's usage stats objects
   */
  async getTodayUsageStats() {
    try {
      if (!UsageStatsModule) {
        console.warn('UsageStatsModule is not available');
        return [];
      }
      return await UsageStatsModule.getTodayUsageStats();
    } catch (error) {
      console.error('Error getting today usage stats:', error);
      return [];
    }
  }

  /**
   * Format usage time from milliseconds to a readable format
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string} Formatted time string
   */
  formatUsageTime(milliseconds) {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Get sorted usage stats by time spent
   * @param {Array} usageStats - Array of usage stats objects
   * @returns {Array} Sorted array of usage stats
   */
  getSortedUsageStats(usageStats) {
    return usageStats.sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground);
  }

  /**
   * Filter out system apps and get top user apps
   * @param {Array} usageStats - Array of usage stats objects
   * @param {number} limit - Maximum number of apps to return
   * @returns {Array} Filtered and limited usage stats
   */
  getTopUserApps(usageStats, limit = 10) {
    const systemApps = [
      'com.android.systemui',
      'android',
      'com.android.launcher',
      'com.android.settings',
      'com.google.android.gms',
      'com.android.phone',
      'com.android.dialer'
    ];
    
    return usageStats
      .filter(app => !systemApps.some(sysApp => app.packageName.includes(sysApp)))
      .sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground)
      .slice(0, limit);
  }
}

export default new NativeUsageStatsService();
