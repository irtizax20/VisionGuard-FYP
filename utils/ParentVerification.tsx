// utils/ParentVerification.tsx
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export interface ParentValidationResult {
  isValid: boolean;
  message: string;
  parentData?: any;
}

/**
 * Check if parent email exists and is valid as a parent
 * Rules:
 * - Parent must be registered in the system (user collection)
 * - Parent must be 22+ years old
 * - Parent must NOT be in 'child' category
 */
export const validateParentEmail = async (parentEmail: string): Promise<ParentValidationResult> => {
  try {
    console.log('🔍 Checking parent email:', parentEmail);

    // Normalize email to avoid case/whitespace issues
    const normalizedEmail = parentEmail.trim().toLowerCase();

    // Find user in user collection (case-insensitive)
    const usersRef = collection(db, 'user');
    let parentSnapshot = await getDocs(query(usersRef, where('emailLower', '==', normalizedEmail)));
    
    if (parentSnapshot.empty) {
      parentSnapshot = await getDocs(query(usersRef, where('email', '==', normalizedEmail)));
    }

    if (parentSnapshot.empty) {
      return {
        isValid: false,
        message: 'Parent profile not found. Please ask your parent to sign up first.'
      };
    }

    console.log('✅ Parent found in database');

    // Validate parent's age and category
    const parentDoc = parentSnapshot.docs[0];
    const parentData = parentDoc.data();
    
    console.log('👤 Parent data:', parentData);

    // Check if parent has date of birth
    if (!parentData.dateOfBirth) {
      return {
        isValid: false,
        message: 'Parent account is incomplete. Please ask your parent to update their profile with date of birth.'
      };
    }

    // Calculate parent's age
    const parentAge = calculateAge(parentData.dateOfBirth);
    console.log('📅 Parent age:', parentAge);

    // Check if parent is at least 22 years old
    if (parentAge < 22) {
      return {
        isValid: false,
        message: `Parent must be at least 22 years old. Current parent age is ${parentAge} years.`
      };
    }

    // Get category from user data
    const userCategory = parentData.category;

    // Check if parent is in valid category (not child)
    if (userCategory === 'child') {
      return {
        isValid: false,
        message: 'A child cannot be a parent. Please provide a valid parent email.'
      };
    }

    console.log('✅ Parent validation successful');

    return {
      isValid: true,
      message: `Parent verified successfully! ${parentData.name} (Age: ${parentAge}) can be your guardian.`,
      parentData: {
        name: parentData.name,
        age: parentAge,
        category: userCategory,
        email: parentData.email
      }
    };

  } catch (error) {
    console.error('❌ Parent validation error:', error);
    return {
      isValid: false,
      message: 'Error validating parent email. Please try again.'
    };
  }
};

/**
 * Calculate age from date of birth string
 */
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Search for parent in user collection
 */
export const searchParentInAllCategories = async (parentEmail: string) => {
  try {
    const normalizedEmail = parentEmail.trim().toLowerCase();

    // Search in user collection
    const usersRef = collection(db, 'user');
    let snap = await getDocs(query(usersRef, where('emailLower', '==', normalizedEmail)));
    
    if (snap.empty) {
      snap = await getDocs(query(usersRef, where('email', '==', normalizedEmail)));
    }

    if (!snap.empty) {
      return { ...snap.docs[0].data(), sourceCollection: 'user' };
    }

    return null;
  } catch (error) {
    console.error('Error searching parent:', error);
    return null;
  }
};

