// src/utils/rateLimit.ts
// 클라이언트 레벨 어뷰징 방지

/**
 * 쓰기 작업 throttle — 같은 키에 대해 minInterval(ms) 내 중복 호출 차단
 */
const lastCall: Record<string, number> = {};

export function throttleWrite(key: string, minInterval = 1000): boolean {
  const now = Date.now();
  if (now - (lastCall[key] ?? 0) < minInterval) return false;
  lastCall[key] = now;
  return true;
}

/**
 * 데이터 제한 상수
 */
export const LIMITS = {
  MAX_CATS: 20,
  MAX_RECIPES: 50,
  MAX_LOGS_PER_DAY: 5,
  MAX_TEXT_LENGTH: 500,
  MAX_NAME_LENGTH: 30,
  MAX_MEMO_LENGTH: 200,
} as const;

/**
 * 텍스트 길이 제한 (초과 시 잘라냄)
 */
export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}
