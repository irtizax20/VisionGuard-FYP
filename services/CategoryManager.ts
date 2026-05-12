
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserCategory = 'under16' | '16-40' | '40+';

export interface CategoryThresholds {
  maxDailyScreenTime: number;        // seconds
  breakInterval: number;             // seconds  
  maxContinuousTime: number;         // seconds
  alertFrequency: 'low' | 'medium' | 'high';
  autoLockEnabled: boolean;
  parentNotifications: boolean;
  strictMode: boolean;
  healthScoreWeights: {
    screenTimeWeight: number;
    breaksWeight: number; 
    strainWeight: number;
  };
  recommendationStyle: 'playful' | 'professional' | 'gentle';
}

export class CategoryManager {
  private static instance: CategoryManager;
  private currentCategory: UserCategory = '16-40';
  
  // Category-specific configurations
  private categoryThresholds: Record<UserCategory, CategoryThresholds> = {
    'under16': {
      maxDailyScreenTime: 2 * 60,             // 2 minutes (for testing)
      breakInterval: 30,                      // 30 seconds (for testing)
      maxContinuousTime: 60,                  // 1 minute (for testing)
      alertFrequency: 'high',
      autoLockEnabled: true,
      parentNotifications: true,
      strictMode: true,
      healthScoreWeights: {
        screenTimeWeight: 0.5,    // Heavy penalty for screen time
        breaksWeight: 0.3,        // Important breaks
        strainWeight: 0.2         // Monitor strain closely
      },
      recommendationStyle: 'playful'
    },
    
    '16-40': {
      maxDailyScreenTime: 5 * 60,             // 5 minutes (for testing)
      breakInterval: 90,                      // 1.5 minutes (for testing)
      maxContinuousTime: 2 * 60,              // 2 minutes (for testing)
      alertFrequency: 'medium',
      autoLockEnabled: false,
      parentNotifications: false,
      strictMode: false,
      healthScoreWeights: {
        screenTimeWeight: 0.3,    // Balanced approach
        breaksWeight: 0.4,        // Focus on breaks
        strainWeight: 0.3         // Monitor strain
      },
      recommendationStyle: 'professional'
    },
    
    '40+': {
      maxDailyScreenTime: 4 * 60,             // 4 minutes (for testing)
      breakInterval: 75,                      // 1.25 minutes (for testing) 
      maxContinuousTime: 90,                  // 1.5 minutes (for testing)
      alertFrequency: 'high',
      autoLockEnabled: false,
      parentNotifications: false,
      strictMode: false,
      healthScoreWeights: {
        screenTimeWeight: 0.2,    // Less focus on total time
        breaksWeight: 0.5,        // Very important breaks
        strainWeight: 0.3         // Monitor strain carefully
      },
      recommendationStyle: 'gentle'
    }
  };

  static getInstance(): CategoryManager {
    if (!CategoryManager.instance) {
      CategoryManager.instance = new CategoryManager();
    }
    return CategoryManager.instance;
  }

  /**
   * Set user category and save to storage
   */
  async setUserCategory(category: UserCategory): Promise<void> {
    this.currentCategory = category;
    await AsyncStorage.setItem('user_category', category);
    console.log(`📊 Category set to: ${category}`);
  }

  /**
   * Load user category from storage
   */
  async loadUserCategory(): Promise<UserCategory> {
    try {
      const stored = await AsyncStorage.getItem('user_category');
      if (stored && ['under16', '16-40', '40+'].includes(stored)) {
        this.currentCategory = stored as UserCategory;
      }
    } catch (error) {
      console.error('Error loading user category:', error);
    }
    return this.currentCategory;
  }

  /**
   * Get current user category
   */
  getCurrentCategory(): UserCategory {
    return this.currentCategory;
  }

  /**
   * Get thresholds for current category
   */
  getCurrentThresholds(): CategoryThresholds {
    return this.categoryThresholds[this.currentCategory];
  }

  /**
   * Get thresholds for specific category
   */
  getThresholds(category: UserCategory): CategoryThresholds {
    return this.categoryThresholds[category];
  }

  /**
   * Check if screen time limit exceeded for current category
   */
  isScreenTimeLimitExceeded(screenTimeSeconds: number): boolean {
    const thresholds = this.getCurrentThresholds();
    return screenTimeSeconds > thresholds.maxDailyScreenTime;
  }

  /**
   * Check if continuous usage limit exceeded
   */
  isContinuousTimeLimitExceeded(continuousSeconds: number): boolean {
    const thresholds = this.getCurrentThresholds();
    return continuousSeconds > thresholds.maxContinuousTime;
  }

  /**
   * Check if break is needed based on category
   */
  isBreakNeeded(timeSinceLastBreak: number): boolean {
    const thresholds = this.getCurrentThresholds();
    return timeSinceLastBreak > thresholds.breakInterval;
  }

