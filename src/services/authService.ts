// src/services/authService.ts
import { supabase } from './supabase';
import { upsertUser, getUserById } from './dbService';
import type { User } from '../types';

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('회원가입에 실패했습니다.');

  const user: User = {
    uid: data.user.id,
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('로그인에 실패했습니다.');

  const user = await getUserById(data.user.id);
  if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.');
  return user;
}

export async function signOut(): Promise<void> {
  clearUserCache();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// 로컬 세션만 초기화 (서버 세션 유지 → 재로그인 시 데이터 안전)
// 만료된 토큰이 걸려있을 때 사용
export async function clearLocalSession(): Promise<void> {
  clearUserCache();
  try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
}

const USER_CACHE_KEY = '_cc_user';

// 메모리 캐시 — 모바일(localStorage 없음)에서도 세션 중 복구 가능
let _memCache: User | null = null;

function saveUserCache(user: User): void {
  _memCache = user;
  try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)); } catch {}
}

function clearUserCache(): void {
  _memCache = null;
  try { localStorage.removeItem(USER_CACHE_KEY); } catch {}
}

function readUserCache(uid: string): User | null {
  if (_memCache?.uid === uid) return _memCache;
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as User;
    return u.uid === uid ? u : null;
  } catch { return null; }
}

export function subscribeToAuthState(
  cb: (user: User | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (!session?.user) { cb(null); return; }
      try {
        const user = await getUserById(session.user.id);
        if (user) {
          saveUserCache(user);
          cb(user);
        } else {
          cb(readUserCache(session.user.id));
        }
      } catch {
        cb(readUserCache(session.user.id));
      }
    }
  );
  return () => subscription.unsubscribe();
}

export async function signInAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
