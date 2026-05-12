import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Safe wrapper for AsyncStorage operations with comprehensive error handling
 */
export const SafeAsyncStorage = {
    /**
     * Safely get item from AsyncStorage
     * @param key Storage key
     * @param defaultValue Default value if operation fails
     * @returns Stored value or default value
     */
    async getItem(key: string, defaultValue: string | null = null): Promise<string | null> {
        try {
            const value = await AsyncStorage.getItem(key);
            return value;
        } catch (error) {
            console.error(`[SafeAsyncStorage] Failed to get item "${key}":`, error);
            return defaultValue;
        }
    },

    /**
     * Safely set item in AsyncStorage
     * @param key Storage key
     * @param value Value to store
     * @returns Success status
     */
    async setItem(key: string, value: string): Promise<boolean> {
        try {
            await AsyncStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error(`[SafeAsyncStorage] Failed to set item "${key}":`, error);
            return false;
        }
    },

    /**
     * Safely remove item from AsyncStorage
     * @param key Storage key
     * @returns Success status
     */
    async removeItem(key: string): Promise<boolean> {
        try {
            await AsyncStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`[SafeAsyncStorage] Failed to remove item "${key}":`, error);
            return false;
        }
    },

    /**
     * Safely get multiple items from AsyncStorage
     * @param keys Array of storage keys
     * @returns Array of [key, value] pairs
     */
    async multiGet(keys: string[]): Promise<readonly [string, string | null][]> {
        try {
            return await AsyncStorage.multiGet(keys);
        } catch (error) {
            console.error(`[SafeAsyncStorage] Failed to get multiple items:`, error);
            return keys.map(key => [key, null] as [string, string | null]);
        }
    },

    /**
     * Safely remove multiple items from AsyncStorage
     * @param keys Array of storage keys
     * @returns Success status
     */
    async multiRemove(keys: string[]): Promise<boolean> {
        try {
            await AsyncStorage.multiRemove(keys);
            return true;
        } catch (error) {
            console.error(`[SafeAsyncStorage] Failed to remove multiple items:`, error);
            return false;
        }
    },

    /**
     * Safely get all keys from AsyncStorage
     * @returns Array of all keys
     */
    async getAllKeys(): Promise<readonly string[]> {
        try {
            return await AsyncStorage.getAllKeys();
        } catch (error) {
            console.error(`[SafeAsyncStorage] Failed to get all keys:`, error);
            return [];
        }
    },
};

/**
 * Safely parse integer with NaN validation
 * @param value String to parse
 * @param defaultValue Default value if parsing fails
 * @returns Parsed integer or default value
 */
export const safeParseInt = (
    value: string | null | undefined,
    defaultValue: number = 0
): number => {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Safely parse float with NaN validation
 * @param value String to parse
 * @param defaultValue Default value if parsing fails
 * @returns Parsed float or default value
 */
export const safeParseFloat = (
    value: string | null | undefined,
    defaultValue: number = 0
): number => {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Safely parse JSON with error handling
 * @param json JSON string to parse
 * @param defaultValue Default value if parsing fails
 * @returns Parsed object or default value
 */
export const safeJSONParse = <T>(
    json: string | null | undefined,
    defaultValue: T
): T => {
    if (!json || json.trim() === '') {
        return defaultValue;
    }

    try {
        return JSON.parse(json) as T;
    } catch (error) {
        console.error('[SafeJSON] Parse error:', error);
        return defaultValue;
    }
};

/**
 * Safely stringify JSON with error handling
 * @param data Data to stringify
 * @param defaultValue Default value if stringification fails
 * @returns JSON string or default value
 */
export const safeJSONStringify = (
    data: any,
    defaultValue: string = '{}'
): string => {
    try {
        return JSON.stringify(data);
    } catch (error) {
        console.error('[SafeJSON] Stringify error:', error);
        return defaultValue;
    }
};

/**
 * Safely execute async function with retry logic
 * @param fn Async function to execute
 * @param maxRetries Maximum number of retries
 * @param retryDelay Delay between retries in ms
 * @returns Result of function or null on failure
 */
export const withRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
): Promise<T | null> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            }
        }
    }

    console.error(`[Retry] All ${maxRetries + 1} attempts failed:`, lastError);
    return null;
};

/**
 * Safely execute async function with timeout
 * @param fn Async function to execute
 * @param timeoutMs Timeout in milliseconds
 * @returns Result of function or null on timeout
 */
export const withTimeout = async <T>(
    fn: () => Promise<T>,
    timeoutMs: number = 5000
): Promise<T | null> => {
    try {
        return await Promise.race([
            fn(),
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
            ),
        ]);
    } catch (error) {
        console.error(`[Timeout] Operation failed or timed out after ${timeoutMs}ms:`, error);
        return null;
    }
};

/**
 * Create a debounced version of an async function
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export const debounceAsync = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    delay: number = 300
): ((...args: Parameters<T>) => Promise<ReturnType<T> | null>) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        return new Promise((resolve) => {
            timeoutId = setTimeout(async () => {
                try {
                    const result = await fn(...args);
                    resolve(result);
                } catch (error) {
                    console.error('[DebounceAsync] Error:', error);
                    resolve(null);
                }
            }, delay);
        });
    };
};

/**
 * Error types for better error handling
 */
export enum ErrorType {
    NETWORK = 'NETWORK',
    STORAGE = 'STORAGE',
    PERMISSION = 'PERMISSION',
    VALIDATION = 'VALIDATION',
    NATIVE_MODULE = 'NATIVE_MODULE',
    FIRESTORE = 'FIRESTORE',
    UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error class with type information
 */
export class AppError extends Error {
    constructor(
        message: string,
        public type: ErrorType = ErrorType.UNKNOWN,
        public originalError?: any
    ) {
        super(message);
        this.name = 'AppError';
    }
}

/**
 * Classify error by type
 * @param error Error to classify
 * @returns Error type
 */
export const classifyError = (error: any): ErrorType => {
    const errorMessage = error?.message?.toLowerCase() || '';

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        return ErrorType.NETWORK;
    }
    if (errorMessage.includes('storage') || errorMessage.includes('asyncstorage')) {
        return ErrorType.STORAGE;
    }
    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        return ErrorType.PERMISSION;
    }
    if (errorMessage.includes('firestore') || errorMessage.includes('firebase')) {
        return ErrorType.FIRESTORE;
    }
    if (errorMessage.includes('native') || errorMessage.includes('module')) {
        return ErrorType.NATIVE_MODULE;
    }

    return ErrorType.UNKNOWN;
};
