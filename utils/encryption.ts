/**
 * Secure Encryption Utility for Vision Guard
 * 
 * Uses device-specific ID + Firebase UID as encryption key
 * Key is never stored in code or committed to git
 */

import CryptoJS from 'crypto-js';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * Generate encryption key using device + user specific data
 * This ensures each user on each device has unique encryption
 */
const generateEncryptionKey = async (userId: string): Promise<string> => {
  try {
    // Get device-specific identifiers
    const deviceId = Constants.sessionId || Constants.installationId || 'default-device';
    const appId = Application.applicationId || 'com.irtiza001.visionguard';
    
    // Combine with user ID to create unique key
    const combinedKey = `${deviceId}-${appId}-${userId}-visionguard-secure`;
    
    // Hash it to create consistent 256-bit key
    return CryptoJS.SHA256(combinedKey).toString();
  } catch (error) {
    console.error('Failed to generate encryption key:', error);
    // Fallback to user ID based key (less secure but functional)
    return CryptoJS.SHA256(`visionguard-${userId}`).toString();
  }
};

/**
 * Encrypt face data
 * @param data - Face hash/encoding to encrypt
 * @param userId - User's Firebase UID
 * @returns Encrypted string
 */
export const encryptFaceData = async (data: string, userId: string): Promise<string> => {
  try {
    const key = await generateEncryptionKey(userId);
    const encrypted = CryptoJS.AES.encrypt(data, key).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt face data');
  }
};

/**
 * Decrypt face data
 * @param encryptedData - Encrypted face hash
 * @param userId - User's Firebase UID
 * @returns Decrypted face data
 */
export const decryptFaceData = async (encryptedData: string, userId: string): Promise<string> => {
  try {
    const key = await generateEncryptionKey(userId);
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
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
 * Check if data is encrypted (basic heuristic)
 */
export const isEncrypted = (data: string): boolean => {
  // AES encrypted data is base64 encoded and quite long
  // Plain JSON will have { } characters
  return !data.startsWith('{') && data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(data);
};

/**
 * Migrate old plaintext face data to encrypted format
 */
export const migrateToEncrypted = async (
  plaintextData: string, 
  userId: string
): Promise<string> => {
  if (isEncrypted(plaintextData)) {
    return plaintextData; // Already encrypted
  }
  return await encryptFaceData(plaintextData, userId);
};

