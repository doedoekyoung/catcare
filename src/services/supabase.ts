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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: memoryLock,
  },
});

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
