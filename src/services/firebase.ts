// src/services/firebase.ts
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
import { getAnalytics, Analytics, isSupported, logEvent as firebaseLogEvent } from 'firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;

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

  // Analytics: web 환경에서만 초기화
  isSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app);
  });
} else {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage, analytics };

// 이벤트 로깅 헬퍼 — analytics 미지원 환경에서 silently 무시
export function logEvent(eventName: string, params?: Record<string, unknown>) {
  if (analytics) firebaseLogEvent(analytics, eventName, params);
}

// ── Firestore Collection Paths ────────────────────────────────────────────────
export const COLLECTIONS = {
  HOUSEHOLDS: 'households',
  USERS: 'users',
  CATS: (householdId: string) => `households/${householdId}/cats`,
  RECIPES: (householdId: string) => `households/${householdId}/recipes`,
  CHECKS: (householdId: string) => `households/${householdId}/checks`,
  LOGS: (householdId: string) => `households/${householdId}/logs`,
} as const;
