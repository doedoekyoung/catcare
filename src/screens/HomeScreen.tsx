// src/screens/HomeScreen.tsx
// REQ-M03, M06, M07, M09, V1-01, V2-03~05, V3-01~02, V4-01, V4-05

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore, selectActiveRecipesForCats, selectCompletionRate } from '../store/useStore';
import { upsertCheck } from '../services/firestoreService';
import { Button, Card, SectionTitle, Tag, ProgressBar, EmptyState, BottomSheet, Input } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { toDateKey, formatDisplayDate } from '../utils/date';
import type { CheckRecord, Recipe } from '../types';
import { upsertLog } from '../services/firestoreService';

const TIME_LABELS: Record<string, string> = { am: '☀️ 오전', pm: '🌙 오후', all: '📅 종일' };

export default function HomeScreen() {
  const {
    cats, recipes, checks, logs, selectedCatIds, user, household,
    toggleCatSelection, toggleCheck, setLogs,
  } = useStore();

  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logText, setLogText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const today = toDateKey();
  const activeRecipes = selectActiveRecipesForCats(recipes, selectedCatIds);
  const { done, total, pct } = selectCompletionRate(recipes, checks, today, selectedCatIds);
  const todayLog = logs.find((l) => l.date === today);

  const grouped = { am: [] as Recipe[], pm: [] as Recipe[], all: [] as Recipe[] };
  activeRecipes.forEach((r) => grouped[r.time].push(r));

  const handleToggleCheck = useCallback(
    async (recipe: Recipe) => {
      if (!household || !user) return;
      const catId = recipe.catIds.find((id) => selectedCatIds.includes(id)) ?? recipe.catIds[0];
      const key = `${today}_${recipe.id}_${catId}`;
      const current = checks[key];
      const newDone = !(current?.done ?? false);
      const record: CheckRecord = {
        id: key,
        date: today,
        recipeId: recipe.id,
        catId,
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
      date: today,
      text: logText.trim(),
      householdId: household.id,
      authorId: user.uid,
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
      {/* Header */}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={colors.caramel} />
        }
      >
        {/* Cat selector chips (REQ-V1-01) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          <View style={styles.chips}>
            {cats.map((cat) => {
              const sel = selectedCatIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, sel && styles.chipSelected]}
                  onPress={() => toggleCatSelection(cat.id)}
                >
                  <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{cat.name}</Text>
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
        {(['am', 'pm', 'all'] as const).map((t) => {
          if (!grouped[t].length) return null;
          return (
            <View key={t} style={styles.section}>
              <SectionTitle title={TIME_LABELS[t]} />
              {grouped[t].map((recipe) => {
                const catId = recipe.catIds.find((id) => selectedCatIds.includes(id)) ?? recipe.catIds[0];
                const key = `${today}_${recipe.id}_${catId}`;
                const isDone = checks[key]?.done ?? false;
                const cat = cats.find((c) => c.id === catId);
                const sharedCatNames = recipe.catIds
                  .map((id) => cats.find((c) => c.id === id)?.name)
                  .filter(Boolean).join(', ');
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[styles.checkItem, isDone && styles.checkItemDone]}
                    onPress={() => handleToggleCheck(recipe)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkBox, isDone && styles.checkBoxDone]}>
                      {isDone && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                    </View>
                    <View style={styles.checkText}>
                      <Text style={[styles.checkTitle, isDone && styles.checkTitleDone]}>
                        {recipe.name}
                      </Text>
                      <Text style={styles.checkMeta}>{sharedCatNames}</Text>
                    </View>
                    <Tag label={t === 'am' ? '오전' : t === 'pm' ? '오후' : '종일'} type={t} />
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

      {/* Log Modal */}
      <BottomSheet
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        title="✏️ 오늘의 기록"
      >
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
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.cream,
  },
  chipSelected: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, color: colors.brownMid },
  chipTextSel: { color: '#fff' },
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
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#fff', marginBottom: 8, ...shadow.sm,
  },
  checkItemDone: { backgroundColor: colors.checkedBg, borderColor: colors.sageMid },
  checkBox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkBoxDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  checkText: { flex: 1 },
  checkTitle: { fontSize: 14, color: colors.charcoal, lineHeight: 20 },
  checkTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  checkMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  logText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
});
