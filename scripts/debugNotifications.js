/**
 * Debug script for notification system
 * Run this to check notification settings and identify issues
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function checkNotificationSettings() {
  console.log('\n🔍 BlinkFit Notification Debugger\n');
  console.log('='.repeat(50));
  
  rl.question('Enter user email to debug: ', async (email) => {
    try {
      // Get user by email
      const userRecord = await admin.auth().getUserByEmail(email);
      console.log(`\n✅ Found user: ${userRecord.uid}`);
      
      // Get user settings from Firestore
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      
      if (!userDoc.exists) {
        console.log('❌ No user document found in Firestore');
        process.exit(1);
      }
      
      const userData = userDoc.data();
      console.log('\n📋 User Data:');
      console.log('  - Name:', userData.name);
      console.log('  - Email:', userData.email);
      console.log('  - Category:', userData.category);
      console.log('  - Face Verified:', userData.faceHash ? 'Yes' : 'No');
      
      // Check for notification settings in user doc or settings collection
      console.log('\n🔔 Notification Settings:');
      console.log('  Note: Notification settings are stored locally on device');
      console.log('  Check device logs for actual notification status');
      
      console.log('\n💡 Troubleshooting Steps:');
      console.log('  1. Check if notification permission is granted on device');
      console.log('  2. Check if AudioReminderService is initialized');
      console.log('  3. Check if master switch is enabled in voice settings');
      console.log('  4. Check device logs for errors:');
      console.log('     - Search for: "[AudioReminderService]"');
      console.log('     - Search for: "Notification"');
      console.log('  5. Check if quiet hours are active');
      console.log('  6. Check if screen time threshold is met');
      
      console.log('\n📱 Device Checks Required:');
      console.log('  1. Open app and go to Voice Settings');
      console.log('  2. Ensure Master Switch is ON');
      console.log('  3. Check individual reminder toggles');
      console.log('  4. Check notification permission in device settings');
      console.log('  5. Check battery optimization is disabled for BlinkFit');
      
      console.log('\n🐛 Debug Commands to Run in App:');
      console.log('  - Check AudioReminderService status');
      console.log('  - Check notification permission status');
      console.log('  - Check scheduled notifications');
      console.log('  - Force trigger a test notification');
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
    
    process.exit(0);
  });
}

checkNotificationSettings();

