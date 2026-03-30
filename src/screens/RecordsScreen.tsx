// src/screens/RecordsScreen.tsx
// REQ-M08~M10, V4-02, V4-05, V5-03~04

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectWeeklyStats } from '../store/useStore';
import { Button, Card, SectionTitle, EmptyState } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { formatDisplayDate, getLast30Days, toDateKey } from '../utils/date';
import { exportAsPDF } from '../services/exportService';
import { getChecksForDateRange, getLogsForDateRange } from '../services/dbService';

const TAG_OPTIONS = [
  { value: '#EF4444', label: '응급' },
  { value: '#F97316', label: '위험' },
  { value: '#EAB308', label: '모니터링' },
  { value: '#22C55E', label: '안정' },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

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
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string | null>(null);

  // Posts calendar state
  const nowDate = new Date();
  const [calYear, setCalYear] = useState(nowDate.getFullYear());
  const [calMonth, setCalMonth] = useState(nowDate.getMonth()); // 0-indexed
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  const today = toDateKey();

  // Collect all dates that have activity
  const activeDates = useMemo(() => {
    const dates = new Set<string>();
    Object.values(checks).forEach((c) => c?.date && dates.add(c.date));
    logs.forEach((l) => dates.add(l.date));
    return [...dates].sort((a, b) => b.localeCompare(a));
  }, [checks, logs]);

  // Weekly stats for chart
  const weeklyStats = useMemo(
    () => selectWeeklyStats(recipes, checks, cats),
    [recipes, checks, cats]
  );

  // Insight counts
  const todayChecks = Object.values(checks).filter((c) => c?.date === today && c?.done);
  const activeRecipes = recipes.filter((r) => r.active);
  const streakDays = useMemo(() => calcStreak(), [activeDates]);

  function calcStreak() {
    let streak = 0;
    const d = new Date();
    while (streak < 365) {
      const key =
        d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (activeDates.includes(key)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!household) return;
    setExportLoading(true);
    try {
      const startDate = getLast30Days()[0];
      const endDate = today;
      const allChecks = await getChecksForDateRange(household.id, startDate, endDate);
      const allLogs = await getLogsForDateRange(household.id, startDate, endDate);
      const opts = {
        cats, recipes, checks: allChecks, logs: allLogs,
        startDate, endDate, householdName: household.name,
      };
      if (format === 'pdf') await exportAsPDF(opts);
      else await exportAsCSV(opts);
    } finally {
      setExportLoading(false);
    }
  };

  // Logs indexed by date (one per day)
  const logsByDate = useMemo(() => {
    const map: Record<string, typeof logs[0]> = {};
    logs.forEach((l) => { map[l.date] = l; });
    return map;
  }, [logs]);

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

  const selectedLog = selectedCalDate ? logsByDate[selectedCalDate] : null;
  const selectedTagOption = selectedLog?.tagColor
    ? TAG_OPTIONS.find((t) => t.value === selectedLog.tagColor)
    : null;

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
          <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>📋 기록</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>📅 포스트</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'records' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Insight bar */}
          <View style={styles.insightBar}>
            {[
              { num: `${todayChecks.length}/${activeRecipes.length}`, label: '오늘 완료' },
              { num: streakDays, label: '연속 기록일' },
              { num: activeDates.length, label: '총 기록일' },
            ].map(({ num, label }) => (
              <View key={label} style={[styles.insightItem, shadow.sm]}>
                <Text style={styles.insightNum}>{num}</Text>
                <Text style={styles.insightLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Weekly completion chart */}
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={styles.chartTitle}>📊 주간 완료율</Text>
            <View style={styles.chartWrap}>
              {weeklyStats.map(({ date, pct }) => (
                <View key={date} style={styles.chartCol}>
                  <Text style={styles.chartPct}>{pct > 0 ? `${pct}%` : ''}</Text>
                  <View style={styles.chartBarBg}>
                    <View style={[styles.chartBarFill, { height: `${pct}%` as any }]} />
                  </View>
                  <Text style={styles.chartDate}>{date.slice(3)}</Text>
                </View>
              ))}
            </View>
          </Card>

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

          {/* Export button */}
          <View style={{ marginBottom: spacing.lg }}>
            <Button
              label="📄 리포트 내보내기 (PDF)"
              variant="secondary"
              size="sm"
              loading={exportLoading}
              onPress={() => handleExport('pdf')}
            />
          </View>

          {/* Timeline */}
          {activeDates.length === 0 && (
            <EmptyState
              emoji="📓"
              title="기록이 아직 없어요"
              desc="체크리스트를 완료하거나 메모를 작성하면 여기에 기록이 쌓여요"
            />
          )}

          {activeDates.map((date) => {
            const dayChecks = Object.values(checks)
              .filter((c) => {
                if (c?.date !== date) return false;
                if (selectedCatFilter && c?.catId !== selectedCatFilter) return false;
                return c?.done;
              });
            const dayLogs = logs.filter((l) => {
              if (l.date !== date) return false;
              if (selectedCatFilter && l.catId && l.catId !== selectedCatFilter) return false;
              return true;
            });
            if (dayChecks.length === 0 && dayLogs.length === 0) return null;

            return (
              <View key={date} style={[styles.logEntry, shadow.sm]}>
                <View style={styles.logDateHeader}>
                  <Text style={styles.logDateText}>📅 {formatDisplayDate(date)}</Text>
                  {date === today && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>오늘</Text>
                    </View>
                  )}
                </View>
                <View style={styles.logContent}>
                  {dayChecks.length > 0 && (
                    <>
                      <Text style={styles.logSubLabel}>완료한 항목</Text>
                      <View style={styles.tagRow}>
                        {dayChecks.map((c) => {
                          const recipe = recipes.find((r) => r.id === c?.recipeId);
                          return recipe ? (
                            <View key={c.id} style={styles.doneTag}>
                              <Text style={styles.doneTagText}>✓ {recipe.name}</Text>
                            </View>
                          ) : null;
                        })}
                      </View>
                    </>
                  )}
                  {dayLogs.map((l) => (
                    <View key={l.id}>
                      {l.tagColor && (
                        <View style={[styles.logTagBadge, { backgroundColor: l.tagColor + '20', borderColor: l.tagColor }]}>
                          <View style={[styles.logTagDot, { backgroundColor: l.tagColor }]} />
                          <Text style={[styles.logTagText, { color: l.tagColor }]}>
                            {TAG_OPTIONS.find((t) => t.value === l.tagColor)?.label ?? ''}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.logText}>{l.text}</Text>
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
              const log = logsByDate[dateKey];
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedCalDate;
              const dotColor = log?.tagColor ?? (log ? colors.caramel : null);
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
                  activeOpacity={log ? 0.7 : 1}
                >
                  <Text style={[
                    styles.calDayNum,
                    isToday && styles.calDayNumToday,
                    dayOfWeek === 0 && { color: '#EF4444' },
                    dayOfWeek === 6 && { color: '#3B82F6' },
                  ]}>
                    {day}
                  </Text>
                  {dotColor && (
                    <View style={[styles.calDot, { backgroundColor: dotColor }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day log */}
          {selectedCalDate && (
            <View style={[styles.selectedLogCard, shadow.sm]}>
              <View style={styles.selectedLogHeader}>
                <Text style={styles.selectedLogDate}>📅 {formatDisplayDate(selectedCalDate)}</Text>
                {selectedTagOption && (
                  <View style={[styles.logTagBadge, { backgroundColor: selectedTagOption.value + '20', borderColor: selectedTagOption.value }]}>
                    <View style={[styles.logTagDot, { backgroundColor: selectedTagOption.value }]} />
                    <Text style={[styles.logTagText, { color: selectedTagOption.value }]}>{selectedTagOption.label}</Text>
                  </View>
                )}
              </View>
              {selectedLog ? (
                <Text style={styles.selectedLogText}>{selectedLog.text}</Text>
              ) : (
                <Text style={styles.selectedLogEmpty}>이 날의 메모가 없어요</Text>
              )}
            </View>
          )}

          {logs.length === 0 && (
            <EmptyState
              emoji="📅"
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
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: colors.border,
    backgroundColor: colors.warmWhite,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.caramel },
  tabText: { fontSize: 14, color: colors.muted },
  tabTextActive: { color: colors.caramel, fontWeight: '600' },
  content: { padding: spacing.lg, paddingBottom: 80 },
  insightBar: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  insightItem: {
    flex: 1, backgroundColor: colors.cream, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  insightNum: { fontSize: 24, fontWeight: '800', color: colors.caramel },
  insightLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: colors.brownMid, marginBottom: spacing.md },
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  chartCol: { flex: 1, alignItems: 'center', height: 100, justifyContent: 'flex-end' },
  chartPct: { fontSize: 9, color: colors.caramel, marginBottom: 2 },
  chartBarBg: {
    width: '100%', height: 70, backgroundColor: colors.sand,
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  chartBarFill: { width: '100%', backgroundColor: colors.caramel, borderRadius: 4 },
  chartDate: { fontSize: 9, color: colors.muted, marginTop: 4 },
  filterChip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border,
  },
  filterChipSel: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  filterChipText: { fontSize: 13, color: colors.brownMid },
  filterChipTextSel: { color: '#fff' },
  row: { flexDirection: 'row', gap: 10 },
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
  logSubLabel: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  doneTag: {
    backgroundColor: '#F0FDF4', paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: radius.full, borderWidth: 1, borderColor: '#C8E6C9',
  },
  doneTagText: { fontSize: 11, color: '#2E7D32' },
  logTagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 6,
  },
  logTagDot: { width: 8, height: 8, borderRadius: 4 },
  logTagText: { fontSize: 11, fontWeight: '600' },
  logText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
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
