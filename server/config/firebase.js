import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let firebaseApp = null;

export const initFirebase = () => {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  
  if (!serviceAccountPath) {
    console.warn('⚠️  WARNING: FIREBASE_SERVICE_ACCOUNT_PATH is not set. FCM notifications will not function.');
    return null;
  }

  const resolvedPath = path.resolve(serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`⚠️  WARNING: Firebase service account file not found at: ${resolvedPath}. FCM notifications will not function.`);
    return null;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialized successfully.');
    return firebaseApp;
  } catch (error) {
    console.error(`❌ Failed to initialize Firebase Admin SDK: ${error.message}`);
    return null;
  }
};

export const getFirebaseApp = () => firebaseApp;
export const sendPriorityAlarm = async (token, payload) => {
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK is not initialized.');
  }
  try {
    const response = await admin.messaging().send({
      token,
      data: {
        type: 'priority_alarm',
        sender: String(payload.sender ?? payload.data?.sender ?? ''),
        subject: String(payload.subject ?? payload.data?.subject ?? '')
      },
      android: {
        priority: 'high',
        ttl: 60 * 1000
      }
    });
    console.log('✅ FCM notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending FCM notification:', error);
    throw error;
  }
};
