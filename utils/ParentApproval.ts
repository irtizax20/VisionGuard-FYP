// utils/ParentApproval.ts - OTP-based parent verification (no Firebase Hosting needed)
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export interface ChildSignupPayload {
  name: string;
  email: string;
  password: string;
  dateOfBirth: string;
  category: string;
  parentEmail: string;
}

export interface ParentApprovalResponse {
  ok: boolean;
  token?: string;
  message?: string;
}

// Generate a random 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple token generator for the Firestore document ID
function generateToken(len = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function requestParentApproval(payload: ChildSignupPayload): Promise<ParentApprovalResponse> {
  try {
    const { name, email, dateOfBirth, category, parentEmail } = payload;
    if (!parentEmail) {
      return { ok: false, message: 'Parent email is required.' };
    }

    const token = generateToken(40);
    const otp = generateOTP();

    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 1) Create pending approval document with the OTP stored securely in Firestore
    await setDoc(doc(db, 'parent_verifications', token), {
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      parentEmail,
      otp, // The 6-digit code the parent needs to enter
      child: { name, email, dateOfBirth, category },
    });

    // 2) Use EmailJS or Firebase Email Extension to send the OTP.
    // For now, we store the OTP in Firestore and the parent retrieves it by logging into the app.
    // IMPORTANT: In a real app, you'd trigger an email here via Firebase Extensions or a Cloud Function.
    // For the FYP demo, the parent checks the OTP from the parent dashboard in the app.
    console.log(`✅ OTP created for parent ${parentEmail}: ${otp} (token: ${token})`);
    console.log('📧 NOTE: To send the OTP via email, enable Firebase Email Extension or use EmailJS.');

    return { ok: true, token, message: otp };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Failed to start parent approval' };
  }
}

/**
 * Verify the OTP entered by the child (given by parent).
 * Returns true if valid and marks the verification as approved.
 */
export async function verifyParentOTP(token: string, enteredOtp: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const verificationRef = doc(db, 'parent_verifications', token);
    const snap = await getDoc(verificationRef);

    if (!snap.exists()) {
      return { ok: false, message: 'Verification session not found. Please start again.' };
    }

    const data = snap.data();

    // Check expiry
    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (now > expiresAt) {
      return { ok: false, message: 'This verification code has expired. Please register again.' };
    }

    // Check status
    if (data.status === 'approved') {
      return { ok: true };
    }

    // Check OTP
    if (data.otp !== enteredOtp.trim()) {
      return { ok: false, message: 'Incorrect code. Please ask your parent for the correct 6-digit code.' };
    }

    // Mark as approved
    await updateDoc(verificationRef, { status: 'approved' });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Verification failed. Please try again.' };
  }
}

/**
 * Get the OTP for a parent to view in the Parent Dashboard.
 * Called from parent's device to display the code they need to tell the child.
 */
export async function getPendingOTPForParent(parentEmail: string): Promise<{ token: string; otp: string; childName: string } | null> {
  try {
    const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
    const q = query(
      collection(db, 'parent_verifications'),
      where('parentEmail', '==', parentEmail),
      where('status', '==', 'pending'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docData = snapshot.docs[0].data();
    return {
      token: snapshot.docs[0].id,
      otp: docData.otp,
      childName: docData.child?.name || 'Child',
    };
  } catch (e) {
    console.error('Error fetching pending OTP:', e);
    return null;
  }
}
