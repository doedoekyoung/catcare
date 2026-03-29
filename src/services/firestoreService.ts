// src/services/firestoreService.ts

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, COLLECTIONS } from './firebase';
import type { Cat, Recipe, CheckRecord, DailyLog, Household, User } from '../types';
import { toISOString } from '../utils/date';

// ── Households ────────────────────────────────────────────────────────────────

export async function createHousehold(
  ownerId: string,
  name: string
): Promise<Household> {
  const id = doc(collection(db, COLLECTIONS.HOUSEHOLDS)).id;
  const token = generateShareToken();
  const now = toISOString(new Date());
  const household: Household = {
    id,
    name,
    ownerId,
    memberIds: [ownerId],
    shareToken: token,
    shareTokenExpiry: toISOString(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    ),
    createdAt: now,
  };
  await setDoc(doc(db, COLLECTIONS.HOUSEHOLDS, id), household);
  return household;
}

export async function getHouseholdByToken(
  token: string
): Promise<Household | null> {
  const q = query(
    collection(db, COLLECTIONS.HOUSEHOLDS),
    where('shareToken', '==', token)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as Household;
}

export async function regenerateShareToken(
  householdId: string
): Promise<string> {
  const token = generateShareToken();
  const expiry = toISOString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
    shareToken: token,
    shareTokenExpiry: expiry,
  });
  return token;
}

// ── User Profile ──────────────────────────────────────────────────────────────

export async function upsertUser(user: User): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), user, { merge: true });
}

export async function getUserById(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snap.exists() ? (snap.data() as User) : null;
}

// ── Cats ──────────────────────────────────────────────────────────────────────

export async function addCat(
  householdId: string,
  catData: Omit<Cat, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Cat> {
  const now = toISOString(new Date());
  const ref_ = await addDoc(
    collection(db, COLLECTIONS.CATS(householdId)),
    { ...catData, createdAt: now, updatedAt: now }
  );
  return { id: ref_.id, ...catData, createdAt: now, updatedAt: now };
}

export async function updateCat(
  householdId: string,
  catId: string,
  data: Partial<Cat>
): Promise<void> {
  await updateDoc(
    doc(db, COLLECTIONS.CATS(householdId), catId),
    { ...data, updatedAt: toISOString(new Date()) }
  );
}

export async function deleteCat(
  householdId: string,
  catId: string
): Promise<void> {
  // Also delete all recipes that only belong to this cat
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.CATS(householdId), catId));
  await batch.commit();
}

export function subscribeToCats(
  householdId: string,
  cb: (cats: Cat[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, COLLECTIONS.CATS(householdId)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cat)))
  );
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function addRecipe(
  householdId: string,
  data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Recipe> {
  const now = toISOString(new Date());
  const ref_ = await addDoc(
    collection(db, COLLECTIONS.RECIPES(householdId)),
    { ...data, createdAt: now, updatedAt: now }
  );
  return { id: ref_.id, ...data, createdAt: now, updatedAt: now };
}

export async function updateRecipe(
  householdId: string,
  recipeId: string,
  data: Partial<Recipe>
): Promise<void> {
  await updateDoc(
    doc(db, COLLECTIONS.RECIPES(householdId), recipeId),
    { ...data, updatedAt: toISOString(new Date()) }
  );
}

export async function deleteRecipe(
  householdId: string,
  recipeId: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.RECIPES(householdId), recipeId));
}

export function subscribeToRecipes(
  householdId: string,
  cb: (recipes: Recipe[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, COLLECTIONS.RECIPES(householdId)),
    (snap) =>
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Recipe)))
  );
}

// ── Checks ────────────────────────────────────────────────────────────────────

export async function upsertCheck(
  householdId: string,
  check: CheckRecord
): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.CHECKS(householdId), check.id),
    check,
    { merge: true }
  );
}

export function subscribeToChecks(
  householdId: string,
  date: string,
  cb: (checks: CheckRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.CHECKS(householdId)),
    where('date', '==', date)
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => d.data() as CheckRecord))
  );
}

export async function getChecksForDateRange(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<CheckRecord[]> {
  const q = query(
    collection(db, COLLECTIONS.CHECKS(householdId)),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CheckRecord);
}

// ── Daily Logs ────────────────────────────────────────────────────────────────

export async function upsertLog(
  householdId: string,
  log: DailyLog
): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.LOGS(householdId), log.id),
    { ...log, updatedAt: toISOString(new Date()) },
    { merge: true }
  );
}

export async function deleteLog(
  householdId: string,
  logId: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.LOGS(householdId), logId));
}

export function subscribeToLogs(
  householdId: string,
  cb: (logs: DailyLog[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.LOGS(householdId)),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => d.data() as DailyLog))
  );
}

export async function getLogsForDateRange(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<DailyLog[]> {
  const q = query(
    collection(db, COLLECTIONS.LOGS(householdId)),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DailyLog);
}

// ── Storage (Photos) ──────────────────────────────────────────────────────────

export async function uploadPhoto(
  householdId: string,
  localUri: string,
  path: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `households/${householdId}/${path}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function deletePhoto(url: string): Promise<void> {
  const storageRef = ref(storage, url);
  await deleteObject(storageRef).catch(() => {});
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateShareToken(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
