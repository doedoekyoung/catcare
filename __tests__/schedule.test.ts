import { isScheduledOn, daysBetween, isValidDateKey, scheduleLabel } from '../src/utils/schedule';

describe('isScheduledOn — 요일/매일 (기존 동작 유지)', () => {
  test('빈 배열 = 매일', () => {
    expect(isScheduledOn({ days: [] }, '2026-09-20')).toBe(true);
    expect(isScheduledOn({ days: [] }, '2026-12-31')).toBe(true);
  });

  test('요일 지정 — 2026-09-20은 일요일(0)', () => {
    expect(isScheduledOn({ days: [0] }, '2026-09-20')).toBe(true);
    expect(isScheduledOn({ days: [1, 3] }, '2026-09-20')).toBe(false);
    expect(isScheduledOn({ days: [1, 3] }, '2026-09-21')).toBe(true); // 월
  });

  test('intervalDays/startDate가 없는(구버전) 데이터도 동일하게 동작', () => {
    expect(isScheduledOn({ days: [6], intervalDays: null, startDate: null }, '2026-09-19')).toBe(true); // 토
    expect(isScheduledOn({ days: [6], intervalDays: undefined }, '2026-09-20')).toBe(false);
  });
});

describe('isScheduledOn — N일마다', () => {
  const every2 = { days: [], intervalDays: 2, startDate: '2026-09-20' };

  test('격일: 시작일 당일과 이틀 간격만 해당', () => {
    expect(isScheduledOn(every2, '2026-09-20')).toBe(true);
    expect(isScheduledOn(every2, '2026-09-21')).toBe(false);
    expect(isScheduledOn(every2, '2026-09-22')).toBe(true);
    expect(isScheduledOn(every2, '2026-09-23')).toBe(false);
    expect(isScheduledOn(every2, '2026-09-24')).toBe(true);
  });

  test('시작일 이전은 해당 없음 (간격이 맞아떨어져도)', () => {
    expect(isScheduledOn(every2, '2026-09-19')).toBe(false);
    expect(isScheduledOn(every2, '2026-09-18')).toBe(false); // 시작일 -2 → 간격은 맞지만 이전
    expect(isScheduledOn(every2, '2026-01-01')).toBe(false);
  });

  test('3일마다 / 7일마다', () => {
    const every3 = { days: [], intervalDays: 3, startDate: '2026-09-20' };
    expect([20, 21, 22, 23, 24, 25, 26].map((d) => isScheduledOn(every3, `2026-09-${d}`)))
      .toEqual([true, false, false, true, false, false, true]);
    const every7 = { days: [], intervalDays: 7, startDate: '2026-09-20' };
    expect(isScheduledOn(every7, '2026-09-27')).toBe(true);
    expect(isScheduledOn(every7, '2026-09-26')).toBe(false);
  });

  test('월/연 경계를 넘어도 간격 유지 (2026-09-29 시작 격일)', () => {
    const r = { days: [], intervalDays: 2, startDate: '2026-09-29' };
    expect(isScheduledOn(r, '2026-10-01')).toBe(true);
    expect(isScheduledOn(r, '2026-10-02')).toBe(false);
    const ny = { days: [], intervalDays: 2, startDate: '2026-12-30' };
    expect(isScheduledOn(ny, '2027-01-01')).toBe(true);
    expect(isScheduledOn(ny, '2027-01-02')).toBe(false);
  });

  test('윤년 2월 (2028-02-28 시작 격일 → 02-29 아님, 03-01 해당)', () => {
    const r = { days: [], intervalDays: 2, startDate: '2028-02-28' };
    expect(isScheduledOn(r, '2028-02-29')).toBe(false);
    expect(isScheduledOn(r, '2028-03-01')).toBe(true);
  });

  test('DST 전환 구간(미국 2026-03-08)에서도 어긋나지 않음', () => {
    const r = { days: [], intervalDays: 2, startDate: '2026-03-07' };
    expect(isScheduledOn(r, '2026-03-09')).toBe(true);
    expect(isScheduledOn(r, '2026-03-08')).toBe(false);
  });

  test('N일마다가 있으면 요일(days)은 무시', () => {
    // 2026-09-22는 화요일(2) — days=[1]이어도 간격 기준으로 해당
    expect(isScheduledOn({ days: [1], intervalDays: 2, startDate: '2026-09-20' }, '2026-09-22')).toBe(true);
  });

  test('startDate 없이 intervalDays만 있으면 안전하게 요일 로직으로 폴백', () => {
    expect(isScheduledOn({ days: [], intervalDays: 2, startDate: null }, '2026-09-21')).toBe(true);
  });

  test('intervalDays 1 이하는 N일마다로 취급하지 않음(매일과 동일)', () => {
    expect(isScheduledOn({ days: [], intervalDays: 1, startDate: '2026-09-20' }, '2026-09-21')).toBe(true);
  });
});

describe('유틸', () => {
  test('daysBetween', () => {
    expect(daysBetween('2026-09-20', '2026-09-20')).toBe(0);
    expect(daysBetween('2026-09-20', '2026-09-23')).toBe(3);
    expect(daysBetween('2026-09-23', '2026-09-20')).toBe(-3);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  test('isValidDateKey', () => {
    expect(isValidDateKey('2026-09-20')).toBe(true);
    expect(isValidDateKey('2028-02-29')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-9-20')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });

  test('scheduleLabel', () => {
    expect(scheduleLabel({ days: [] })).toBe('매일');
    expect(scheduleLabel({ days: [1, 3, 5] })).toBe('매주 월·수·금');
    expect(scheduleLabel({ days: [], intervalDays: 2, startDate: '2026-09-20' })).toBe('격일 (9/20 시작)');
    expect(scheduleLabel({ days: [], intervalDays: 3, startDate: '2026-10-05' })).toBe('3일마다 (10/5 시작)');
  });
});
