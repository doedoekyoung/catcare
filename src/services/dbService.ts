// src/services/dbService.ts
import { supabase, TABLES } from './supabase';
import type { Cat, Recipe, CheckRecord, DailyLog, Household, User } from '../types';
import { toISOString } from '../utils/date';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateShareToken(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ── Row → Type Mappers ────────────────────────────────────────────────────────

function toUser(row: any): User {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    photoURL: row.photo_url,
    householdId: row.household_id,
    role: row.role,
  };
}

function toHousehold(row: any): Household {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    memberIds: row.member_ids ?? [],
    shareToken: row.share_token,
    shareTokenExpiry: row.share_token_expiry,
    createdAt: row.created_at,
  };
}

function toCat(row: any): Cat {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    breed: row.breed,
    birthDate: row.birth_date,
    weight: row.weight,
    photoUri: row.photo_uri,
    ownerId: row.owner_id,
    householdId: row.household_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRecipe(row: any): Recipe {
  return {
    id: row.id,
    name: row.name,
    time: row.time,
    catIds: row.cat_ids ?? [],
    active: row.active,
    householdId: row.household_id,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCheckRecord(row: any): CheckRecord {
  return {
    id: row.id,
    date: row.date,
    recipeId: row.recipe_id,
    catId: row.cat_id,
    done: row.done,
    doneAt: row.done_at,
    doneBy: row.done_by,
    memo: row.memo,
    householdId: row.household_id,
  };
}

function toDailyLog(row: any): DailyLog {
  return {
    id: row.id,
    date: row.date,
    catId: row.cat_id,
    text: row.text,
    photoUri: row.photo_uri,
    householdId: row.household_id,
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Users ──────────────────────────────────────────────────────────────────────

export async function upsertUser(user: User): Promise<void> {
  const { error } = await supabase.from(TABLES.USERS).upsert({
    uid: user.uid,
    email: user.email,
    display_name: user.displayName,
    photo_url: user.photoURL,
    household_id: user.householdId ?? null,
    role: user.role,
  });
  if (error) throw error;
}

export async function getUserById(uid: string): Promise<User | null> {
  const { data } = await supabase
    .from(TABLES.USERS)
    .select()
    .eq('uid', uid)
    .single();
  return data ? toUser(data) : null;
}

// ── Households ────────────────────────────────────────────────────────────────

export async function createHousehold(
  ownerId: string,
  name: string
): Promise<Household> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLDS)
    .insert({
      name,
      owner_id: ownerId,
      member_ids: [ownerId],
      share_token: generateShareToken(),
      share_token_expiry: toISOString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      created_at: toISOString(new Date()),
    })
    .select()
    .single();
  if (error) throw error;
  return toHousehold(data);
}

export async function getHouseholdById(id: string): Promise<Household | null> {
  const { data } = await supabase
    .from(TABLES.HOUSEHOLDS)
    .select()
    .eq('id', id)
    .single();
  return data ? toHousehold(data) : null;
}

export async function getHouseholdByToken(token: string): Promise<Household | null> {
  const { data } = await supabase
    .from(TABLES.HOUSEHOLDS)
    .select()
    .eq('share_token', token)
    .single();
  return data ? toHousehold(data) : null;
}

export async function regenerateShareToken(householdId: string): Promise<string> {
  const token = generateShareToken();
  const { error } = await supabase
    .from(TABLES.HOUSEHOLDS)
    .update({
      share_token: token,
      share_token_expiry: toISOString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    })
    .eq('id', householdId);
  if (error) throw error;
  return token;
}

// ── Cats ──────────────────────────────────────────────────────────────────────

export async function addCat(
  householdId: string,
  catData: Omit<Cat, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Cat> {
  const now = toISOString(new Date());
  const { data, error } = await supabase
    .from(TABLES.CATS)
    .insert({
      name: catData.name,
      emoji: catData.emoji,
      breed: catData.breed ?? null,
      birth_date: catData.birthDate ?? null,
      weight: catData.weight ?? null,
      photo_uri: catData.photoUri ?? null,
      owner_id: catData.ownerId,
      household_id: householdId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return toCat(data);
}

export async function updateCat(
  householdId: string,
  catId: string,
  data: Partial<Cat>
): Promise<void> {
  const update: Record<string, any> = { updated_at: toISOString(new Date()) };
  if (data.name !== undefined) update.name = data.name;
  if (data.emoji !== undefined) update.emoji = data.emoji;
  if (data.breed !== undefined) update.breed = data.breed;
  if (data.birthDate !== undefined) update.birth_date = data.birthDate;
  if (data.weight !== undefined) update.weight = data.weight;
  if (data.photoUri !== undefined) update.photo_uri = data.photoUri;

  const { error } = await supabase
    .from(TABLES.CATS)
    .update(update)
    .eq('id', catId)
    .eq('household_id', householdId);
  if (error) throw error;
}

export async function deleteCat(householdId: string, catId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.CATS)
    .delete()
    .eq('id', catId)
    .eq('household_id', householdId);
  if (error) throw error;
}

export function subscribeToCats(
  householdId: string,
  cb: (cats: Cat[]) => void
): () => void {
  const fetch = () =>
    supabase
      .from(TABLES.CATS)
      .select()
      .eq('household_id', householdId)
      .then(({ data }) => cb((data ?? []).map(toCat)));

  fetch();

  const channel = supabase
    .channel(`cats-${householdId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: TABLES.CATS,
      filter: `household_id=eq.${householdId}`,
    }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function addRecipe(
  householdId: string,
  data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Recipe> {
  const now = toISOString(new Date());
  const { data: row, error } = await supabase
    .from(TABLES.RECIPES)
    .insert({
      name: data.name,
      time: data.time,
      cat_ids: data.catIds,
      active: data.active,
      household_id: householdId,
      memo: data.memo ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return toRecipe(row);
}

export async function updateRecipe(
  householdId: string,
  recipeId: string,
  data: Partial<Recipe>
): Promise<void> {
  const update: Record<string, any> = { updated_at: toISOString(new Date()) };
  if (data.name !== undefined) update.name = data.name;
  if (data.time !== undefined) update.time = data.time;
  if (data.catIds !== undefined) update.cat_ids = data.catIds;
  if (data.active !== undefined) update.active = data.active;
  if (data.memo !== undefined) update.memo = data.memo;

  const { error } = await supabase
    .from(TABLES.RECIPES)
    .update(update)
    .eq('id', recipeId)
    .eq('household_id', householdId);
  if (error) throw error;
}

export async function deleteRecipe(householdId: string, recipeId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.RECIPES)
    .delete()
    .eq('id', recipeId)
    .eq('household_id', householdId);
  if (error) throw error;
}

export function subscribeToRecipes(
  householdId: string,
  cb: (recipes: Recipe[]) => void
): () => void {
  const fetch = () =>
    supabase
      .from(TABLES.RECIPES)
      .select()
      .eq('household_id', householdId)
      .then(({ data }) => cb((data ?? []).map(toRecipe)));

  fetch();

  const channel = supabase
    .channel(`recipes-${householdId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: TABLES.RECIPES,
      filter: `household_id=eq.${householdId}`,
    }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Checks ────────────────────────────────────────────────────────────────────

export async function upsertCheck(householdId: string, check: CheckRecord): Promise<void> {
  const { error } = await supabase.from(TABLES.CHECKS).upsert({
    id: check.id,
    date: check.date,
    recipe_id: check.recipeId,
    cat_id: check.catId,
    done: check.done,
    done_at: check.doneAt ?? null,
    done_by: check.doneBy ?? null,
    memo: check.memo ?? null,
    household_id: householdId,
  });
  if (error) throw error;
}

export function subscribeToChecks(
  householdId: string,
  date: string,
  cb: (checks: CheckRecord[]) => void
): () => void {
  const fetch = () =>
    supabase
      .from(TABLES.CHECKS)
      .select()
      .eq('household_id', householdId)
      .eq('date', date)
      .then(({ data }) => cb((data ?? []).map(toCheckRecord)));

  fetch();

  const channel = supabase
    .channel(`checks-${householdId}-${date}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: TABLES.CHECKS,
      filter: `household_id=eq.${householdId}`,
    }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export async function getChecksForDateRange(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<CheckRecord[]> {
  const { data, error } = await supabase
    .from(TABLES.CHECKS)
    .select()
    .eq('household_id', householdId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toCheckRecord);
}

// ── Daily Logs ────────────────────────────────────────────────────────────────

export async function upsertLog(householdId: string, log: DailyLog): Promise<void> {
  const { error } = await supabase.from(TABLES.LOGS).upsert({
    id: log.id,
    date: log.date,
    cat_id: log.catId ?? null,
    text: log.text,
    photo_uri: log.photoUri ?? null,
    household_id: householdId,
    author_id: log.authorId,
    created_at: log.createdAt,
    updated_at: toISOString(new Date()),
  });
  if (error) throw error;
}

export async function deleteLog(householdId: string, logId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.LOGS)
    .delete()
    .eq('id', logId)
    .eq('household_id', householdId);
  if (error) throw error;
}

export function subscribeToLogs(
  householdId: string,
  cb: (logs: DailyLog[]) => void
): () => void {
  const fetch = () =>
    supabase
      .from(TABLES.LOGS)
      .select()
      .eq('household_id', householdId)
      .order('date', { ascending: false })
      .then(({ data }) => cb((data ?? []).map(toDailyLog)));

  fetch();

  const channel = supabase
    .channel(`logs-${householdId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: TABLES.LOGS,
      filter: `household_id=eq.${householdId}`,
    }, fetch)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export async function getLogsForDateRange(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from(TABLES.LOGS)
    .select()
    .eq('household_id', householdId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toDailyLog);
}

// ── Storage (Photos) ──────────────────────────────────────────────────────────

export async function uploadPhoto(
  householdId: string,
  localUri: string,
  path: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const filePath = `households/${householdId}/${path}`;

  const { error } = await supabase.storage
    .from('photos')
    .upload(filePath, blob, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deletePhoto(url: string): Promise<void> {
  const match = url.match(/\/photos\/(.+)$/);
  if (!match) return;
  await supabase.storage.from('photos').remove([match[1]]).catch(() => {});
}
