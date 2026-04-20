// src/screens/RecordsScreen.tsx
// REQ-M08~M10, V4-02, V4-05, V5-03~04

import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { EmptyState } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { getLast30Days, toDateKey } from '../utils/date';
import { getChecksForDateRange, getLogsForDateRange } from '../services/dbService';

const TAG_OPTIONS = [
  { value: '#EF4444', label: '응급' },
  { value: '#F97316', label: '위험' },
  { value: '#EAB308', label: '주의' },
  { value: '#22C55E', label: '안정' },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = WEEKDAYS[d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${day}요일`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

function toCalKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function RecordsScreen() {
  const { cats, recipes, checks, logs, household } = useStore();
  const [activeTab, setActiveTab] = useState<'records' | 'posts'>('records');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string | null>(null);

  // 과거 30일 체크 기록 (DB에서 직접 로드)
  const [historyChecks, setHistoryChecks] = useState<import('../types').CheckRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<import('../types').DailyLog[]>([]);
  useEffect(() => {
    if (!household?.id) return;
    const startDate = getLast30Days()[0];
    getChecksForDateRange(household.id, startDate, today)
      .then(setHistoryChecks)
      .catch(() => {});
    getLogsForDateRange(household.id, startDate, today)
      .then(setHistoryLogs)
      .catch(() => {});
  }, [household?.id]);

  // 과거 기록 + 오늘 실시간 데이터 병합
  const allChecks = useMemo(() => {
    const map: Record<string, import('../types').CheckRecord> = {};
    historyChecks.forEach((c) => { map[c.id] = c; });
    Object.values(checks).forEach((c) => { if (c) map[c.id] = c; });
    return map;
  }, [historyChecks, checks]);

  // 전체 로그 (DB 과거 + store 오늘) 병합
  const allLogs = useMemo(() => {
    const map: Record<string, import('../types').DailyLog> = {};
    historyLogs.forEach((l) => { map[l.id] = l; });
    logs.forEach((l) => { map[l.id] = l; });
    return Object.values(map);
  }, [historyLogs, logs]);

  // Posts calendar state
  const nowDate = new Date();
  const [calYear, setCalYear] = useState(nowDate.getFullYear());
  const [calMonth, setCalMonth] = useState(nowDate.getMonth()); // 0-indexed
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  const today = toDateKey();

  // 예외 중심: 미완료 루틴이 있거나 메모가 있는 날짜만
  const issueDates = useMemo(() => {
    const last30 = getLast30Days();
    return last30.filter((date) => {
      // 이 날짜에 메모가 있는지
      const hasLog = allLogs.some((l) => {
        if (l.date !== date) return false;
        if (selectedCatFilter && l.catId && l.catId !== selectedCatFilter) return false;
        return true;
      });
      if (hasLog) return true;
      // 이 날짜에 미완료 루틴이 있는지 (스케줄된 루틴 중 체크 없거나 done=false)
      const d = new Date(date + 'T00:00:00');
      const dayOfWeek = d.getDay();
      const activeR = recipes.filter((r) => {
        if (!r.active) return false;
        if (selectedCatFilter && !r.catIds.includes(selectedCatFilter)) return false;
        return r.days.length === 0 || r.days.includes(dayOfWeek);
      });
      return activeR.some((r) =>
        !r.catIds.some((catId) =>
          r.times.some((t) => allChecks[`${date}_${r.id}_${catId}_${t}`]?.done)
        )
      );
    }).sort((a, b) => b.localeCompare(a));
  }, [allChecks, allLogs, recipes, selectedCatFilter]);

  // 타임라인 아이템: 오늘은 항상 표시 + 이슈 날짜 + 사이 이슈없음 묶음
  type TLItem =
    | { type: 'issue'; date: string }
    | { type: 'clean'; dates: string[] };

  const timelineItems = useMemo<TLItem[]>(() => {
    const issueSet = new Set(issueDates);
    issueSet.add(today); // 오늘은 항상 표시
    const last30 = [...getLast30Days()].reverse(); // 최신순
    const items: TLItem[] = [];
    let cleanBuf: string[] = [];
    for (const date of last30) {
      if (issueSet.has(date)) {
        if (cleanBuf.length > 0) {
          items.push({ type: 'clean', dates: cleanBuf });
          cleanBuf = [];
        }
        items.push({ type: 'issue', date });
      } else {
        cleanBuf.push(date);
      }
    }
    if (cleanBuf.length > 0) items.push({ type: 'clean', dates: cleanBuf });
    return items;
  }, [issueDates, today]);

  // Logs indexed by date (multiple per day) — for calendar
  const logsByDate = useMemo(() => {
    const map: Record<string, typeof allLogs> = {};
    allLogs.forEach((l) => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [allLogs]);

  // Calendar cells for current month
  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfWeek(calYear, calMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  const prevCalMonth = () => {
    setSelectedCalDate(null);
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };

  const nextCalMonth = () => {
    setSelectedCalDate(null);
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const selectedLogs = selectedCalDate ? (logsByDate[selectedCalDate] ?? []) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록 보기</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'records' && styles.tabActive]}
          onPress={() => setActiveTab('records')}
        >
          <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>달력</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'records' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Cat filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.filterChip, selectedCatFilter === null && styles.filterChipSel]}
                onPress={() => setSelectedCatFilter(null)}
              >
                <Text style={[styles.filterChipText, selectedCatFilter === null && styles.filterChipTextSel]}>전체</Text>
              </TouchableOpacity>
              {cats.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.filterChip, selectedCatFilter === c.id && styles.filterChipSel]}
                  onPress={() => setSelectedCatFilter(c.id)}
                >
                  <Text style={[styles.filterChipText, selectedCatFilter === c.id && styles.filterChipTextSel]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {issueDates.length === 0 && (
            <EmptyState
              emoji="✓"
              title="최근 30일 이슈 없음"
              desc="미완료 루틴이나 메모가 없어요."
            />
          )}

          {timelineItems.map((item, idx) => {
            if (item.type === 'clean') {
              const { dates } = item;
              const label = dates.length === 1
                ? shortDate(dates[0])
                : `${shortDate(dates[dates.length - 1])} ~ ${shortDate(dates[0])}`;
              return (
                <View key={`clean-${idx}`} style={styles.cleanRow}>
                  <Text style={styles.cleanText}>{label}</Text>
                  <Text style={styles.cleanMark}>이슈 없음 ✓</Text>
                </View>
              );
            }

            const { date } = item;
            const d = new Date(date + 'T00:00:00');
            const dayOfWeek = d.getDay();

            const dayLogs = allLogs.filter((l) => {
              if (l.date !== date) return false;
              if (selectedCatFilter && l.catId && l.catId !== selectedCatFilter) return false;
              return true;
            });

            const missedItems: { recipeName: string; catName: string }[] = [];
            recipes.forEach((r) => {
              if (!r.active) return;
              if (selectedCatFilter && !r.catIds.includes(selectedCatFilter)) return;
              const scheduled = (r.days ?? []).length === 0 || (r.days ?? []).includes(dayOfWeek);
              if (!scheduled) return;
              r.catIds.forEach((catId) => {
                if (selectedCatFilter && catId !== selectedCatFilter) return;
                const done = r.times.some((t) => allChecks[`${date}_${r.id}_${catId}_${t}`]?.done);
                if (!done) {
                  missedItems.push({ recipeName: r.name, catName: cats.find((c) => c.id === catId)?.name ?? '' });
                }
              });
            });

            return (
              <View key={date} style={[styles.logEntry, shadow.sm]}>
                <View style={styles.logDateHeader}>
                  <Text style={styles.logDateText}>{formatDisplayDate(date)}</Text>
                  {date === today && (
                    <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>오늘</Text></View>
                  )}
                </View>
                <View style={styles.logContent}>
                  {dayLogs.length === 0 && missedItems.length === 0 && (
                    <Text style={styles.cleanDayText}>이상없음</Text>
                  )}
                  {dayLogs.map((l) => {
                    const tagLabel = TAG_OPTIONS.find((t) => t.value === l.tagColor)?.label ?? '';
                    const logCat = l.catId ? cats.find((c) => c.id === l.catId) : null;
                    return (
                      <View key={l.id} style={styles.logMemoBlock}>
                        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                          {l.tagColor && (
                            <View style={[styles.logTagBadge, { backgroundColor: l.tagColor + '20', borderColor: l.tagColor }]}>
                              <View style={[styles.logTagDot, { backgroundColor: l.tagColor }]} />
                              <Text style={[styles.logTagText, { color: l.tagColor }]}>{tagLabel}</Text>
                            </View>
                          )}
                          {logCat && (
                            <View style={[styles.logTagBadge, { backgroundColor: (logCat.tagColor ?? colors.caramel) + '20', borderColor: logCat.tagColor ?? colors.caramel }]}>
                              <View style={[styles.logTagDot, { backgroundColor: logCat.tagColor ?? colors.caramel }]} />
                              <Text style={[styles.logTagText, { color: logCat.tagColor ?? colors.caramel }]}>{logCat.name}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.logText}>{l.text}</Text>
                      </View>
                    );
                  })}
                  {missedItems.map((item, i) => (
                    <View key={i} style={styles.missedItem}>
                      <Text style={styles.missedMark}>✗</Text>
                      <Text style={styles.missedText}>
                        <Text style={styles.missedCat}>{item.catName}</Text>
                        {'  '}{item.recipeName}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Month navigation */}
          <View style={styles.calHeader}>
            <TouchableOpacity style={styles.calNavBtn} onPress={prevCalMonth}>
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>{calYear}년 {MONTHS_KR[calMonth]}</Text>
            <TouchableOpacity style={styles.calNavBtn} onPress={nextCalMonth}>
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Tag legend */}
          <View style={styles.legendRow}>
            {TAG_OPTIONS.map((t) => (
              <View key={t.value} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: t.value }]} />
                <Text style={styles.legendText}>{t.label}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.caramel }]} />
              <Text style={styles.legendText}>메모</Text>
            </View>
          </View>

          {/* Calendar grid */}
          <View style={styles.calGrid}>
            {/* Weekday headers */}
            {WEEKDAYS.map((w, i) => (
              <View key={w} style={styles.calDayHeader}>
                <Text style={[styles.calDayHeaderText, i === 0 && { color: '#EF4444' }, i === 6 && { color: '#3B82F6' }]}>
                  {w}
                </Text>
              </View>
            ))}
            {/* Day cells */}
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.calCell} />;
              }
              const dateKey = toCalKey(calYear, calMonth, day);
              const dateLogs = logsByDate[dateKey] ?? [];
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedCalDate;
              const dayOfWeek = (getFirstDayOfWeek(calYear, calMonth) + day - 1) % 7;

              return (
                <TouchableOpacity
                  key={dateKey}
                  style={[
                    styles.calCell,
                    isSelected && { backgroundColor: colors.caramel + '20' },
                    isToday && styles.calCellToday,
                  ]}
                  onPress={() => setSelectedCalDate(isSelected ? null : dateKey)}
                  activeOpacity={dateLogs.length > 0 ? 0.7 : 1}
                >
                  <Text style={[
                    styles.calDayNum,
                    isToday && styles.calDayNumToday,
                    dayOfWeek === 0 && { color: '#EF4444' },
                    dayOfWeek === 6 && { color: '#3B82F6' },
                  ]}>
                    {day}
                  </Text>
                  {dateLogs.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 2, justifyContent: 'center' }}>
                      {dateLogs.slice(0, 3).map((log) => (
                        <View key={log.id} style={[styles.calDot, { backgroundColor: log.tagColor ?? colors.caramel }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day logs */}
          {selectedCalDate && (
            <View style={[styles.selectedLogCard, shadow.sm]}>
              <View style={styles.selectedLogHeader}>
                <Text style={styles.selectedLogDate}>{formatDisplayDate(selectedCalDate)}</Text>
              </View>
              {selectedLogs.length > 0 ? (
                selectedLogs.map((log) => {
                  const tagOption = log.tagColor ? TAG_OPTIONS.find((t) => t.value === log.tagColor) : null;
                  const logCat = log.catId ? cats.find((c) => c.id === log.catId) : null;
                  return (
                    <View key={log.id} style={selectedLogs.length > 1 ? { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0e8df' } : undefined}>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        {tagOption && (
                          <View style={[styles.logTagBadge, { backgroundColor: tagOption.value + '20', borderColor: tagOption.value }]}>
                            <View style={[styles.logTagDot, { backgroundColor: tagOption.value }]} />
                            <Text style={[styles.logTagText, { color: tagOption.value }]}>{tagOption.label}</Text>
                          </View>
                        )}
                        {logCat && (
                          <View style={[styles.logTagBadge, { backgroundColor: (logCat.tagColor ?? colors.caramel) + '20', borderColor: logCat.tagColor ?? colors.caramel }]}>
                            <View style={[styles.logTagDot, { backgroundColor: logCat.tagColor ?? colors.caramel }]} />
                            <Text style={[styles.logTagText, { color: logCat.tagColor ?? colors.caramel }]}>{logCat.name}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.selectedLogText}>{log.text}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.selectedLogEmpty}>이 날의 메모가 없어요</Text>
              )}
            </View>
          )}

          {logs.length === 0 && (
            <EmptyState
              title="아직 포스트가 없어요"
              desc="홈 화면에서 오늘의 메모를 작성하면 여기에 표시돼요"
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, height: 56,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: colors.border,
    backgroundColor: colors.warmWhite,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.caramel },
  tabText: { fontSize: 14, color: colors.muted },
  tabTextActive: { color: colors.caramel, fontWeight: '600' },
  content: { padding: spacing.lg, paddingBottom: 80 },
  filterChip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border,
  },
  filterChipSel: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  filterChipText: { fontSize: 13, color: colors.brownMid },
  filterChipTextSel: { color: '#fff' },
  logEntry: {
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden',
  },
  logDateHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.cream, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  logDateText: { fontSize: 13, color: colors.muted, flex: 1 },
  todayBadge: {
    backgroundColor: colors.caramel, paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.full,
  },
  todayBadgeText: { fontSize: 11, color: '#fff' },
  logContent: { padding: 14 },
  logMemoBlock: { marginBottom: 10 },
  missedItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  missedMark: { fontSize: 14, color: '#EF4444', fontWeight: '700', width: 16 },
  missedText: { fontSize: 13, color: colors.charcoal, flex: 1 },
  missedCat: { color: colors.caramel, fontWeight: '600' },
  logTagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 6,
  },
  logTagDot: { width: 8, height: 8, borderRadius: 4 },
  logTagText: { fontSize: 11, fontWeight: '600' },
  logText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  cleanDayText: { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  cleanRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8,
  },
  cleanText: { fontSize: 12, color: colors.muted },
  cleanMark: { fontSize: 12, fontWeight: '700', color: '#22C55E' },
  // Calendar styles
  calHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  calNavBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cream, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
  },
  calNavText: { fontSize: 20, color: colors.brownMid, lineHeight: 24 },
  calMonthLabel: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
  legendRow: {
    flexDirection: 'row', gap: 12, marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.muted },
  calGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    overflow: 'hidden', backgroundColor: '#fff', marginBottom: spacing.lg,
  },
  calDayHeader: {
    width: '14.285714%', alignItems: 'center', paddingVertical: 8,
    backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  calDayHeaderText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  calCell: {
    width: '14.285714%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    padding: 2, borderWidth: 0.5, borderColor: colors.border + '40',
  },
  calCellToday: { backgroundColor: colors.caramel + '10' },
  calDayNum: { fontSize: 13, color: colors.charcoal },
  calDayNumToday: { fontWeight: '800', color: colors.caramel },
  calDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  selectedLogCard: {
    backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg,
  },
  selectedLogHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  selectedLogDate: { fontSize: 13, color: colors.brownMid, fontWeight: '600' },
  selectedLogText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  selectedLogEmpty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 8 },
});
