const appJson = require('./app.json');
require('dotenv/config');

// Merge values from app.json with any dynamic config provided by Expo
module.exports = ({ config = {} }) => ({
  ...config,
  expo: {
    ...(config.expo || {}),
    ...(appJson.expo || {}),
    extra: {
      ...(appJson.expo?.extra || {}),
      ...(config.extra || {}),
      // Firebase Configuration
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID,
    },
    plugins: [
      ...(appJson.expo?.plugins || []),
      ...(config.plugins || []),
      "@react-native-community/datetimepicker"
    ]
  }
});
