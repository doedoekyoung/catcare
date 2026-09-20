// src/services/authService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, removeStoredSession } from './supabase';
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
  await clearUserCache();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// 로컬 세션만 초기화 (서버 세션 유지 → 재로그인 시 데이터 안전)
// 만료된 토큰이 걸려있을 때 사용.
// signOut({scope:'local'})을 쓰지 않는다: 삭제 전에 refresh 네트워크 호출과 auth lock이
// 필요해서, refresh가 멈춘 상황에선 이 함수도 같이 멈춘다. 저장소를 직접 지운다.
export async function clearLocalSession(): Promise<void> {
  await clearUserCache();
  await removeStoredSession();
}

const USER_CACHE_KEY = '_cc_user';

// 메모리 캐시 + AsyncStorage(웹에선 localStorage로 동작) 영속 캐시.
// 네이티브는 콜드 스타트마다 메모리 캐시가 비므로, 프로필 조회가 일시 실패해도
// 홈을 유지할 수 있게 영속 캐시가 필요하다.
let _memCache: User | null = null;

function saveUserCache(user: User): void {
  _memCache = user;
  AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
}

async function clearUserCache(): Promise<void> {
  _memCache = null;
  try { await AsyncStorage.removeItem(USER_CACHE_KEY); } catch {}
}

async function readUserCache(uid: string): Promise<User | null> {
  if (_memCache?.uid === uid) return _memCache;
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as User;
    return u.uid === uid ? u : null;
  } catch { return null; }
}

// 프로필 조회 재시도 간격(ms). 누적 ~7.8초 — AppNavigator의 10초 fallback 안에서 끝나도록.
const PROFILE_RETRY_DELAYS_MS = [0, 800, 2000, 5000];
const PROFILE_ATTEMPT_TIMEOUT_MS = 6000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function subscribeToAuthState(
  cb: (user: User | null) => void
): () => void {
  // 이벤트가 겹칠 때(INITIAL_SESSION + TOKEN_REFRESHED 등) 늦게 끝난 이전 처리가
  // 최신 결과를 덮어쓰지 않도록 최신 이벤트만 반영한다.
  let seq = 0;
  // 마지막으로 앱에 전달한 사용자. 같은 사용자의 TOKEN_REFRESHED / SIGNED_IN(탭 복귀 등)은
  // 프로필 재조회와 전 구독 재생성(=DB 재조회 5회)을 유발하므로 건너뛴다.
  let delivered: User | null = null;

  const deliver = (user: User | null) => { delivered = user; cb(user); };

  const handleSession = async (uid: string, mySeq: number) => {
    let user: User | null = null;
    let missingCount = 0; // 요청은 성공했지만 행이 없었던 횟수
    let requestFailed = false; // 마지막 시도가 요청 실패(네트워크/JWT/타임아웃)였는가

    for (const delay of PROFILE_RETRY_DELAYS_MS) {
      if (delay) await sleep(delay);
      if (mySeq !== seq) return;
      try {
        user = await withTimeout(getUserById(uid), PROFILE_ATTEMPT_TIMEOUT_MS);
        requestFailed = false;
        if (user) break;
        // 요청은 성공했는데 행이 없음 — 신규가입 트리거 race 흡수용으로 1회만 더 시도.
        if (++missingCount >= 2) break;
      } catch {
        requestFailed = true;
      }
    }
    if (mySeq !== seq) return;

    if (user) {
      saveUserCache(user);
      deliver(user);
      return;
    }

    if (!requestFailed) {
      // 서버가 "프로필 행 없음"이라고 확정 응답 — 이 경우에만 stale 세션으로 판정해 정리.
      await clearUserCache();
      await removeStoredSession();
      if (mySeq !== seq) return;
      deliver(null);
      return;
    }

    // 요청이 계속 실패(오프라인/서버 장애) — 세션은 지우지 않는다(refresh token은 유효할 수 있음).
    // 캐시가 있으면 그걸로 진행하고, 없으면 로그인 화면으로 보내되 세션은 보존.
    // 이후 네트워크가 돌아와 TOKEN_REFRESHED 등이 오면 이 함수가 다시 실행돼 복구된다.
    const cached = await readUserCache(uid);
    if (mySeq !== seq) return;
    deliver(cached);
  };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    // ⚠️ 이 콜백은 supabase-js가 auth lock을 쥔 채로 호출한다(refresh 직후 TOKEN_REFRESHED 등).
    // 여기서 supabase 호출(DB 조회 등)을 await하면 getSession()이 같은 lock을 기다려
    // 데드락이 되고, refresh는 성공했는데 앱은 영원히 진행하지 못한다.
    // 그래서 콜백은 동기로 두고 실제 작업은 setTimeout으로 lock 밖에서 실행한다.
    (event, session) => {
      const mySeq = ++seq;

      // 명시적 로그아웃 or 세션 없음 → 캐시 정리 후 로그인 화면
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session?.user) {
        void clearUserCache();
        deliver(null);
        return;
      }

      const uid = session.user.id;
      if (delivered?.uid === uid && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        return; // 이미 같은 사용자로 진행 중 — 재조회/재구독 불필요
      }

      setTimeout(() => { void handleSession(uid, mySeq); }, 0);
    }
  );
  return () => subscription.unsubscribe();
}
