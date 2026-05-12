/**
 * Rate Limiting Service for BlinkFit
 * Prevents brute force attacks and API abuse
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface RateLimitEntry {
  attempts: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  blockedUntil?: number;
}

export class RateLimitService {
  private static instance: RateLimitService;
  private storagePrefix = 'rateLimit:';
  
  // Configuration
  private config = {
    // Login attempts
    login: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000, // 30 minutes block
    },
    // Face verification attempts
    faceVerification: {
      maxAttempts: 3,
      windowMs: 10 * 60 * 1000, // 10 minutes
      blockDurationMs: 20 * 60 * 1000, // 20 minutes block
    },
    // Password reset attempts
    passwordReset: {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 2 * 60 * 60 * 1000, // 2 hours block
    },
    // Registration attempts
    registration: {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 60 * 60 * 1000, // 1 hour block
    },
  };

  private constructor() {}

  static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Get storage key for rate limit entry
   */
  private getKey(action: string, identifier: string): string {
    return `${this.storagePrefix}${action}:${identifier}`;
  }

  /**
   * Get rate limit entry from storage
   */
  private async getEntry(action: string, identifier: string): Promise<RateLimitEntry | null> {
    try {
      const key = this.getKey(action, identifier);
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save rate limit entry to storage
   */
  private async saveEntry(action: string, identifier: string, entry: RateLimitEntry): Promise<void> {
    try {
      const key = this.getKey(action, identifier);
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error('Failed to save rate limit entry:', error);
    }
  }

  /**
   * Clear rate limit entry
   */
  private async clearEntry(action: string, identifier: string): Promise<void> {
    try {
      const key = this.getKey(action, identifier);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear rate limit entry:', error);
    }
  }

  /**
   * Check if action is rate limited
   * @param action - Type of action (login, faceVerification, etc.)
   * @param identifier - User identifier (email, user ID, etc.)
   * @returns Object with allowed status and remaining time if blocked
   */
  async checkLimit(
    action: keyof typeof this.config,
    identifier: string
  ): Promise<{
    allowed: boolean;
    remainingAttempts?: number;
    blockedUntil?: number;
    message?: string;
  }> {
    const config = this.config[action];
    const now = Date.now();
    const entry = await this.getEntry(action, identifier);

    // No previous attempts
    if (!entry) {
      return {
        allowed: true,
        remainingAttempts: config.maxAttempts - 1,
      };
    }

    // Check if currently blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const remainingMs = entry.blockedUntil - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      return {
        allowed: false,
        blockedUntil: entry.blockedUntil,
        message: `Too many attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
      };
    }

    // Check if window has expired
    const windowExpired = now - entry.firstAttemptTime > config.windowMs;
    
    if (windowExpired) {
      // Reset counter
      await this.clearEntry(action, identifier);
      return {
        allowed: true,
        remainingAttempts: config.maxAttempts - 1,
      };
    }

    // Check if max attempts exceeded
    if (entry.attempts >= config.maxAttempts) {
      const blockedUntil = now + config.blockDurationMs;
      
      // Update entry with block
      await this.saveEntry(action, identifier, {
        ...entry,
        blockedUntil,
      });

      const blockMinutes = Math.ceil(config.blockDurationMs / 60000);
      
      return {
        allowed: false,
        blockedUntil,
        message: `Maximum attempts exceeded. Blocked for ${blockMinutes} minute${blockMinutes !== 1 ? 's' : ''}.`,
      };
    }

    // Allowed, but increment counter
    const remainingAttempts = config.maxAttempts - entry.attempts - 1;
    
    return {
      allowed: true,
      remainingAttempts,
    };
  }

  /**
   * Record an attempt
   */
  async recordAttempt(action: keyof typeof this.config, identifier: string): Promise<void> {
    const now = Date.now();
    const entry = await this.getEntry(action, identifier);

    if (!entry) {
      // First attempt
      await this.saveEntry(action, identifier, {
        attempts: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
      });
      return;
    }

    // Check if window expired
    const config = this.config[action];
    const windowExpired = now - entry.firstAttemptTime > config.windowMs;

    if (windowExpired) {
      // Reset with new attempt
      await this.saveEntry(action, identifier, {
        attempts: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
      });
    } else {
      // Increment attempts
      await this.saveEntry(action, identifier, {
        ...entry,
        attempts: entry.attempts + 1,
        lastAttemptTime: now,
      });
    }
  }

  /**
   * Reset rate limit for identifier (use after successful action)
   */
  async reset(action: keyof typeof this.config, identifier: string): Promise<void> {
    await this.clearEntry(action, identifier);
  }

  /**
   * Get remaining attempts
   */
  async getRemainingAttempts(
    action: keyof typeof this.config,
    identifier: string
  ): Promise<number> {
    const config = this.config[action];
    const entry = await this.getEntry(action, identifier);

    if (!entry) {
      return config.maxAttempts;
    }

    const now = Date.now();
    const windowExpired = now - entry.firstAttemptTime > config.windowMs;

    if (windowExpired) {
      return config.maxAttempts;
    }

    return Math.max(0, config.maxAttempts - entry.attempts);
  }

  /**
   * Check if identifier is currently blocked
   */
  async isBlocked(action: keyof typeof this.config, identifier: string): Promise<boolean> {
    const entry = await this.getEntry(action, identifier);
    
    if (!entry || !entry.blockedUntil) {
      return false;
    }

    const now = Date.now();
    return entry.blockedUntil > now;
  }

  /**
   * Get time until unblock (in milliseconds)
   */
  async getTimeUntilUnblock(
    action: keyof typeof this.config,
    identifier: string
  ): Promise<number> {
    const entry = await this.getEntry(action, identifier);
    
    if (!entry || !entry.blockedUntil) {
      return 0;
    }

    const now = Date.now();
    return Math.max(0, entry.blockedUntil - now);
  }

  /**
   * Clear all rate limit data (for testing/debugging)
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const rateLimitKeys = keys.filter(key => key.startsWith(this.storagePrefix));
      await AsyncStorage.multiRemove(rateLimitKeys);
    } catch (error) {
      console.error('Failed to clear rate limit data:', error);
    }
  }
}

// Export singleton instance
export default RateLimitService.getInstance();

