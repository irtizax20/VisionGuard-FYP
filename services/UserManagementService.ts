// services/UserManagementService.ts
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { collection, doc, getDocs, increment, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

export interface UserData {
  uid: string;
  email: string;
  name: string;
  category: 'under16' | '16-40' | '40+';
  parentEmail?: string;
  childrenCount?: number;
  children?: string[]; // Array of child UIDs
  createdAt: Date;
  emailVerified: boolean;
}

export class UserManagementService {
  
  /**
   * Check if a parent email exists and is in valid age categories (16-40 or 40+)
   * @param parentEmail - The parent's email to validate
   * @returns Promise<{exists: boolean, parentData?: UserData, error?: string}>
   */
  static async validateParentEmail(parentEmail: string): Promise<{
    exists: boolean;
    parentData?: UserData;
    error?: string;
  }> {
    try {
      console.log('🔍 Validating parent email:', parentEmail);
      
      // Check if parent exists in Firestore first (more reliable)
      const usersRef = collection(db, 'user');
      
      // First, let's try to find the user by email only (for debugging)
      const emailOnlyQuery = query(
        usersRef,
        where('email', '==', parentEmail)
      );
      
      const emailOnlySnapshot = await getDocs(emailOnlyQuery);
      console.log('👤 Users found with this email in Firestore:', emailOnlySnapshot.size);
      
      if (emailOnlySnapshot.empty) {
        console.log('❌ Email not found in Firestore database');
        
        // Only check Firebase Auth if Firestore fails
        try {
          const methods = await fetchSignInMethodsForEmail(auth, parentEmail);
          console.log('📧 Auth methods found:', methods.length);
          
          if (methods.length === 0) {
            return {
              exists: false,
              error: 'Parent not found. Please ask your parent to signup first.'
            };
          } else {
            return {
              exists: false,
              error: 'Parent email exists in Auth but no profile found. Please complete registration first.'
            };
          }
        } catch (authError) {
          console.log('⚠️ Firebase Auth check failed:', authError);
          return {
            exists: false,
            error: 'Parent not found. Please ask your parent to signup first.'
          };
        }
      }
      
      // User found in Firestore, let's check the data
      const userDoc = emailOnlySnapshot.docs[0];
      const userData = userDoc.data();
      console.log('📊 User data found:', {
        email: userData.email,
        category: userData.category,
        childrenCount: userData.childrenCount,
        name: userData.name,
        uid: userData.uid,
        hasAllFields: {
          uid: !!userData.uid,
          name: !!userData.name,
          email: !!userData.email,
          category: !!userData.category,
          createdAt: !!userData.createdAt,
          emailVerified: userData.emailVerified !== undefined
        }
      });
      
      // Now check with age category filter
      const parentQuery = query(
        usersRef,
        where('email', '==', parentEmail),
        where('category', 'in', ['16-40', '40+', 'adult', 'old'])
      );
      
      const parentSnapshot = await getDocs(parentQuery);
      console.log('👨‍👩‍👧‍👦 Valid parents found:', parentSnapshot.size);
      
      if (parentSnapshot.empty) {
        console.log('❌ User found but invalid category. Current category:', userData.category);
        return {
          exists: false,
          error: `Parent found but has category "${userData.category}". Parent must be 16 years or older (categories: 16-40 or 40+).`
        };
      }

      const parentDoc = parentSnapshot.docs[0];
      const parentData = parentDoc.data() as UserData;
      console.log('✅ Valid parent found:', parentData.name, 'Category:', parentData.category);
      
      return {
        exists: true,
        parentData
      };
      
    } catch (error) {
      console.error('❌ Error validating parent email:', error);
      return {
        exists: false,
        error: 'Error validating parent information. Please try again.'
      };
    }
  }

  /**
   * Check if parent has reached the 2-child limit
   * @param parentEmail - The parent's email
   * @returns Promise<{canAddChild: boolean, currentCount: number, error?: string}>
   */
  static async checkParentChildLimit(parentEmail: string): Promise<{
    canAddChild: boolean;
    currentCount: number;
    error?: string;
  }> {
    try {
      const usersRef = collection(db, 'user');
      const parentQuery = query(
        usersRef,
        where('email', '==', parentEmail),
        where('category', 'in', ['16-40', '40+', 'adult', 'old'])
      );
      
      const parentSnapshot = await getDocs(parentQuery);
      
      if (parentSnapshot.empty) {
        return {
          canAddChild: false,
          currentCount: 0,
          error: 'Parent not found'
        };
      }

      const parentData = parentSnapshot.docs[0].data() as UserData;
      const currentCount = parentData.childrenCount || 0;
      
      return {
        canAddChild: currentCount < 2,
        currentCount,
        error: currentCount >= 2 ? 'Your limit is full. You can only register 2 children.' : undefined
      };
      
    } catch (error) {
      console.error('Error checking parent child limit:', error);
      return {
        canAddChild: false,
        currentCount: 0,
        error: 'Error checking parent limit. Please try again.'
      };
    }
  }

  /**
   * Update parent's child count when a new child is registered
   * @param parentEmail - The parent's email
   * @param childUid - The child's UID to add
   */
  static async updateParentChildCount(parentEmail: string, childUid: string): Promise<void> {
    try {
      const usersRef = collection(db, 'user');
      const parentQuery = query(
        usersRef,
        where('email', '==', parentEmail),
        where('category', 'in', ['16-40', '40+', 'adult', 'old'])
      );
      
      const parentSnapshot = await getDocs(parentQuery);
      
      if (!parentSnapshot.empty) {
        const parentDoc = parentSnapshot.docs[0];
        const parentRef = doc(db, 'user', parentDoc.id);
        
        // Get current children array
        const parentData = parentDoc.data() as UserData;
        const currentChildren = parentData.children || [];
        
        // Add new child and increment counter
        await updateDoc(parentRef, {
          childrenCount: increment(1),
          children: [...currentChildren, childUid]
        });
      }
    } catch (error) {
      console.error('Error updating parent child count:', error);
      throw error;
    }
  }

  /**
   * Get parent UID by email address
   * @param parentEmail - The parent's email
   * @returns Promise<string | null> - Parent's UID or null if not found
   */
  static async getParentUid(parentEmail: string): Promise<string | null> {
    try {
      const usersRef = collection(db, 'user');
      const parentQuery = query(
        usersRef,
        where('email', '==', parentEmail),
        where('category', 'in', ['16-40', '40+', 'adult', 'old'])
      );
      
      const parentSnapshot = await getDocs(parentQuery);
      
      if (parentSnapshot.empty) {
        return null;
      }

      return parentSnapshot.docs[0].id;
    } catch (error) {
      console.error('Error getting parent UID:', error);
      return null;
    }
  }

  /**
   * Get all children for a parent
   * @param parentEmail - The parent's email
   * @returns Promise<UserData[]> - Array of child user data
   */
  static async getParentChildren(parentEmail: string): Promise<UserData[]> {
    try {
      const usersRef = collection(db, 'user');
      const childrenQuery = query(
        usersRef,
        where('parentEmail', '==', parentEmail),
        where('category', '==', 'under16')
      );
      
      const childrenSnapshot = await getDocs(childrenQuery);
      
      return childrenSnapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      } as UserData));
      
    } catch (error) {
      console.error('Error fetching parent children:', error);
      return [];
    }
  }

  /**
   * Comprehensive validation for child signup
   * @param parentEmail - The parent's email
   * @returns Promise<{isValid: boolean, error?: string, parentData?: UserData}>
   */
  static async validateChildSignup(parentEmail: string): Promise<{
    isValid: boolean;
    error?: string;
    parentData?: UserData;
  }> {
    try {
      // Step 1: Validate parent email exists and is in correct age category
      const parentValidation = await this.validateParentEmail(parentEmail);
      if (!parentValidation.exists) {
        return {
          isValid: false,
          error: parentValidation.error
        };
      }

      // Step 2: Check if parent has reached child limit
      const limitCheck = await this.checkParentChildLimit(parentEmail);
      if (!limitCheck.canAddChild) {
        return {
          isValid: false,
          error: limitCheck.error
        };
      }

      return {
        isValid: true,
        parentData: parentValidation.parentData
      };
      
    } catch (error) {
      console.error('Error in child signup validation:', error);
      return {
        isValid: false,
        error: 'Error validating signup information. Please try again.'
      };
    }
  }
}
