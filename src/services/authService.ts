// src/services/authService.ts

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';
import { upsertUser, getUserById } from './firestoreService';
import type { User } from '../types';

// ── Email/Password Auth ───────────────────────────────────────────────────────

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  const user: User = {
    uid: cred.user.uid,
    email,
    displayName,
    role: 'owner',
  };
  await upsertUser(user);
  return user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = await getUserById(cred.user.uid);
  if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.');
  return user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// ── Auth State Observer ───────────────────────────────────────────────────────

export function subscribeToAuthState(
  cb: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    if (!fbUser) { cb(null); return; }
    const user = await getUserById(fbUser.uid);
    cb(user);
  });
}

// ── Guest / Sitter Access (REQ-V1-04) ────────────────────────────────────────
// Sitters access via share link — they get a read+check anonymous session.

export async function signInAsGuest(): Promise<void> {
  // Firebase anonymous auth — gives sitters a uid for check attribution
  const { signInAnonymously } = await import('firebase/auth');
  await signInAnonymously(auth);
}
