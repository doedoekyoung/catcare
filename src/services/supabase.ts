// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] 환경변수 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다.');
}

const authStorage =
  Platform.OS === 'web'
    ? undefined // 웹은 localStorage 기본 사용
    : {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      };

// 단일 탭 안에서만 직렬화하는 가벼운 in-memory lock.
// supabase-js 기본 lock은 navigator.locks 기반인데, 새로고침 직후 stale token
// 갱신이 무한 대기하면서 lock을 잡아 onAuthStateChange / signOut / signIn 모두
// hang시키는 회귀가 있어 교체. multi-tab 동기화는 포기하는 trade-off.
const _memLocks = new Map<string, Promise<unknown>>();
const memoryLock = async <R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const prev = (_memLocks.get(name) ?? Promise.resolve()) as Promise<unknown>;
  const next = prev.then(fn, fn);
  _memLocks.set(name, next.catch(() => undefined));
  return next as Promise<R>;
};

// ── 요청 타임아웃 ─────────────────────────────────────────────────────────────
// supabase-js는 fetch 타임아웃이 없어서, 만료 토큰 refresh 요청이 응답 없이 멈추면
// 위 lock이 영구히 잡혀 signOut / 로그인 / 모든 DB 쿼리가 함께 멈춘다.
const AUTH_TIMEOUT_MS = 10_000; // refresh 포함. 느린 회선의 정상 refresh를 오탐 로그아웃하지 않도록 여유
const REST_TIMEOUT_MS = 15_000;
const STORAGE_TIMEOUT_MS = 60_000; // 사진 업로드는 오래 걸릴 수 있음

function timeoutFor(url: string): number {
  if (url.includes('/auth/v1/')) return AUTH_TIMEOUT_MS;
  if (url.includes('/storage/v1/')) return STORAGE_TIMEOUT_MS;
  return REST_TIMEOUT_MS;
}

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutFor(url));
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort());
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    // refresh가 타임아웃되면 "재시도 불가" 응답으로 바꿔 돌려준다. auth-js는 재시도 가능
    // 에러면 최대 ~30초 동안 lock을 쥔 채 재시도하지만, 재시도 불가 에러면 세션을 제거하고
    // 즉시 lock을 놓는다 → 로그인 화면으로 바로 복귀.
    if (timedOut && url.includes('grant_type=refresh_token')) {
      return new Response(
        JSON.stringify({ error: 'refresh_timeout', error_code: 'refresh_timeout', msg: 'Refresh token request timed out' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: memoryLock,
  },
});

// supabase-js 기본 storageKey (`sb-<프로젝트ref>-auth-token`)와 동일하게 계산.
const authStorageKey = `sb-${(supabaseUrl.match(/^https?:\/\/([^./]+)/)?.[1]) ?? 'unknown'}-auth-token`;

// 저장된 세션을 auth-js/lock을 거치지 않고 직접 삭제한다.
// signOut({scope:'local'})은 삭제 전에 만료 세션 refresh(네트워크)를 먼저 시도하고 lock도
// 필요해서, 바로 그 상황(멈춘 refresh)에서 같이 멈춘다. 이 함수는 네트워크/lock과 무관.
export async function removeStoredSession(): Promise<void> {
  const keys = [authStorageKey, `${authStorageKey}-user`, `${authStorageKey}-code-verifier`];
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') keys.forEach((k) => localStorage.removeItem(k));
    } else {
      await AsyncStorage.multiRemove(keys);
    }
  } catch {}
}

// RN(Expo) — 백그라운드일 땐 자동 refresh를 멈추고 포그라운드 복귀 시 재개.
// 웹은 supabase-js가 Page Visibility API로 자동 처리하므로 불필요.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export const TABLES = {
  USERS: 'users',
  HOUSEHOLDS: 'households',
  CATS: 'cats',
  RECIPES: 'recipes',
  CHECKS: 'check_records',
  LOGS: 'daily_logs',
} as const;
