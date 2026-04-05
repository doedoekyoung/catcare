// src/services/dbService.ts
import { supabase, TABLES } from './supabase';
import type { Cat, Recipe, CheckRecord, DailyLog, Household, User } from '../types';
import { toISOString } from '../utils/date';
import { throttleWrite, LIMITS, truncate } from '../utils/rateLimit';

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
    photoUri: row.photo_uri,
    gender: row.gender,
    tagColor: row.tag_color,
    birthYear: row.birth_year,
    birthMonth: row.birth_month,
    birthDay: row.birth_day,
    metDate: row.met_date,
    notes: row.notes,
    breed: row.breed,
    weight: row.weight,
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
    times: row.times ?? [],
    days: row.days ?? [],
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
    tagColor: row.tag_color,
    householdId: row.household_id,
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Users ──────────────────────────────────────────────────────────────────────

export async function upsertUser(user: User): Promise<void> {
  const { error } = await supabase.from(TABLES.USERS).update({
    email: user.email,
    display_name: user.displayName,
    photo_url: user.photoURL,
    household_id: user.householdId ?? null,
    role: user.role,
  }).eq('uid', user.uid);
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

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data } = await supabase
    .from(TABLES.USERS)
    .select()
    .eq('email', email.toLowerCase().trim())
    .single();
  return data ? toUser(data) : null;
}

// 집사 추가: household.member_ids에 추가 + 상대방 household_id를 이 household로 변경
export async function addMemberToHousehold(
  householdId: string,
  memberUid: string,
  currentMemberIds: string[],
): Promise<void> {
  const { error: hErr } = await supabase
    .from(TABLES.HOUSEHOLDS)
    .update({ member_ids: [...currentMemberIds, memberUid] })
    .eq('id', householdId);
  if (hErr) throw hErr;

  const { error: uErr } = await supabase
    .from(TABLES.USERS)
    .update({ household_id: householdId })
    .eq('uid', memberUid);
  if (uErr) throw uErr;
}

// 집사 제거: household.member_ids에서 삭제 + 상대방 household_id를 본인 소유 household로 복원
export async function removeMemberFromHousehold(
  householdId: string,
  memberUid: string,
  currentMemberIds: string[],
): Promise<void> {
  const { error: hErr } = await supabase
    .from(TABLES.HOUSEHOLDS)
    .update({ member_ids: currentMemberIds.filter((id) => id !== memberUid) })
    .eq('id', householdId);
  if (hErr) throw hErr;

  // 제거된 집사의 household_id를 본인이 owner인 household로 복원
  const { data: ownHousehold } = await supabase
    .from(TABLES.HOUSEHOLDS)
    .select('id')
    .eq('owner_id', memberUid)
    .single();

  const { error: uErr } = await supabase
    .from(TABLES.USERS)
    .update({ household_id: ownHousehold?.id ?? null })
    .eq('uid', memberUid);
  if (uErr) throw uErr;
}

