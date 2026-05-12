import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import CategoryManager from './CategoryManager';

export interface DailyEyeHealthMetrics {
  date: string;
  screenTime: number; // in seconds
  estimatedBlinks: number;
  breaksTaken: number;
  eyeStrainEvents: number;
  averageScreenDistance: number; // in cm
  healthScore: number; // 0-100
  recommendations: string[];
}

export interface EyeHealthEvent {
  type: 'blink' | 'break' | 'strain' | 'distance_warning';
  timestamp: number;
  value?: number;
}

class DailySummaryService {
  private static instance: DailySummaryService;
  private notificationId: string | null = null;

  static getInstance(): DailySummaryService {
    if (!DailySummaryService.instance) {
      DailySummaryService.instance = new DailySummaryService();
    }
    return DailySummaryService.instance;
  }

  async setupNotifications() {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return false;
    }
    
    // Initialize notification handler
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  }

  // Schedule daily notification
  async scheduleDailyNotification() {
    try {
      // Cancel existing notification first
      if (this.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(this.notificationId);
        this.notificationId = null;
      }
      
      // Also cancel any previously saved notification
      const savedId = await AsyncStorage.getItem('daily_notification_id');
      if (savedId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(savedId);
        } catch (e) {
          // Ignore if notification doesn't exist
        }
      }

      // Schedule new daily notification at 8 PM
      this.notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "📊 Your Daily Eye Health Summary",
          body: "See how your eyes did today and get personalized tips!",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: 'daily_summary_scheduled',
            timestamp: Date.now()
          }
        },
        trigger: {
          hour: 20, // 8 PM
          minute: 0,
          repeats: true,
          channelId: Platform.OS === 'android' ? 'daily-summary' : undefined,
        } as any,
      });

      await AsyncStorage.setItem('daily_notification_id', this.notificationId);
      console.log(`✅ Daily notification scheduled (ID: ${this.notificationId})`);
      return true;
    } catch (error) {
      console.error('Error scheduling daily notification:', error);
      return false;
    }
  }

  // Log eye health events throughout the day
  async logEyeHealthEvent(event: EyeHealthEvent) {
    try {
      const today = new Date().toDateString();
      const key = `eye_events_${today}`;
      
      const existingEvents = await AsyncStorage.getItem(key);
      const events: EyeHealthEvent[] = existingEvents ? JSON.parse(existingEvents) : [];
      
      events.push(event);
      await AsyncStorage.setItem(key, JSON.stringify(events));
    } catch (error) {
      console.error('Error logging eye health event:', error);
    }
  }

  // Calculate daily metrics
  async calculateDailyMetrics(date?: string): Promise<DailyEyeHealthMetrics> {
    const targetDate = date || new Date().toDateString();
    
    try {
      // Get screen time
      const screenTimeKey = `screenTime_${targetDate}`;
      const screenTimeData = await AsyncStorage.getItem(screenTimeKey);
      const screenTime = screenTimeData ? parseInt(screenTimeData) : 0;

      // Get eye health events
      const eventsKey = `eye_events_${targetDate}`;
      const eventsData = await AsyncStorage.getItem(eventsKey);
      const events: EyeHealthEvent[] = eventsData ? JSON.parse(eventsData) : [];

      // Calculate metrics from events
      const blinks = events.filter(e => e.type === 'blink').length;
      const breaks = events.filter(e => e.type === 'break').length;
      const strainEvents = events.filter(e => e.type === 'strain').length;
      const distanceWarnings = events.filter(e => e.type === 'distance_warning').length;

      // Estimate blinks based on screen time (normal rate: 15-20 blinks/min)
      const estimatedBlinks = blinks > 0 ? blinks : Math.floor((screenTime / 60) * 17);

      // Calculate average screen distance (simulated for now)
      const averageScreenDistance = 45; // Default 45cm

      // Calculate health score
      const healthScore = this.calculateHealthScore({
        screenTime,
        breaks,
        strainEvents,
        distanceWarnings,
        estimatedBlinks,
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        screenTime,
        breaks,
        strainEvents,
        healthScore,
      });

      const metrics: DailyEyeHealthMetrics = {
        date: targetDate,
        screenTime,
        estimatedBlinks,
        breaksTaken: breaks,
        eyeStrainEvents: strainEvents,
        averageScreenDistance,
        healthScore,
        recommendations,
      };

      // Store the daily metrics
      await AsyncStorage.setItem(`daily_metrics_${targetDate}`, JSON.stringify(metrics));
      
      return metrics;
    } catch (error) {
      console.error('Error calculating daily metrics:', error);
      // Return default metrics on error
      return {
        date: targetDate,
        screenTime: 0,
        estimatedBlinks: 0,
        breaksTaken: 0,
        eyeStrainEvents: 0,
        averageScreenDistance: 45,
        healthScore: 50,
        recommendations: ['Take regular breaks from screen time'],
      };
    }
  }

  // Calculate health score (0-100) with category-specific logic
  private calculateHealthScore(data: {
    screenTime: number;
    breaks: number;
    strainEvents: number;
    distanceWarnings: number;
    estimatedBlinks: number;
  }): number {
    // Use CategoryManager for intelligent scoring
    const screenTimeHours = data.screenTime / 3600;
    const expectedBreaks = Math.max(1, Math.floor(screenTimeHours));
    
    return CategoryManager.calculateHealthScore({
      screenTime: data.screenTime,
      breaks: data.breaks,
      strainEvents: data.strainEvents,
      expectedBreaks
    });
  }

  // Generate category-specific personalized recommendations
  private generateRecommendations(data: {
    screenTime: number;
    breaks: number;
    strainEvents: number;
    healthScore: number;
  }): string[] {
    // Use CategoryManager for intelligent, age-appropriate recommendations
    return CategoryManager.getCategoryRecommendations(data.healthScore, {
      screenTime: data.screenTime,
      breaks: data.breaks,
      strainEvents: data.strainEvents
    });
  }

  // Get weekly summary
  async getWeeklySummary(): Promise<DailyEyeHealthMetrics[]> {
    const weeklyData: DailyEyeHealthMetrics[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toDateString();
      
      try {
        const metricsData = await AsyncStorage.getItem(`daily_metrics_${dateString}`);
        if (metricsData) {
          weeklyData.push(JSON.parse(metricsData));
        } else {
          // Calculate metrics if not stored
          const metrics = await this.calculateDailyMetrics(dateString);
          weeklyData.push(metrics);
        }
      } catch (error) {
        console.error('Error getting weekly summary:', error);
      }
    }

    return weeklyData;
  }

  // Show daily summary notification
  async showDailySummaryNotification() {
    try {
      // Check if we already showed a summary today (deduplication)
      const today = new Date().toDateString();
      const lastSummaryKey = 'last_daily_summary_date';
      const lastSummaryDate = await AsyncStorage.getItem(lastSummaryKey);
      
      if (lastSummaryDate === today) {
        console.log('⏭️ Daily summary already shown today, skipping duplicate');
        return;
      }
      
      const todayMetrics = await this.calculateDailyMetrics();
      const hours = Math.floor(todayMetrics.screenTime / 3600);
      const minutes = Math.floor((todayMetrics.screenTime % 3600) / 60);
      
      let timeText = '';
      if (hours > 0) {
        timeText = `${hours}h ${minutes}m`;
      } else {
        timeText = `${minutes}m`;
      }

      const healthEmoji = todayMetrics.healthScore >= 80 ? '🟢' : 
                         todayMetrics.healthScore >= 60 ? '🟡' : '🔴';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📊 Today's Eye Health Summary`,
          body: `${healthEmoji} Score: ${todayMetrics.healthScore}/100 | Screen time: ${timeText} | ${todayMetrics.breaksTaken} breaks taken`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { 
            metrics: todayMetrics,
            type: 'daily_summary',
            timestamp: Date.now()
          },
        },
        trigger: null, // Show immediately
      });
      
      // Mark that we showed summary today
      await AsyncStorage.setItem(lastSummaryKey, today);
      console.log('✅ Daily summary notification shown and marked');

    } catch (error) {
      console.error('Error showing daily summary notification:', error);
    }
  }

  // Initialize the service with category loading
  async initialize() {
    // Load user category for personalized monitoring
    await CategoryManager.loadUserCategory();
    console.log(`📊 Initialized with category: ${CategoryManager.getCurrentCategory()}`);
    
    const isSetup = await this.setupNotifications();
    if (isSetup) {
      await this.scheduleDailyNotification();
      return true;
    }
    return false;
  }

  /**
   * Clear all daily summary data from storage (called on logout)
   */
  async clearAllData(): Promise<void> {
    try {
      console.log('🗑️ Clearing daily summary data...');
      
      // Clear notification ID
      await AsyncStorage.removeItem('daily_notification_id');
      
      // Clear all daily metrics (daily_metrics_*)
      const allKeys = await AsyncStorage.getAllKeys();
      const metricsKeys = allKeys.filter(key => key.startsWith('daily_metrics_'));
      if (metricsKeys.length > 0) {
        await AsyncStorage.multiRemove(metricsKeys);
        console.log(`🗑️ Removed ${metricsKeys.length} daily metrics entries`);
      }
      
      // Clear daily events (daily_events_*)
      const eventsKeys = allKeys.filter(key => key.startsWith('daily_events_'));
      if (eventsKeys.length > 0) {
        await AsyncStorage.multiRemove(eventsKeys);
        console.log(`🗑️ Removed ${eventsKeys.length} daily events entries`);
      }
      
      // Clear last summary keys (last_daily_summary_*)
      const summaryKeys = allKeys.filter(key => key.startsWith('last_daily_summary_'));
      if (summaryKeys.length > 0) {
        await AsyncStorage.multiRemove(summaryKeys);
        console.log(`🗑️ Removed ${summaryKeys.length} last summary entries`);
      }
      
      console.log('✅ Daily summary data cleared');
    } catch (error) {
      console.error('❌ Error clearing daily summary data:', error);
      throw error;
    }
  }
}

export default DailySummaryService.getInstance();
