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
import { formatDisplayDate, formatFullDate, getLast30Days, toDateKey } from '../utils/date';
import { exportAsPDF, exportAsCSV } from '../services/exportService';
import { getChecksForDateRange, getLogsForDateRange } from '../services/firestoreService';

export default function RecordsScreen() {
  const { cats, recipes, checks, logs, household } = useStore();
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>기록 보기</Text>
          <Text style={styles.headerSub}>날짜별 체크 & 로그</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Insight bar (REQ-V5-04) */}
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

        {/* Weekly completion chart (REQ-V5-03) */}
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

        {/* Cat filter chips (REQ-V1-02) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 0 }}>
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
                  {c.emoji} {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Export buttons (REQ-V5-05) */}
        <View style={[styles.row, { marginBottom: spacing.lg }]}>
          <Button
            label="📄 PDF 내보내기"
            variant="secondary"
            size="sm"
            loading={exportLoading}
            onPress={() => handleExport('pdf')}
            style={{ flex: 1 }}
          />
          <Button
            label="📊 CSV 내보내기"
            variant="secondary"
            size="sm"
            loading={exportLoading}
            onPress={() => handleExport('csv')}
            style={{ flex: 1 }}
          />
        </View>

        {/* Timeline (REQ-V4-05) */}
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
                  <Text key={l.id} style={styles.logText}>{l.text}</Text>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
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
    backgroundColor: colors.successBg, paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: radius.full, borderWidth: 1, borderColor: '#C8E6C9',
  },
  doneTagText: { fontSize: 11, color: colors.successText },
  logText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
});
