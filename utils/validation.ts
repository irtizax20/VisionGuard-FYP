/**
 * Input Validation & Sanitization Utility for Vision Guard
 * Protects against injection attacks and ensures data integrity
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate email address
 */
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
    return { valid: false, errors };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
  
  if (!emailRegex.test(trimmed)) {
    errors.push('Invalid email format');
  }
  
  // Check for dangerous characters (XSS prevention)
  if (/<|>|script|javascript|onerror|onload/i.test(trimmed)) {
    errors.push('Email contains invalid characters');
  }
  
  // Length check
  if (trimmed.length > 254) {
    errors.push('Email is too long (max 254 characters)');
  }
  
  // Domain check
  const parts = trimmed.split('@');
  if (parts.length === 2) {
    const domain = parts[1];
    if (domain.length < 3 || domain.length > 253) {
      errors.push('Invalid domain length');
    }
    if (!domain.includes('.')) {
      errors.push('Invalid domain format');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!password || password.length === 0) {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  // Maximum length (prevent DoS)
  if (password.length > 128) {
    errors.push('Password is too long (max 128 characters)');
  }
  
  // Lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Digit
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for repeated characters (aaa, 111, etc.)
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }
  
  // Check for sequential characters (abc, 123)
  const hasSequential = (str: string): boolean => {
    for (let i = 0; i < str.length - 2; i++) {
      const char1 = str.charCodeAt(i);
      const char2 = str.charCodeAt(i + 1);
      const char3 = str.charCodeAt(i + 2);
      
      if (char2 === char1 + 1 && char3 === char2 + 1) {
        return true;
      }
    }
    return false;
  };
  
  if (hasSequential(password.toLowerCase())) {
    errors.push('Password contains sequential characters');
  }
  
  // Check for common passwords
  const commonPasswords = [
    'password', 'password123', '12345678', 'qwerty', 'abc123',
    'monkey', 'letmein', 'trustno1', 'dragon', 'baseball',
    'iloveyou', 'master', 'sunshine', 'ashley', 'bailey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate name (first name, last name, etc.)
 */
export const validateName = (name: string, fieldName: string = 'Name'): ValidationResult => {
  const errors: string[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push(`${fieldName} is required`);
    return { valid: false, errors };
  }
  
  const trimmed = name.trim();
  
  // Length check
  if (trimmed.length < 2) {
    errors.push(`${fieldName} must be at least 2 characters long`);
  }
  
  if (trimmed.length > 50) {
    errors.push(`${fieldName} is too long (max 50 characters)`);
  }
  
  // Only allow letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
    errors.push(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);
  }
  
  // Check for dangerous patterns
  if (/<|>|script|javascript/i.test(trimmed)) {
    errors.push(`${fieldName} contains invalid characters`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate age
 */
export const validateAge = (age: number | string): ValidationResult => {
  const errors: string[] = [];
  
  const ageNum = typeof age === 'string' ? parseInt(age, 10) : age;
  
  if (isNaN(ageNum)) {
    errors.push('Age must be a valid number');
    return { valid: false, errors };
  }
  
  if (ageNum < 1) {
    errors.push('Age must be at least 1');
  }
  
  if (ageNum > 150) {
    errors.push('Age must be less than 150');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize string input (remove dangerous characters)
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Escape HTML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Sanitize email (lowercase and trim)
 */
export const sanitizeEmail = (email: string): string => {
  if (!email) return '';
  return email.trim().toLowerCase();
};

/**
 * Validate and sanitize form data
 */
export interface FormData {
  [key: string]: any;
}

export const validateAndSanitizeForm = (
  data: FormData,
  rules: { [key: string]: 'email' | 'password' | 'name' | 'age' | 'text' }
): { valid: boolean; sanitized: FormData; errors: { [key: string]: string[] } } => {
  const sanitized: FormData = {};
  const errors: { [key: string]: string[] } = {};
  let valid = true;
  
  for (const [key, rule] of Object.entries(rules)) {
    const value = data[key];
    
    switch (rule) {
      case 'email':
        const emailValidation = validateEmail(value);
        if (!emailValidation.valid) {
          errors[key] = emailValidation.errors;
          valid = false;
        }
        sanitized[key] = sanitizeEmail(value);
        break;
        
      case 'password':
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.valid) {
          errors[key] = passwordValidation.errors;
          valid = false;
        }
        sanitized[key] = value; // Don't sanitize password
        break;
        
      case 'name':
        const nameValidation = validateName(value, key);
        if (!nameValidation.valid) {
          errors[key] = nameValidation.errors;
          valid = false;
        }
        sanitized[key] = sanitizeInput(value);
        break;
        
      case 'age':
        const ageValidation = validateAge(value);
        if (!ageValidation.valid) {
          errors[key] = ageValidation.errors;
          valid = false;
        }
        sanitized[key] = typeof value === 'string' ? parseInt(value, 10) : value;
        break;
        
      case 'text':
        sanitized[key] = sanitizeInput(value);
        break;
        
      default:
        sanitized[key] = value;
    }
  }
  
  return { valid, sanitized, errors };
};

/**
 * Check password strength (returns score 0-100)
 */
export const checkPasswordStrength = (password: string): {
  score: number;
  level: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  feedback: string[];
} => {
  let score = 0;
  const feedback: string[] = [];
  
  if (!password) {
    return { score: 0, level: 'Very Weak', feedback: ['Password is empty'] };
  }
  
  // Length
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  
  // Multiple character types
  const types = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password)
  ].filter(Boolean).length;
  
  if (types >= 3) score += 10;
  if (types === 4) score += 5;
  
  // Penalties
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('Avoid repeated characters');
  }
  
  if (password.length < 8) {
    feedback.push('Use at least 8 characters');
  }
  if (!/[a-z]/.test(password)) {
    feedback.push('Add lowercase letters');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add uppercase letters');
  }
  if (!/\d/.test(password)) {
    feedback.push('Add numbers');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Add special characters');
  }
  
  score = Math.max(0, Math.min(100, score));
  
  let level: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  if (score < 30) level = 'Very Weak';
  else if (score < 50) level = 'Weak';
  else if (score < 70) level = 'Fair';
  else if (score < 90) level = 'Good';
  else level = 'Strong';
  
  return { score, level, feedback };
};

