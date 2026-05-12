/**
 * Security utilities for input validation, sanitization, and rate limiting
 */

import Logger from './logger';

/**
 * Validate email address using RFC 5322 compliant regex
 */
export const validateEmail = (email: string): boolean => {
    if (!email || typeof email !== 'string') return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
};

/**
 * Comprehensive password validation with detailed error messages
 */
export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
        return { valid: false, errors: ['Password is required'] };
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Unified password strength checker (backward compatible)
 */
export const isStrongPassword = (password: string): boolean => {
    return validatePassword(password).valid;
};

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input: string): string => {
    if (!input || typeof input !== 'string') return '';

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .substring(0, 1000); // Limit length
};

/**
 * Validate phone number (international format)
 */
export const validatePhoneNumber = (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;

    // Allow international format: +1234567890 or local: 1234567890
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
};

/**
 * Validate date of birth and calculate age
 */
export const validateDateOfBirth = (date: string): { valid: boolean; age: number; error?: string } => {
    if (!date || typeof date !== 'string') {
        return { valid: false, age: 0, error: 'Date is required' };
    }

    // Validate YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        return { valid: false, age: 0, error: 'Date must be in YYYY-MM-DD format' };
    }

    const birthDate = new Date(date);
    const today = new Date();

    // Check if date is valid
    if (isNaN(birthDate.getTime())) {
        return { valid: false, age: 0, error: 'Invalid date' };
    }

    // Check if date is not in the future
    if (birthDate > today) {
        return { valid: false, age: 0, error: 'Date cannot be in the future' };
    }

    // Calculate age
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    // Check minimum age (5 years)
    if (age < 5) {
        return { valid: false, age, error: 'User must be at least 5 years old' };
    }

    // Check maximum age (reasonable limit)
    if (age > 120) {
        return { valid: false, age, error: 'Invalid age' };
    }

    return { valid: true, age };
};

/**
 * Validate numeric interval (for blink reminder, screen break, etc.)
 */
export const validateInterval = (value: string, min: number = 1, max: number = 120): { valid: boolean; error?: string } => {
    if (!value || typeof value !== 'string') {
        return { valid: false, error: 'Value is required' };
    }

    const num = parseInt(value, 10);

    if (isNaN(num)) {
        return { valid: false, error: 'Value must be a number' };
    }

    if (num < min) {
        return { valid: false, error: `Value must be at least ${min}` };
    }

    if (num > max) {
        return { valid: false, error: `Value must be at most ${max}` };
    }

    return { valid: true };
};

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
    private attempts: Map<string, { count: number; resetTime: number }> = new Map();
    private maxAttempts: number;
    private windowMs: number;

    constructor(maxAttempts: number = 5, windowMs: number = 60000) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
    }

    /**
     * Check if action is allowed for the given key
     */
    isAllowed(key: string): boolean {
        const now = Date.now();
        const record = this.attempts.get(key);

        if (!record || now > record.resetTime) {
            // Reset or create new record
            this.attempts.set(key, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return true;
        }

        if (record.count >= this.maxAttempts) {
            Logger.warn(`Rate limit exceeded for ${key}`, 'RateLimiter');
            return false;
        }

        // Increment count
        record.count++;
        return true;
    }

    /**
     * Reset attempts for a key
     */
    reset(key: string): void {
        this.attempts.delete(key);
    }

    /**
     * Get remaining attempts
     */
    getRemainingAttempts(key: string): number {
        const record = this.attempts.get(key);
        if (!record || Date.now() > record.resetTime) {
            return this.maxAttempts;
        }
        return Math.max(0, this.maxAttempts - record.count);
    }

    /**
     * Get time until reset (in seconds)
     */
    getTimeUntilReset(key: string): number {
        const record = this.attempts.get(key);
        if (!record) return 0;

        const remaining = Math.max(0, record.resetTime - Date.now());
        return Math.ceil(remaining / 1000);
    }
}

// Export singleton instances for common use cases
export const loginRateLimiter = new RateLimiter(5, 60000); // 5 attempts per minute
export const signupRateLimiter = new RateLimiter(3, 300000); // 3 attempts per 5 minutes
export const profileUpdateRateLimiter = new RateLimiter(10, 60000); // 10 updates per minute

/**
 * Validate name (no special characters, reasonable length)
 */
export const validateName = (name: string): { valid: boolean; error?: string } => {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Name is required' };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters' };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: 'Name must be less than 100 characters' };
    }

    // Allow letters, spaces, hyphens, apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(trimmed)) {
        return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
    }

    return { valid: true };
};

/**
 * Sanitize and validate JSON data structure for face verification
 */
export const validateFaceHashData = (data: any): { valid: boolean; error?: string } => {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid face data structure' };
    }

    // Check required fields
    if (typeof data.width !== 'number' || typeof data.height !== 'number') {
        return { valid: false, error: 'Face data missing required dimensions' };
    }

    // Validate reasonable dimensions
    if (data.width < 100 || data.width > 10000 || data.height < 100 || data.height > 10000) {
        return { valid: false, error: 'Invalid face data dimensions' };
    }

    return { valid: true };
};

/**
 * Create a secure error message that doesn't leak sensitive information
 */
export const createSecureErrorMessage = (error: any, context: string): string => {
    // Log the full error for debugging
    Logger.error(`Error in ${context}`, context, error);

    // Return generic message to user
    const errorCode = error?.code || 'UNKNOWN';

    // Map Firebase auth errors to user-friendly messages
    const errorMessages: Record<string, string> = {
        'auth/user-not-found': 'Invalid email or password',
        'auth/wrong-password': 'Invalid email or password',
        'auth/email-already-in-use': 'This email is already registered',
        'auth/weak-password': 'Password is too weak',
        'auth/invalid-email': 'Invalid email format',
        'auth/too-many-requests': 'Too many attempts. Please try again later',
        'auth/network-request-failed': 'Network error. Please check your connection',
    };

    return errorMessages[errorCode] || 'An error occurred. Please try again';
};