// 여러 uid로 유저 목록 조회 (멤버 표시용)
export async function getUsersByIds(uids: string[]): Promise<User[]> {
  if (uids.length === 0) return [];
  const { data } = await supabase
    .from(TABLES.USERS)
    .select()
    .in('uid', uids);
  return (data ?? []).map(toUser);
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
  if (!throttleWrite(`addCat-${householdId}`)) throw new Error('잠시 후 다시 시도해주세요.');
  const { count } = await supabase.from(TABLES.CATS).select('id', { count: 'exact', head: true }).eq('household_id', householdId);
  if ((count ?? 0) >= LIMITS.MAX_CATS) throw new Error(`고양이는 최대 ${LIMITS.MAX_CATS}마리까지 등록할 수 있습니다.`);
  catData = { ...catData, name: truncate(catData.name, LIMITS.MAX_NAME_LENGTH), notes: catData.notes ? truncate(catData.notes, LIMITS.MAX_TEXT_LENGTH) : undefined };
  const now = toISOString(new Date());
  const { data, error } = await supabase
    .from(TABLES.CATS)
    .insert({
      name: catData.name,
      photo_uri: catData.photoUri ?? null,
      gender: catData.gender ?? null,
      tag_color: catData.tagColor ?? null,
      birth_year: catData.birthYear ?? null,
      birth_month: catData.birthMonth ?? null,
      birth_day: catData.birthDay ?? null,
      notes: catData.notes ?? null,
      breed: catData.breed ?? null,
      weight: catData.weight ?? null,
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
  if (!throttleWrite(`updateCat-${catId}`, 500)) throw new Error('잠시 후 다시 시도해주세요.');
  const update: Record<string, any> = { updated_at: toISOString(new Date()) };
  if (data.name !== undefined) update.name = truncate(data.name, LIMITS.MAX_NAME_LENGTH);
  if (data.photoUri !== undefined) update.photo_uri = data.photoUri;
  if (data.gender !== undefined) update.gender = data.gender;
  if (data.tagColor !== undefined) update.tag_color = data.tagColor;
  if (data.birthYear !== undefined) update.birth_year = data.birthYear;
  if (data.birthMonth !== undefined) update.birth_month = data.birthMonth;
  if (data.birthDay !== undefined) update.birth_day = data.birthDay;
  if (data.metDate !== undefined) update.met_date = data.metDate;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.breed !== undefined) update.breed = data.breed;
  if (data.weight !== undefined) update.weight = data.weight;

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
  if (!throttleWrite(`addRecipe-${householdId}`)) throw new Error('잠시 후 다시 시도해주세요.');
  const { count } = await supabase.from(TABLES.RECIPES).select('id', { count: 'exact', head: true }).eq('household_id', householdId);
  if ((count ?? 0) >= LIMITS.MAX_RECIPES) throw new Error(`루틴은 최대 ${LIMITS.MAX_RECIPES}개까지 등록할 수 있습니다.`);
  data = { ...data, name: truncate(data.name, LIMITS.MAX_NAME_LENGTH) };
  const now = toISOString(new Date());
  const { data: row, error } = await supabase
    .from(TABLES.RECIPES)
    .insert({
      name: data.name,
      time: data.times[0] ?? 'morning',
      times: data.times,
      days: data.days ?? [],
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
  if (!throttleWrite(`updateRecipe-${recipeId}`, 500)) throw new Error('잠시 후 다시 시도해주세요.');
  const update: Record<string, any> = { updated_at: toISOString(new Date()) };
  if (data.name !== undefined) update.name = truncate(data.name, LIMITS.MAX_NAME_LENGTH);
  if (data.times !== undefined) update.times = data.times;
  if (data.days !== undefined) update.days = data.days;
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
  if (!throttleWrite(`upsertCheck-${check.id}`, 500)) return;
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
  if (!throttleWrite(`upsertLog-${householdId}`, 500)) throw new Error('잠시 후 다시 시도해주세요.');
  log = { ...log, text: truncate(log.text, LIMITS.MAX_TEXT_LENGTH) };
  // 새 로그 삽입 시 일일 제한 확인 (기존 로그 수정은 제한하지 않음)
  const { data: existing } = await supabase.from(TABLES.LOGS).select('id').eq('id', log.id).maybeSingle();
  if (!existing) {
    const { count } = await supabase.from(TABLES.LOGS).select('id', { count: 'exact', head: true }).eq('household_id', householdId).eq('date', log.date);
    if ((count ?? 0) >= LIMITS.MAX_LOGS_PER_DAY) throw new Error(`메모는 하루 최대 ${LIMITS.MAX_LOGS_PER_DAY}개까지 등록할 수 있습니다.`);
  }
  const { error } = await supabase.from(TABLES.LOGS).upsert({
    id: log.id,
    date: log.date,
    cat_id: log.catId ?? null,
    text: log.text,
    photo_uri: log.photoUri ?? null,
    tag_color: log.tagColor ?? null,
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
  if (!throttleWrite(`uploadPhoto-${householdId}`, 3000)) throw new Error('잠시 후 다시 시도해주세요.');
  // 경로 조작 방지
  if (path.includes('..')) throw new Error('잘못된 파일 경로입니다.');
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
