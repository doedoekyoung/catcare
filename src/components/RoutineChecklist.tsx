// src/components/RoutineChecklist.tsx
// 시간대별 루틴 체크리스트 — HomeScreen(오늘)과 RecordsScreen(과거 날짜 수정)이 공유.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SectionTitle } from './ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { selectActiveRecipesForCats } from '../store/useStore';
import type { Cat, Recipe, CheckRecord, TimeSlot } from '../types';

const TIME_LABELS: Record<TimeSlot, string> = {
  morning: '아침', lunch: '점심', evening: '저녁',
};
const TIME_SLOTS: TimeSlot[] = ['morning', 'lunch', 'evening'];

export interface RoutineChecklistProps {
  date: string;
  cats: Cat[];
  recipes: Recipe[];
  selectedCatIds: string[];
  checks: Record<string, CheckRecord>;
  onToggle: (recipe: Recipe, catId: string, timeSlot: TimeSlot) => void;
  testIDPrefix?: string;
  emptyMessage?: string;
  /**
   * 편집 모드에서 원본 대비 변경된 체크 key 집합. 해당 항목에 시각 강조 적용.
   */
  highlightedKeys?: Set<string>;
}

export function RoutineChecklist({
  date, cats, recipes, selectedCatIds, checks, onToggle,
  testIDPrefix = 'check',
  emptyMessage = '이 날에는 적용되는 루틴이 없어요',
  highlightedKeys,
}: RoutineChecklistProps) {
  const grouped = useMemo(() => {
    const dateOnly = date.slice(0, 10);
    const active = selectActiveRecipesForCats(recipes, selectedCatIds, date)
      // 루틴이 그 날 이전에 만들어진 것만 (미래 날짜 루틴은 과거에 적용 안 됨)
      .filter((r) => dateOnly >= r.createdAt.slice(0, 10));
    const map: Record<TimeSlot, { recipe: Recipe; catId: string }[]> = {
      morning: [], lunch: [], evening: [],
    };
    active.forEach((r) => {
      const catId = r.catIds.find((id) => selectedCatIds.includes(id)) ?? r.catIds[0];
      r.times.forEach((t) => map[t].push({ recipe: r, catId }));
    });
    return map;
  }, [recipes, selectedCatIds, date]);

  const hasAny = TIME_SLOTS.some((t) => grouped[t].length > 0);
  if (!hasAny) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <View>
      {TIME_SLOTS.map((t) => {
        if (!grouped[t].length) return null;
        return (
          <View key={t} style={styles.section}>
            <SectionTitle title={TIME_LABELS[t]} />
            {grouped[t].map(({ recipe, catId }) => {
              const key = `${date}_${recipe.id}_${catId}_${t}`;
              const isDone = checks[key]?.done ?? false;
              const isChanged = highlightedKeys?.has(key) ?? false;
              const cat = cats.find((c) => c.id === catId);
              const tagColor = cat?.tagColor ?? colors.caramel;
              const sharedCatNames = recipe.catIds
                .map((id) => cats.find((c) => c.id === id)?.name)
                .filter(Boolean).join(', ');
              return (
                <TouchableOpacity
                  testID={`${testIDPrefix}-${recipe.id}-${t}`}
                  key={`${recipe.id}-${t}-${catId}`}
                  style={[
                    styles.checkItem,
                    isDone
                      ? { backgroundColor: tagColor + '18', borderColor: tagColor + '60' }
                      : { backgroundColor: '#fff', borderColor: tagColor + '50' },
                    { borderLeftWidth: 3, borderLeftColor: tagColor },
                    isChanged && styles.checkItemChanged,
                  ]}
                  onPress={() => onToggle(recipe, catId, t)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkBox, isDone && { backgroundColor: tagColor, borderColor: tagColor }]}>
                    {isDone && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                  </View>
                  <View style={styles.checkText}>
                    <Text style={[styles.checkTitle, isDone && styles.checkTitleDone]}>
                      {recipe.name}
                    </Text>
                    <Text style={styles.checkMeta}>{sharedCatNames}</Text>
                  </View>
                  {isChanged && (
                    <View style={styles.changedDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  empty: {
    fontSize: 13, color: colors.muted, textAlign: 'center',
    paddingVertical: spacing.md, fontStyle: 'italic',
  },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, marginBottom: 8, ...shadow.sm,
  },
  checkBox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkText: { flex: 1 },
  checkTitle: { fontSize: 14, color: colors.charcoal, lineHeight: 20 },
  checkTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  checkMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  checkItemChanged: {
    borderColor: colors.caramel,
    borderWidth: 2,
  },
  changedDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.caramel,
    marginLeft: 6,
  },
});