  /**
   * Calculate category-specific health score
   */
  calculateHealthScore(metrics: {
    screenTime: number;
    breaks: number; 
    strainEvents: number;
    expectedBreaks: number;
  }): number {
    const thresholds = this.getCurrentThresholds();
    const weights = thresholds.healthScoreWeights;
    
    let score = 100;
    
    // Screen time penalty (category-specific)
    const screenTimeHours = metrics.screenTime / 3600;
    const maxHours = thresholds.maxDailyScreenTime / 3600;
    
    if (screenTimeHours > maxHours) {
      const excessRatio = screenTimeHours / maxHours;
      score -= (excessRatio - 1) * 50 * weights.screenTimeWeight;
    }
    
    // Break score (category-specific)
    const breakRatio = metrics.expectedBreaks > 0 ? metrics.breaks / metrics.expectedBreaks : 1;
    if (breakRatio < 0.8) {
      score -= (1 - breakRatio) * 40 * weights.breaksWeight;
    }
    
    // Strain penalty (category-specific)
    score -= Math.min(30, metrics.strainEvents * 5) * weights.strainWeight;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get category-specific recommendations
   */
  getCategoryRecommendations(healthScore: number, metrics: {
    screenTime: number;
    breaks: number;
    strainEvents: number;
  }): string[] {
    const thresholds = this.getCurrentThresholds();
    const style = thresholds.recommendationStyle;
    const recommendations: string[] = [];
    
    const screenTimeHours = metrics.screenTime / 3600;
    const maxHours = thresholds.maxDailyScreenTime / 3600;
    
    // Screen time recommendations
    if (screenTimeHours > maxHours) {
      switch (style) {
        case 'playful':
          recommendations.push("🎮 You've had enough screen time today! Time for outdoor fun!");
          break;
        case 'professional':
          recommendations.push("⏰ Consider reducing daily screen time to improve productivity");
          break;
        case 'gentle':
          recommendations.push("🌸 Perhaps it's time to take a longer break from screens");
          break;
      }
    }
    
    // Break recommendations
    if (metrics.breaks < 3) {
      switch (style) {
        case 'playful':
          recommendations.push("☀️ Let's take more fun breaks! Your eyes love variety!");
          break;
        case 'professional':
          recommendations.push("📈 Regular breaks can boost your work performance");
          break;
        case 'gentle':
          recommendations.push("☕ Gentle reminder: frequent breaks help your vision");
          break;
      }
    }
    
    // Strain recommendations
    if (metrics.strainEvents > 2) {
      switch (style) {
        case 'playful':
          recommendations.push("👁️ Your eyes are working too hard! Let's give them a rest!");
          break;
        case 'professional':
          recommendations.push("💼 Eye strain detected - consider the 20-20-20 rule");
          break;
        case 'gentle':
          recommendations.push("🌿 Your eyes seem tired - some gentle eye exercises might help");
          break;
      }
    }
    
    // Positive reinforcement for good scores
    if (healthScore >= 80) {
      switch (style) {
        case 'playful':
          recommendations.push("🎉 Amazing work! You're taking great care of your eyes!");
          break;
        case 'professional':
          recommendations.push("✅ Excellent eye health management - keep it up!");
          break;
        case 'gentle':
          recommendations.push("🌟 You're doing wonderfully with your eye care routine");
          break;
      }
    }
    
    return recommendations.slice(0, 3); // Max 3 recommendations
  }

  /**
   * Get category-appropriate alert message
   */
  getCategoryAlertMessage(alertType: 'break' | 'limit' | 'strain'): string {
    const style = this.getCurrentThresholds().recommendationStyle;
    
    const messages = {
      break: {
        playful: "🎈 Break time! Let's look at something far away!",
        professional: "⏱️ Scheduled break: Look away from screen for 20 seconds",
        gentle: "🌺 Time for a gentle break - rest your eyes for a moment"
      },
      limit: {
        playful: "🛑 Oops! You've reached your daily screen limit. Time to play!",
        professional: "📊 Daily screen time limit reached - consider other activities",
        gentle: "🕊️ You've used your recommended screen time for today"
      },
      strain: {
        playful: "😴 Your eyes look sleepy! Let's give them some rest!",
        professional: "⚠️ Eye strain detected - immediate break recommended",
        gentle: "💆 Your eyes seem strained - please take a moment to relax"
      }
    };
    
    return messages[alertType][style];
  }

  /**
   * Should show parent notification for this category
   */
  shouldNotifyParent(): boolean {
    return this.getCurrentThresholds().parentNotifications;
  }

  /**
   * Is auto-lock enabled for this category
   */
  isAutoLockEnabled(): boolean {
    return this.getCurrentThresholds().autoLockEnabled;
  }

  /**
   * Get category display info for UI
   */
  getCategoryDisplayInfo(): {
    name: string;
    color: string;
    icon: string;
    description: string;
  } {
    const categoryInfo = {
      'under16': {
        name: 'Child',
        color: '#FF6B6B',
        icon: 'happy-outline',
        description: 'Protected mode with parental oversight'
      },
      '16-40': {
        name: 'Adult', 
        color: '#4ECDC4',
        icon: 'person-outline',
        description: 'Balanced monitoring for productivity'
      },
      '40+': {
        name: 'Senior',
        color: '#45B7D1', 
        icon: 'leaf-outline',
        description: 'Gentle care with accessibility features'
      }
    };
    
    return categoryInfo[this.currentCategory];
  }

  /**
   * Clear user category from storage (called on logout)
   */
  async clearAllData(): Promise<void> {
    try {
      console.log('🗑️ Clearing user category data...');
      await AsyncStorage.removeItem('user_category');
      // Reset to default category instead of null
      this.currentCategory = '16-40';
      console.log('✅ User category data cleared');
    } catch (error) {
      console.error('❌ Error clearing user category:', error);
      throw error;
    }
  }
}

export default CategoryManager.getInstance();
