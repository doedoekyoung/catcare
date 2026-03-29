// src/utils/date.ts

import { format, parseISO, isToday, isYesterday, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';

export function toDateKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function toISOString(date: Date): string {
  return date.toISOString();
}

export function formatDisplayDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return '오늘';
  if (isYesterday(d)) return '어제';
  return format(d, 'M월 d일 (EEE)', { locale: ko });
}

export function formatFullDate(dateStr: string): string {
  return format(parseISO(dateStr), 'yyyy년 M월 d일 (EEEE)', { locale: ko });
}

export function formatTime(isoStr: string): string {
  return format(parseISO(isoStr), 'HH:mm');
}

export function calcStreak(
  checks: Record<string, unknown>,
  logs: { date: string }[]
): number {
  let streak = 0;
  const logDates = new Set(logs.map((l) => l.date));
  const checkDates = new Set(
    Object.values(checks).map((c: any) => c?.date).filter(Boolean)
  );
  const today = new Date();
  while (true) {
    const key = toDateKey(today);
    today.setDate(today.getDate() - 1);
    if (checkDates.has(key) || logDates.has(key)) {
      streak++;
    } else {
      break;
    }
    if (streak > 365) break;
  }
  return streak;
}

export function getLast30Days(): string[] {
  const result: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(toDateKey(d));
  }
  return result;
}

export function getDateRangeLabel(start: string, end: string): string {
  return `${format(parseISO(start), 'M/d')} ~ ${format(parseISO(end), 'M/d')}`;
}
