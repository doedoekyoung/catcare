// src/components/TodayView.tsx
// "오늘의 돌봄 루틴" 화면 — 헤더 / 고양이 탭 / 퀵인포 / 시간대별 체크리스트.
// 로그인 사용자의 HomeScreen과 펫시터 공유 화면(ShareScreen)이 같은 화면을 쓰도록 공용화.
// 데이터·저장 방식(store+Supabase vs 공유 RPC)은 호출하는 쪽이 정하고, 이 컴포넌트는 표시만 한다.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { selectActiveRecipesForCats, selectCompletionRate } from '../store/useStore';
import { Card, EmptyState } from './ui';
import { RoutineChecklist } from './RoutineChecklist';
import { colors, spacing, radius } from '../utils/theme';
import type { Cat, Recipe, CheckRecord, TimeSlot } from '../types';

export interface TodayViewProps {
  date: string;
  cats: Cat[];
  recipes: Recipe[];
  checks: Record<string, CheckRecord>;
  selectedCatIds: string[];
  /** null = 전체 */
  onSelectCat: (catId: string | null) => void;
  onToggle: (recipe: Recipe, catId: string, timeSlot: TimeSlot) => void;
  testIDPrefix: string;
  /** 고양이별 7일 완료율(%). 없으면 퀵인포에 완료율을 표시하지 않는다(공유 뷰는 과거 데이터 없음). */
  getCatRate?: (catId: string) => number;
  /** 헤더 우측, 완료 배지 앞에 붙는 요소(예: 펫시터 뷰 표시) */
  headerExtra?: React.ReactNode;
  /** 헤더 위 배너(예: 인앱 브라우저 안내) */
  banner?: React.ReactNode;
  /** 스크롤 영역 하단(예: 공유 뷰의 메모/안내) */
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  noCatsDesc?: string;
  emptyRoutinesMessage?: string;
}

export function TodayView({
  date, cats, recipes, checks, selectedCatIds, onSelectCat, onToggle, testIDPrefix,
  getCatRate, headerExtra, banner, footer, refreshing = false, onRefresh,
  noCatsDesc = '하단 고양이 탭에서 첫 고양이를 등록하고 루틴을 만들어보세요',
  emptyRoutinesMessage = '선택한 고양이에 등록된 루틴 항목이 없어요.\n고양이 탭에서 루틴을 추가해보세요.',
}: TodayViewProps) {
  // 고양이 단일 선택일 때만 해당 고양이 탭이 활성, 그 외는 "전체"
  const activeCatId: string | null = selectedCatIds.length === 1 ? selectedCatIds[0] : null;
  const activeRecipes = selectActiveRecipesForCats(recipes, selectedCatIds, date);
  const { done, total, pct } = selectCompletionRate(recipes, checks, date, selectedCatIds);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {banner}
      <View style={styles.header}>
        <Text style={styles.greeting}>오늘의 돌봄 루틴</Text>
        <View style={styles.headerRight}>
          {headerExtra}
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
              onPress={() => onSelectCat(null)}
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
                  onPress={() => onSelectCat(cat.id)}
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
        const rate = getCatRate?.(activeCatId);
        const rateColor = rate !== undefined && rate >= 80 ? '#22C55E' : '#EF4444';
        return (
          <View style={styles.catQuickBar}>
            <Text style={styles.catQuickText}>
              오늘 <Text style={{ fontWeight: '700', color: colors.caramel }}>{done}/{total}</Text> 완료
            </Text>
            {rate !== undefined && (
              <>
                <Text style={styles.catQuickDivider}>·</Text>
                <Text style={styles.catQuickText}>
                  7일 완료율 <Text style={{ fontWeight: '700', color: rateColor }}>{rate}%</Text>
                </Text>
              </>
            )}
          </View>
        );
      })()}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.caramel} />}
      >
        {cats.length === 0 && (
          <EmptyState title="고양이를 등록해보세요" desc={noCatsDesc} />
        )}

        {activeRecipes.length > 0 && (
          <RoutineChecklist
            date={date}
            cats={cats}
            recipes={recipes}
            selectedCatIds={selectedCatIds}
            checks={checks}
            onToggle={onToggle}
            testIDPrefix={testIDPrefix}
          />
        )}

        {activeRecipes.length === 0 && cats.length > 0 && (
          <Card style={{ backgroundColor: colors.warnBg }}>
            <Text style={{ fontSize: 13, color: colors.warnText }}>{emptyRoutinesMessage}</Text>
          </Card>
        )}

        {footer}
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
