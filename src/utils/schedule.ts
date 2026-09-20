// src/utils/schedule.ts
// 루틴이 특정 날짜에 "해당하는가" 판정 — 홈/기록/고양이/공유/통계가 모두 이 함수를 쓴다.

import type { Recipe } from '../types';

export type ScheduleFields = Pick<Recipe, 'days'> & Partial<Pick<Recipe, 'intervalDays' | 'startDate'>>;

export const MIN_INTERVAL_DAYS = 2;
export const MAX_INTERVAL_DAYS = 365;

// 'YYYY-MM-DD' 두 날짜 사이의 일수. UTC 기준이라 DST/타임존 영향이 없다.
export function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

// 'YYYY-MM-DD' 형식이면서 실제 존재하는 날짜인가 (2026-02-30 같은 값 거부)
export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function hasInterval(r: Partial<Pick<Recipe, 'intervalDays' | 'startDate'>>): boolean {
  return (r.intervalDays ?? 0) >= MIN_INTERVAL_DAYS && !!r.startDate;
}

/**
 * dateKey('YYYY-MM-DD')에 루틴이 해당하는지.
 * - N일마다(intervalDays ≥ 2 + startDate): startDate 당일부터 N일 간격. 시작일 이전은 해당 없음.
 * - 그 외: 요일 기반(days). 빈 배열 = 매일.
 * N일마다 설정이 있으면 요일(days)은 무시한다(둘을 조합하지 않음).
 */
export function isScheduledOn(recipe: ScheduleFields, dateKey: string): boolean {
  if (hasInterval(recipe)) {
    const diff = daysBetween(recipe.startDate as string, dateKey);
    return diff >= 0 && diff % (recipe.intervalDays as number) === 0;
  }
  const days = recipe.days ?? [];
  if (days.length === 0) return true;
  return days.includes(new Date(dateKey + 'T00:00:00').getDay());
}

// 카드/목록에 표시할 반복 설명
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function scheduleLabel(recipe: ScheduleFields): string {
  if (hasInterval(recipe)) {
    const n = recipe.intervalDays as number;
    const [, m, d] = (recipe.startDate as string).split('-').map(Number);
    return `${n === 2 ? '격일' : `${n}일마다`} (${m}/${d} 시작)`;
  }
  const days = recipe.days ?? [];
  if (days.length === 0 || days.length === 7) return '매일';
  return '매주 ' + [...days].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join('·');
}
