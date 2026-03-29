// src/screens/HomeScreen.tsx

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectActiveRecipesForCats, selectCompletionRate } from '../store/useStore';
import { upsertCheck, upsertLog } from '../services/dbService';
import { Card, SectionTitle, ProgressBar, EmptyState, BottomSheet, Input, Button } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { toDateKey, formatDisplayDate } from '../utils/date';
import type { CheckRecord, Recipe, TimeSlot } from '../types';

const TIME_LABELS: Record<TimeSlot, string> = {
  morning: '🌅 아침',
  lunch: '☀️ 점심',
  evening: '🌙 저녁',
};

const TIME_SLOTS: TimeSlot[] = ['morning', 'lunch', 'evening'];

export default function HomeScreen() {
  const {
    cats, recipes, checks, logs, selectedCatIds, user, household,
    toggleCatSelection, toggleCheck, setLogs,
  } = useStore();

  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logText, setLogText] = useState('');
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
    async (recipe: Recipe) => {
      if (!household || !user) return;
      const catId = recipe.catIds.find((id) => selectedCatIds.includes(id)) ?? recipe.catIds[0];
      const key = `${today}_${recipe.id}_${catId}`;
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
      id: existing?.id ?? `${today}_${user.uid}`,
      date: today, text: logText.trim(),
      householdId: household.id, authorId: user.uid,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertLog(household.id, log);
    setLogs(logs.map((l) => l.id === log.id ? log : l).concat(existing ? [] : [log]));
    setLogModalVisible(false);
    setLogText('');
  };

  const openLogModal = () => {
    setLogText(todayLog?.text ?? '');
    setLogModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>{formatDisplayDate(today)}</Text>
          <Text style={styles.greeting}>
            {pct === 100 ? '오늘 루틴 완료 🎉' : '오늘의 돌봄 루틴'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logBtn} onPress={openLogModal}>
          <Text style={{ fontSize: 18 }}>✏️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.caramel} />}
      >
        {/* Cat selector chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          <View style={styles.chips}>
            {cats.map((cat) => {
              const sel = selectedCatIds.includes(cat.id);
              const tagColor = cat.tagColor ?? colors.caramel;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    { borderColor: tagColor },
                    sel
                      ? { backgroundColor: tagColor }
                      : { backgroundColor: tagColor + '15' },
                  ]}
                  onPress={() => toggleCatSelection(cat.id)}
                >
                  {cat.photoUri ? (
                    <Image source={{ uri: cat.photoUri }} style={styles.chipPhoto} />
                  ) : (
                    <Text style={[styles.chipInitial, { color: sel ? '#fff' : tagColor }]}>
                      {cat.name.charAt(0)}
                    </Text>
                  )}
                  <Text style={[styles.chipText, { color: sel ? '#fff' : tagColor }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {cats.length === 0 && (
          <EmptyState
            emoji="🐱"
            title="고양이를 등록해보세요"
            desc="하단 고양이 탭에서 첫 고양이를 등록하고 루틴을 만들어보세요"
          />
        )}

        {/* Progress */}
        {total > 0 && (
          <View style={styles.progressWrap}>
            {pct === 100 ? (
              <View style={styles.allDoneBanner}>
                <Text style={styles.allDoneEmoji}>🎉</Text>
                <Text style={styles.allDoneTitle}>오늘 루틴 완료!</Text>
                <Text style={styles.allDoneSub}>모든 돌봄 항목을 마쳤어요 ✨</Text>
              </View>
            ) : (
              <>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>오늘 완료 현황</Text>
                  <Text style={styles.progressCount}>{done} / {total}</Text>
                </View>
                <ProgressBar pct={pct} />
              </>
            )}
          </View>
        )}

        {/* Checklist by time group */}
        {TIME_SLOTS.map((t) => {
          if (!grouped[t].length) return null;
          return (
            <View key={t} style={styles.section}>
              <SectionTitle title={TIME_LABELS[t]} />
              {grouped[t].map((recipe) => {
                const catId = recipe.catIds.find((id) => selectedCatIds.includes(id)) ?? recipe.catIds[0];
                const key = `${today}_${recipe.id}_${catId}`;
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
                    onPress={() => handleToggleCheck(recipe)}
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
              ⚠️ 선택한 고양이에 등록된 루틴 항목이 없어요.{'\n'}
              고양이 탭에서 루틴을 추가해보세요.
            </Text>
          </Card>
        )}

        {/* Today log */}
        <SectionTitle title="📓 오늘의 메모" style={{ marginTop: 8 }} />
        {todayLog ? (
          <Card>
            <Text style={styles.logText}>{todayLog.text}</Text>
            <Button label="✏️ 수정" variant="ghost" size="sm" onPress={openLogModal} />
          </Card>
        ) : (
          <Card style={{ backgroundColor: colors.cream }}>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 10, textAlign: 'center' }}>
              오늘의 특이사항을 기록해보세요
            </Text>
            <Button label="✏️ 메모 추가" variant="secondary" size="sm" onPress={openLogModal} />
          </Card>
        )}
      </ScrollView>

      <BottomSheet visible={logModalVisible} onClose={() => setLogModalVisible(false)} title="✏️ 오늘의 기록">
        <Input
          label="특이사항 메모"
          value={logText}
          onChangeText={setLogText}
          multiline
          numberOfLines={5}
          placeholder="오늘 고양이의 상태, 특이사항 등을 기록해보세요"
          containerStyle={{ marginBottom: spacing.lg }}
          style={{ minHeight: 120 }}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
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
  logBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 80 },
  chipsScroll: { marginBottom: spacing.lg, marginHorizontal: -spacing.lg },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: radius.full, borderWidth: 1.5,
  },
  chipPhoto: { width: 20, height: 20, borderRadius: 10 },
  chipInitial: { fontSize: 14, fontWeight: '700', width: 20, textAlign: 'center' },
  chipText: { fontSize: 13, fontWeight: '500' },
  progressWrap: { marginBottom: spacing.lg },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: colors.brownMid },
  progressCount: { fontSize: 13, color: colors.caramel, fontWeight: '700' },
  allDoneBanner: {
    backgroundColor: colors.sage, borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'center',
  },
  allDoneEmoji: { fontSize: 36, marginBottom: 6 },
  allDoneTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  allDoneSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
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
});
