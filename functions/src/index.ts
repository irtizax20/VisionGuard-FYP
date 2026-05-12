import * as sgMail from '@sendgrid/mail';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { v4 as uuidv4 } from 'uuid';

admin.initializeApp();
const db = admin.firestore();

// Configure SendGrid via functions config:
// firebase functions:config:set sendgrid.api_key="YOUR_KEY" sendgrid.from_email="no-reply@yourdomain.com" app.verify_base_url="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/verifyParentApproval"
const SENDGRID_API_KEY = functions.config().sendgrid?.api_key as string | undefined;
const FROM_EMAIL = (functions.config().sendgrid?.from_email as string | undefined) || 'no-reply@example.com';
const VERIFY_BASE_URL = (functions.config().app?.verify_base_url as string | undefined) || '';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function cors(res: functions.Response) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

export const requestParentApproval = functions.https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { name, email, password, dateOfBirth, category, parentEmail } = req.body || {};
    if (!name || !email || !dateOfBirth || !category || !parentEmail) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Server-side parent validation with admin privileges (avoids client Firestore rules)
    const normalizedEmail = String(parentEmail).trim().toLowerCase();

    const findInCollection = async (col: string) => {
      // Try emailLower, then fallback to email
      let snap = await db.collection(col).where('emailLower', '==', normalizedEmail).limit(1).get();
      if (snap.empty) {
        snap = await db.collection(col).where('email', '==', parentEmail).limit(1).get();
      }
      return snap;
    };

    // Prefer age-grouped collections first (adult -> old), then users as fallback
    let parentSnap = await findInCollection('adult');
    let matchedCollection: 'adult' | 'old' | 'users' | null = null;
    if (!parentSnap.empty) {
      matchedCollection = 'adult';
    } else {
      parentSnap = await findInCollection('old');
      if (!parentSnap.empty) matchedCollection = 'old';
    }

    if (parentSnap.empty) {
      // Fallback to 'users' without relying on specific category labels (handles 'adult'/'elder' and '16-40'/'40+')
      parentSnap = await findInCollection('users');
      if (!parentSnap.empty) matchedCollection = 'users';
    }

    if (parentSnap.empty) {
      res.status(404).json({ error: 'Parent profile not found. Please ask your parent to sign up (Adult/Old) first.' });
      return;
    }

    const parentData = parentSnap.docs[0].data() as any;

    // Validate dateOfBirth and minimum age (16+)
    const parentDob = parentData.dateOfBirth || parentData.dob || parentData.birthDate || null;
    if (!parentDob) {
      res.status(400).json({ error: 'Parent account is incomplete. Date of birth is missing.' });
      return;
    }
    const calcAge = (dob: string) => {
      const today = new Date();
      const birth = new Date(dob);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    };
    const parentAge = calcAge(parentDob);
    if (parentAge < 16) {
      res.status(400).json({ error: `Parent must be at least 16 years old. Current age: ${parentAge}.` });
      return;
    }

    // Optional: Block if parent category is explicitly 'child'
    const cat = String(parentData.category || '').toLowerCase();
    if (cat === 'child' || cat === 'under16') {
      res.status(400).json({ error: 'A child account cannot be used as a parent.' });
      return;
    }

    // Passed validation -> create token and send email
    const token = uuidv4();
    const docRef = db.collection('parent_verifications').doc(token);
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24)); // 24h

    await docRef.set({
      token,
      status: 'pending',
      createdAt: now,
      expiresAt,
      child: { name, email, dateOfBirth, category },
      parentEmail,
    });

    if (!SENDGRID_API_KEY || !VERIFY_BASE_URL) {
      // Functions not fully configured to send email, but return token so client can proceed for testing
      res.status(200).json({ token, warning: 'Email disabled: configure SendGrid and VERIFY_BASE_URL' });
      return;
    }

    const verifyUrl = `${VERIFY_BASE_URL}?token=${encodeURIComponent(token)}`;
    const msg: sgMail.MailDataRequired = {
      to: parentEmail,
      from: FROM_EMAIL,
      subject: 'Approve your child\'s Vision Guard signup',
      html: `
        <div style="font-family:Arial,sans-serif;">
          <h2>Vision Guard Parent Approval</h2>
          <p>Your child <strong>${name}</strong> (${email}) is requesting to sign up for Vision Guard.</p>
          <p>Please click the button below to approve this request.</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#2B383D;color:#fff;text-decoration:none;border-radius:6px;">Approve Signup</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    };

    await sgMail.send(msg);

    res.status(200).json({ token });
    return;
  } catch (err: any) {
    console.error('requestParentApproval error:', err);
    res.status(500).json({ error: err?.message || 'Internal error' });
    return;
  }
});

export const verifyParentApproval = functions.https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
  try {
    const token = (req.query.token as string) || '';
    if (!token) {
      res.status(400).send('<h3>Missing token</h3>');
      return;
    }
    const ref = db.collection('parent_verifications').doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).send('<h3>Invalid approval link</h3>');
      return;
    }
    const data = snap.data() as any;
    const now = admin.firestore.Timestamp.now();
    if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
      await ref.update({ status: 'expired', expiredAt: now });
      res.status(400).send('<h3>This approval link has expired.</h3>');
      return;
    }
    if (data.status !== 'approved') {
      await ref.update({ status: 'approved', approvedAt: now });
    }
    res.status(200).send('<h2>Approval successful!</h2><p>You can close this page. Your child can now continue signup.</p>');
  } catch (err: any) {
    console.error('verifyParentApproval error:', err);
    res.status(500).send('<h3>Internal error</h3>');
  }
});
