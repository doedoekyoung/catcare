// src/screens/HomeScreen.tsx

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectActiveRecipesForCats, selectCompletionRate } from '../store/useStore';
import { upsertCheck, upsertLog } from '../services/dbService';
import { Card, SectionTitle, EmptyState, BottomSheet, Input, Button } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { toDateKey, formatDisplayDate } from '../utils/date';
import type { CheckRecord, Recipe, TimeSlot } from '../types';

const TAG_OPTIONS = [
  { value: '#EF4444', label: '응급' },
  { value: '#F97316', label: '위험' },
  { value: '#EAB308', label: '주의' },
  { value: '#22C55E', label: '안정' },
];

const TIME_LABELS: Record<TimeSlot, string> = {
  morning: '🌅 아침',
  lunch: '☀️ 점심',
  evening: '🌙 저녁',
};

const TIME_SLOTS: TimeSlot[] = ['morning', 'lunch', 'evening'];

export default function HomeScreen() {
  const {
    cats, recipes, checks, logs, selectedCatIds, user, household,
    setSelectedCatIds, toggleCheck, setLogs,
  } = useStore();

  // single-select: null = 전체
  const activeCatId: string | null = selectedCatIds.length === 1 ? selectedCatIds[0] : null;
  const selectCat = (catId: string | null) => {
    if (catId === null) setSelectedCatIds(cats.map((c) => c.id));
    else setSelectedCatIds([catId]);
  };

  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logText, setLogText] = useState('');
  const [logTagColor, setLogTagColor] = useState<string | null>(null);
  const [logCatId, setLogCatId] = useState<string | null>(null);
  const [refreshing] = useState(false);

  const today = toDateKey();
  const activeRecipes = selectActiveRecipesForCats(recipes, selectedCatIds);
  const { done, total, pct } = selectCompletionRate(recipes, checks, today, selectedCatIds);
  const todayLog = logs.find((l) => l.date === today);

  // 시간대별 그룹 — 복수 시간대 지원
  const grouped: Record<TimeSlot, Recipe[]> = { morning: [], lunch: [], evening: [] };
  activeRecipes.forEach((r) => {
    r.times.forEach((t) => {
      if (!grouped[t].includes(r)) grouped[t].push(r);
    });
  });

  const handleToggleCheck = useCallback(
    async (recipe: Recipe, timeSlot: TimeSlot) => {
      if (!household || !user) return;
      const catId = recipe.catIds.find((id) => selectedCatIds.includes(id)) ?? recipe.catIds[0];
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
    [checks, household, user, today, selectedCatIds, toggleCheck]
  );

  const handleSaveLog = async () => {
    if (!logText.trim() || !household || !user) return;
    const existing = logs.find((l) => l.date === today);
    const log = {
      id: existing?.id ?? crypto.randomUUID(),
      date: today, text: logText.trim(),
      tagColor: logTagColor ?? undefined,
      catId: logCatId ?? undefined,
      householdId: household.id, authorId: user.uid,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertLog(household.id, log);
      setLogs(logs.map((l) => l.id === log.id ? log : l).concat(existing ? [] : [log]));
      setLogModalVisible(false);
      setLogText('');
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(`저장 실패: ${e?.message ?? ''}`);
    }
  };

  const openLogModal = () => {
    setLogText(todayLog?.text ?? '');
    setLogTagColor(todayLog?.tagColor ?? null);
    setLogCatId(todayLog?.catId ?? null);
    setLogModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>{formatDisplayDate(today)}</Text>
          <Text style={styles.greeting}>오늘의 돌봄 루틴</Text>
        </View>
        <View style={styles.headerRight}>
          {total > 0 && (
            <View style={[styles.doneBadge, pct === 100 && { backgroundColor: colors.sage }]}>
              <Text style={styles.doneBadgeText}>{done} / {total}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.logBtn} onPress={openLogModal}>
            <Text style={{ fontSize: 16 }}>✏</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cat tab bar */}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.caramel} />}
      >
        {cats.length === 0 && (
          <EmptyState
            emoji="🐱"
            title="고양이를 등록해보세요"
            desc="하단 고양이 탭에서 첫 고양이를 등록하고 루틴을 만들어보세요"
          />
        )}

        {/* Checklist by time group */}
        {TIME_SLOTS.map((t) => {
          if (!grouped[t].length) return null;
          return (
            <View key={t} style={styles.section}>
              <SectionTitle title={TIME_LABELS[t]} />
              {grouped[t].map((recipe) => {
                const catId = recipe.catIds.find((id) => selectedCatIds.includes(id)) ?? recipe.catIds[0];
                const key = `${today}_${recipe.id}_${catId}_${t}`;
                const isDone = checks[key]?.done ?? false;
                const cat = cats.find((c) => c.id === catId);
                const tagColor = cat?.tagColor ?? colors.caramel;
                const sharedCatNames = recipe.catIds
                  .map((id) => cats.find((c) => c.id === id)?.name)
                  .filter(Boolean).join(', ');
                return (
                  <TouchableOpacity
                    key={`${recipe.id}-${t}`}
                    style={[
                      styles.checkItem,
                      isDone
                        ? { backgroundColor: tagColor + '18', borderColor: tagColor + '60' }
                        : { backgroundColor: '#fff', borderColor: tagColor + '50' },
                      { borderLeftWidth: 3, borderLeftColor: tagColor },
                    ]}
                    onPress={() => handleToggleCheck(recipe, t)}
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
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {activeRecipes.length === 0 && cats.length > 0 && (
          <Card style={{ backgroundColor: colors.warnBg }}>
            <Text style={{ fontSize: 13, color: colors.warnText }}>
              선택한 고양이에 등록된 루틴 항목이 없어요.{'\n'}
              고양이 탭에서 루틴을 추가해보세요.
            </Text>
          </Card>
        )}

        {/* Today log — 고양이 등록 후에만 표시 */}
        {cats.length > 0 && (
          <>
            <SectionTitle title="오늘의 메모" style={{ marginTop: 8 }} />
            {todayLog ? (
              <Card>
                {todayLog.tagColor && (
                  <View style={[styles.logTagBadge, { backgroundColor: todayLog.tagColor + '20', borderColor: todayLog.tagColor }]}>
                    <View style={[styles.logTagDot, { backgroundColor: todayLog.tagColor }]} />
                    <Text style={[styles.logTagText, { color: todayLog.tagColor }]}>
                      {TAG_OPTIONS.find((t) => t.value === todayLog.tagColor)?.label ?? ''}
                      {todayLog.catId ? ` · ${cats.find((c) => c.id === todayLog.catId)?.name ?? ''}` : ''}
                    </Text>
                  </View>
                )}
                <Text style={styles.logText}>{todayLog.text}</Text>
                <Button label="수정" variant="ghost" size="sm" onPress={openLogModal} />
              </Card>
            ) : (
              <Card style={{ backgroundColor: colors.cream }}>
                <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 10, textAlign: 'center' }}>
                  오늘의 특이사항을 기록해보세요
                </Text>
                <Button label="메모 추가" variant="secondary" size="sm" onPress={openLogModal} />
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={logModalVisible} onClose={() => setLogModalVisible(false)} title="오늘의 기록">
        {cats.length > 0 && (
          <View style={styles.catSelectRow}>
            <Text style={styles.tagLabel}>고양이</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.tagChip, logCatId === null && styles.tagChipSelected, { borderColor: colors.border }]}
                  onPress={() => setLogCatId(null)}
                >
                  <Text style={[styles.tagChipText, logCatId === null && { color: colors.charcoal, fontWeight: '600' }]}>전체</Text>
                </TouchableOpacity>
                {cats.map((cat) => {
                  const color = cat.tagColor ?? colors.caramel;
                  const sel = logCatId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.tagChip, { borderColor: color, backgroundColor: sel ? color : color + '18' }]}
                      onPress={() => setLogCatId(sel ? null : cat.id)}
                    >
                      <Text style={[styles.tagChipText, { color: sel ? '#fff' : color }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
        <Input
          label="특이사항 메모"
          value={logText}
          onChangeText={setLogText}
          multiline
          numberOfLines={5}
          placeholder="오늘 고양이의 상태, 특이사항 등을 기록해보세요"
          containerStyle={{ marginBottom: spacing.md }}
          style={{ minHeight: 120 }}
        />
        <View style={styles.tagRow}>
          <Text style={styles.tagLabel}>상태</Text>
          <View style={styles.tagOptions}>
            <TouchableOpacity
              style={[styles.tagChip, logTagColor === null && styles.tagChipSelected, { borderColor: colors.border }]}
              onPress={() => setLogTagColor(null)}
            >
              <Text style={[styles.tagChipText, logTagColor === null && { color: colors.charcoal, fontWeight: '600' }]}>없음</Text>
            </TouchableOpacity>
            {TAG_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.tagChip, { borderColor: t.value, backgroundColor: logTagColor === t.value ? t.value : t.value + '18' }]}
                onPress={() => setLogTagColor(logTagColor === t.value ? null : t.value)}
              >
                <Text style={[styles.tagChipText, { color: logTagColor === t.value ? '#fff' : t.value }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
          <Button label="취소" variant="secondary" onPress={() => setLogModalVisible(false)} style={{ flex: 1 }} />
          <Button label="저장" variant="primary" onPress={handleSaveLog} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  dateLabel: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: colors.caramel,
  },
  doneBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  logBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  catTabScroll: {
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
    backgroundColor: colors.warmWhite, flexShrink: 0,
  },
  catTabBar: { flexDirection: 'row', paddingHorizontal: spacing.lg },
  catTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 11, paddingHorizontal: 4, marginRight: 20,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  catTabActive: { borderBottomColor: colors.caramel },
  catTabDot: { width: 7, height: 7, borderRadius: 4 },
  catTabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  catTabTextActive: { color: colors.caramel },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 80 },
  section: { marginBottom: spacing.lg },
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
  logText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  logTagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
    borderWidth: 1, alignSelf: 'flex-start', marginBottom: 8,
  },
  logTagDot: { width: 6, height: 6, borderRadius: 3 },
  logTagText: { fontSize: 11, fontWeight: '700' },
  catSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  tagLabel: { fontSize: 13, color: colors.muted, minWidth: 28 },
  tagOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tagChip: {
    paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.full,
    borderWidth: 1.5, backgroundColor: colors.cream,
  },
  tagChipSelected: { backgroundColor: colors.charcoal + '18' },
  tagChipText: { fontSize: 12, color: colors.muted },
});
