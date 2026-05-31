// src/screens/HomeScreen.tsx

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectActiveRecipesForCats, selectCompletionRate } from '../store/useStore';
import { upsertCheck, getChecksForDateRange } from '../services/dbService';
import { Card, EmptyState } from '../components/ui';
import { RoutineChecklist } from '../components/RoutineChecklist';
import { colors, spacing, radius } from '../utils/theme';
import { toDateKey, getLast30Days } from '../utils/date';
import type { CheckRecord, Recipe, TimeSlot } from '../types';

export default function HomeScreen() {
  const {
    cats, recipes, checks, selectedCatIds, user, household,
    setSelectedCatIds, toggleCheck,
  } = useStore();

  // 고양이 단일 선택
  const activeCatId: string | null = selectedCatIds.length === 1 ? selectedCatIds[0] : null;
  const selectCat = (catId: string | null) => {
    setSelectedCatIds(catId ? [catId] : cats.map((c) => c.id));
  };

  // 7일 완료율 계산용
  const [historyChecks, setHistoryChecks] = useState<CheckRecord[]>([]);
  useEffect(() => {
    if (!household?.id) return;
    const days = getLast30Days();
    getChecksForDateRange(household.id, days[days.length - 7], days[days.length - 1])
      .then(setHistoryChecks).catch(() => {});
  }, [household?.id]);

  const getCatRate = useCallback((catId: string): number => {
    const catRecipes = recipes.filter((r) => r.active && r.catIds.includes(catId));
    let total = 0; let done = 0;
    const days = getLast30Days().slice(-7);
    days.forEach((date) => {
      const dow = new Date(date + 'T00:00:00').getDay();
      catRecipes.forEach((r) => {
        const scheduled = (r.days ?? []).length === 0 || (r.days ?? []).includes(dow);
        if (!scheduled) return;
        r.times.forEach((t) => {
          total++;
          if (historyChecks.some((c) => c.id === `${date}_${r.id}_${catId}_${t}` && c.done)) done++;
        });
      });
    });
    return total === 0 ? 100 : Math.round((done / total) * 100);
  }, [recipes, historyChecks]);

  const [refreshing] = useState(false);

  const today = toDateKey();
  const activeRecipes = selectActiveRecipesForCats(recipes, selectedCatIds, today);
  const { done, total, pct } = selectCompletionRate(recipes, checks, today, selectedCatIds);

  const handleToggleCheck = useCallback(
    async (recipe: Recipe, catId: string, timeSlot: TimeSlot) => {
      if (!household || !user) return;
      const key = `${today}_${recipe.id}_${catId}_${timeSlot}`;
      const current = checks[key];
      const newDone = !(current?.done ?? false);
      const record: CheckRecord = {
        id: key, date: today, recipeId: recipe.id, catId,
        done: newDone,
        doneAt: newDone ? new Date().toISOString() : undefined,
        doneBy: user.uid,
        householdId: household.id,
        memo: current?.memo,
      };
      toggleCheck(key, record);
      await upsertCheck(household.id, record);
    },
    [checks, household, user, today, toggleCheck]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>오늘의 돌봄 루틴</Text>
        <View style={styles.headerRight}>
          {total > 0 && (
            <View style={[styles.doneBadge, pct === 100 && { backgroundColor: colors.sage }]}>
              <Text style={styles.doneBadgeText}>{done} / {total}</Text>
            </View>
          )}
        </View>
      </View>


      {/* 고양이 탭바 */}
      {cats.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catTabScroll}>
          <View style={styles.catTabBar}>
            <TouchableOpacity
              style={[styles.catTab, activeCatId === null && styles.catTabActive]}
              onPress={() => selectCat(null)}
            >
              <Text style={[styles.catTabText, activeCatId === null && styles.catTabTextActive]}>전체</Text>
            </TouchableOpacity>
            {cats.map((cat) => {
              const tagColor = cat.tagColor ?? colors.caramel;
              const isActive = activeCatId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catTab, isActive && { borderBottomColor: tagColor }]}
                  onPress={() => selectCat(cat.id)}
                >
                  <View style={[styles.catTabDot, { backgroundColor: tagColor }]} />
                  <Text style={[styles.catTabText, isActive && { color: tagColor, fontWeight: '700' }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* 선택된 고양이 퀵인포 */}
      {activeCatId && (() => {
        const rate = getCatRate(activeCatId);
        const rateColor = rate >= 80 ? '#22C55E' : '#EF4444';
        return (
          <View style={styles.catQuickBar}>
            <Text style={styles.catQuickText}>
              오늘 <Text style={{ fontWeight: '700', color: colors.caramel }}>{done}/{total}</Text> 완료
            </Text>
            <Text style={styles.catQuickDivider}>·</Text>
            <Text style={styles.catQuickText}>
              7일 완료율 <Text style={{ fontWeight: '700', color: rateColor }}>{rate}%</Text>
            </Text>
          </View>
        );
      })()}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.caramel} />}
      >

        {cats.length === 0 && (
          <EmptyState
            title="고양이를 등록해보세요"
            desc="하단 고양이 탭에서 첫 고양이를 등록하고 루틴을 만들어보세요"
          />
        )}

        {activeRecipes.length > 0 && (
          <RoutineChecklist
            date={today}
            cats={cats}
            recipes={recipes}
            selectedCatIds={selectedCatIds}
            checks={checks}
            onToggle={handleToggleCheck}
            testIDPrefix="home-check"
          />
        )}

        {activeRecipes.length === 0 && cats.length > 0 && (
          <Card style={{ backgroundColor: colors.warnBg }}>
            <Text style={{ fontSize: 13, color: colors.warnText }}>
              선택한 고양이에 등록된 루틴 항목이 없어요.{'\n'}
              고양이 탭에서 루틴을 추가해보세요.
            </Text>
          </Card>
        )}

      </ScrollView>
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
  greeting: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: colors.caramel,
  },
  doneBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  catTabScroll: { borderBottomWidth: 1, borderBottomColor: colors.border, flexShrink: 0, flexGrow: 0 },
  catTabBar: { flexDirection: 'row', paddingHorizontal: 16 },
  catTab: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  catTabActive: { borderBottomColor: colors.caramel },
  catTabDot: { width: 10, height: 10, borderRadius: 5 },
  catTabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  catTabTextActive: { color: colors.caramel, fontWeight: '600' },
  catQuickBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 8,
    backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  catQuickText: { fontSize: 12, color: colors.brownMid },
  catQuickDivider: { fontSize: 12, color: colors.border },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 80 },
});
