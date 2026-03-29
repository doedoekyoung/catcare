// src/services/firebase.ts
// ⚠️  Replace the config values below with your own Firebase project credentials.
//    Firebase Console → Project Settings → Your apps → SDK setup and configuration

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);

  // React Native auth persistence via AsyncStorage
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });

  db = getFirestore(app);
  storage = getStorage(app);

  // Enable offline persistence (REQ-M01~M08: offline required)
  enableIndexedDbPersistence(db).catch(() => {
    // Persistence may fail in some environments — fail silently
  });
} else {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };

// ── Firestore Collection Paths ────────────────────────────────────────────────
export const COLLECTIONS = {
  HOUSEHOLDS: 'households',
  USERS: 'users',
  CATS: (householdId: string) => `households/${householdId}/cats`,
  RECIPES: (householdId: string) => `households/${householdId}/recipes`,
  CHECKS: (householdId: string) => `households/${householdId}/checks`,
  LOGS: (householdId: string) => `households/${householdId}/logs`,
} as const;
