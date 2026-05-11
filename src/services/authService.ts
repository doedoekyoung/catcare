// src/services/authService.ts
import { supabase } from './supabase';
import { upsertUser, getUserById } from './dbService';
import type { User } from '../types';

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  // signUp 시 display_name을 메타데이터로 전달 → DB 트리거가 public.users 자동 생성
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  if (!data.user) throw new Error('회원가입에 실패했습니다.');

  // signUp이 세션을 반환하지 않으면 명시적으로 로그인
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }

  return {
    uid: data.user.id,
    email,
    displayName,
    role: 'owner',
  };
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
    async (event, session) => {
      // 명시적 로그아웃 or 세션 없음 → 캐시 정리 후 로그인 화면
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session?.user) {
        clearUserCache();
        cb(null);
        return;
      }
      try {
        // 일시적 fetch 실패/RLS 지연/신규가입 트리거 race를 흡수하기 위해 1회 재시도
        let user = await getUserById(session.user.id);
        if (!user) {
          await new Promise((r) => setTimeout(r, 800));
          user = await getUserById(session.user.id);
        }
        if (user) {
          saveUserCache(user);
          cb(user);
        } else {
          // 재시도해도 없음 → 우선 캐시로 버티고, 캐시도 없을 때만 stale 판정
          const cached = readUserCache(session.user.id);
          if (cached) {
            cb(cached);
          } else {
            clearUserCache();
            await supabase.auth.signOut({ scope: 'local' });
            cb(null);
          }
        }
      } catch (e: any) {
        // 인증 오류(401/JWT) → stale 토큰 자동 제거
        const isAuthError =
          e?.status === 401 ||
          String(e?.message ?? '').toLowerCase().includes('jwt') ||
          String(e?.message ?? '').toLowerCase().includes('token') ||
          e?.code === 'PGRST301';
        if (isAuthError) {
          clearUserCache();
          await supabase.auth.signOut({ scope: 'local' });
          cb(null);
        } else {
          // 네트워크 오류 등 일시적 오류 → 캐시로 유지
          cb(readUserCache(session.user.id));
        }
      }
    }
  );
  return () => subscription.unsubscribe();
}

