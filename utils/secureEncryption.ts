/**
 * Enhanced Secure Encryption Utility for Vision Guard
 * 
 * Uses AES-256-CBC with PBKDF2 key derivation
 * Provides military-grade encryption for face data
 */

import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values'; // Must be first for polyfill

/**
 * Generate cryptographically secure salt
 * Falls back to CryptoJS if expo-crypto fails
 */
const generateSalt = async (): Promise<Uint8Array> => {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    return new Uint8Array(randomBytes);
  } catch (error) {
    console.warn('⚠️ expo-crypto failed, using CryptoJS fallback for salt');
    // Fallback: Use CryptoJS random
    const random = CryptoJS.lib.WordArray.random(16);
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = (random.words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return bytes;
  }
};

/**
 * Generate initialization vector for AES-GCM
 * Falls back to CryptoJS if expo-crypto fails
 */
const generateIV = async (): Promise<Uint8Array> => {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(12); // 12 bytes for GCM
    return new Uint8Array(randomBytes);
  } catch (error) {
    console.warn('⚠️ expo-crypto failed, using CryptoJS fallback for IV');
    // Fallback: Use CryptoJS random
    const random = CryptoJS.lib.WordArray.random(12);
    const bytes = new Uint8Array(12);
    for (let i = 0; i < 12; i++) {
      bytes[i] = (random.words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return bytes;
  }
};

/**
 * Get or create device-specific ID
 * Stored securely in device keychain/keystore
 */
const getDeviceId = async (): Promise<string> => {
  try {
    const secureKey = 'device_secure_id'; // Fixed: only alphanumeric and underscore
    let deviceId = await SecureStore.getItemAsync(secureKey);

    if (!deviceId) {
      // Generate new device ID
      try {
        const randomBytes = await Crypto.getRandomBytesAsync(32);
        deviceId = Array.from(new Uint8Array(randomBytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } catch (cryptoError) {
        console.warn('⚠️ expo-crypto failed, using CryptoJS for device ID');
        // Fallback: Use CryptoJS random
        const random = CryptoJS.lib.WordArray.random(32);
        deviceId = random.toString();
      }

      await SecureStore.setItemAsync(secureKey, deviceId, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    }

    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    // Fallback to a less secure but functional ID
    return 'fallback-device-id-' + Date.now();
  }
};

/**
 * Derive encryption key using PBKDF2
 * @param userId - User's Firebase UID
 * @param salt - Uint8Array salt
 * @returns WordArray key for AES encryption
 */
const deriveKey = async (userId: string, salt: Uint8Array): Promise<CryptoJS.lib.WordArray> => {
  try {
    const deviceId = await getDeviceId();
    const password = `${userId}-${deviceId}-visionguard-v2`;

    // Convert Uint8Array salt to WordArray
    const saltWA = CryptoJS.lib.WordArray.create(Array.from(salt) as any);

    // Derive key using PBKDF2
    const key = CryptoJS.PBKDF2(password, saltWA, {
      keySize: 256 / 32, // 256-bit key
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });

    return key;
  } catch (error) {
    console.error('Key derivation failed:', error);
    throw new Error('Failed to derive encryption key');
  }
};

/**
 * Convert Uint8Array to Base64
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 to Uint8Array
 */
const base64ToArrayBuffer = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Encrypt face data using AES-256-CBC with PBKDF2
 * @param data - Face hash/encoding to encrypt
 * @param userId - User's Firebase UID
 * @returns Encrypted data package (salt + iv + encrypted data)
 */
export const encryptFaceData = async (data: string, userId: string): Promise<string> => {
  try {
    // Generate salt and IV
    const salt = await generateSalt();
    const iv = await generateIV();

    // Derive encryption key
    const key = await deriveKey(userId, salt);

    // Convert IV to WordArray (take first 16 bytes for AES)
    const ivWA = CryptoJS.lib.WordArray.create(Array.from(iv.slice(0, 16)) as any);

    // Encrypt data using AES-CBC
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: ivWA,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Package: version + salt + iv + encrypted data
    const result = {
      version: 2, // Version 2 = AES-CBC with PBKDF2
      salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
      iv: arrayBufferToBase64(iv.slice(0, 16).buffer as ArrayBuffer),
      data: encrypted.toString() // CryptoJS outputs base64 by default
    };

    return JSON.stringify(result);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt face data');
  }
};

/**
 * Decrypt face data
 * @param encryptedPackage - Encrypted data package
 * @param userId - User's Firebase UID
 * @returns Decrypted face data
 */
export const decryptFaceData = async (encryptedPackage: string, userId: string): Promise<string> => {
  try {
    const parsed = JSON.parse(encryptedPackage);

    // Check version
    if (parsed.version !== 2) {
      throw new Error('Unsupported encryption version');
    }

    // Extract components
    const salt = base64ToArrayBuffer(parsed.salt);
    const iv = base64ToArrayBuffer(parsed.iv);

    // Derive key using same parameters
    const key = await deriveKey(userId, salt);

    // Convert IV to WordArray
    const ivWA = CryptoJS.lib.WordArray.create(Array.from(iv) as any);

    // Decrypt using AES-CBC
    const decrypted = CryptoJS.AES.decrypt(parsed.data, key, {
      iv: ivWA,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Convert back to string
    const decryptedString = CryptoJS.enc.Utf8.stringify(decrypted);

    if (!decryptedString) {
      throw new Error('Decryption produced empty result');
    }

    return decryptedString;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt face data. You may need to re-register.');
  }
};

/**
 * Check if data is encrypted with new format
 */
export const isEncryptedV2 = (data: string): boolean => {
  try {
    const parsed = JSON.parse(data);
    return parsed.version === 2 && parsed.salt && parsed.iv && parsed.data;
  } catch {
    return false;
  }
};

/**
 * Migrate old encryption to new format
 */
export const migrateToV2 = async (
  oldEncryptedData: string,
  userId: string,
  oldDecryptFunction: (data: string, userId: string) => Promise<string>
): Promise<string> => {
  try {
    // Check if already v2
    if (isEncryptedV2(oldEncryptedData)) {
      return oldEncryptedData;
    }

    // Decrypt using old method
    const decrypted = await oldDecryptFunction(oldEncryptedData, userId);

    // Re-encrypt using new method
    return await encryptFaceData(decrypted, userId);
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error('Failed to migrate encryption. Please re-register your face.');
  }
};

