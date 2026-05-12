/**
 * Script to clear today's incorrect screen time data from Firebase
 * Run this with: node scripts/clearTodayScreenTime.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin (adjust path to your service account key if needed)
try {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.log('⚠️  Using default credentials. Make sure GOOGLE_APPLICATION_CREDENTIALS is set.');
  admin.initializeApp();
}

const db = admin.firestore();

async function clearTodayScreenTime(userId, category = 'adult') {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dateKey = `screenTime_${today}`;
    
    console.log(`\n🔍 Checking ${category}/${userId} for ${today}...`);
    
    const docRef = db.collection(category).doc(userId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log(`❌ No document found at ${category}/${userId}`);
      return;
    }
    
    const data = doc.data();
    
    if (data[dateKey]) {
      console.log(`📊 Current data: ${data[dateKey].duration} (timestamp: ${data[dateKey].timestamp})`);
      
      // Delete today's entry
      await docRef.update({
        [dateKey]: admin.firestore.FieldValue.delete()
      });
      
      console.log(`✅ Cleared ${dateKey} from ${category}/${userId}`);
    } else {
      console.log(`ℹ️  No data found for ${dateKey}`);
    }
    
  } catch (error) {
    console.error(`❌ Error clearing data:`, error.message);
  }
}

async function main() {
  // Get user ID from command line arguments
  const userId = process.argv[2];
  
  if (!userId) {
    console.log(`
❌ Usage: node scripts/clearTodayScreenTime.js <userId> [category]

Example:
  node scripts/clearTodayScreenTime.js sZQB0zn4b9TFybaJtpWUMAAW1Fn1 adult

Categories: adult (default), child, old
    `);
    process.exit(1);
  }
  
  const category = process.argv[3] || 'adult';
  
  console.log('🧹 Firebase Screen Time Cleaner');
  console.log('================================');
  console.log(`User ID: ${userId}`);
  console.log(`Category: ${category}`);
  console.log(`Today: ${new Date().toISOString().slice(0, 10)}`);
  
  await clearTodayScreenTime(userId, category);
  
  console.log('\n✨ Done!');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

