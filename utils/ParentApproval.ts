// utils/ParentApproval.ts - Email Link based parent verification (no Cloud Functions)
import { sendSignInLinkToEmail } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

export interface ChildSignupPayload {
  name: string;
  email: string;
  password: string;
  dateOfBirth: string;
  category: string; // 'child' expected here
  parentEmail: string;
}

export interface ParentApprovalResponse {
  ok: boolean;
  token?: string;
  message?: string;
}

// Simple token generator (avoid extra deps)
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

    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 1) Create pending approval document
    await setDoc(doc(db, 'parent_verifications', token), {
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      parentEmail,
      child: { name, email, dateOfBirth, category },
    });

    // 2) Send Email Link to parent (no Functions). Parent opens hosted page which approves in Firestore
    const approveUrl = `https://blinkfit-ca40a.firebaseapp.com/parent-approve.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(parentEmail)}`;
    const actionCodeSettings = {
      url: approveUrl,
      handleCodeInApp: true,
    } as const;

    await sendSignInLinkToEmail(auth, parentEmail, actionCodeSettings);

    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Failed to start parent approval' };
  }
}
