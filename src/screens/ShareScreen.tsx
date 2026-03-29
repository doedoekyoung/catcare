// src/screens/ShareScreen.tsx
// REQ-V1-04: 비회원 공유 링크 — 읽기 + 체크 권한

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
  getHouseholdByToken,
  subscribeToCats,
  subscribeToRecipes,
  subscribeToChecks,
  upsertCheck,
} from '../services/dbService';
import { signInAsGuest } from '../services/authService';
import { supabase } from '../services/supabase';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { Tag } from '../components/ui';
import { toDateKey, formatFullDate } from '../utils/date';
import type { Cat, Recipe, CheckRecord, Household } from '../types';
import type { RootStackParamList } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'ShareLink'>;

const TIME_LABELS: Record<string, string> = { morning: '🌅 아침', lunch: '☀️ 점심', evening: '🌙 저녁' };

export default function ShareScreen() {
  const route = useRoute<RouteProps>();
  const token = route.params?.token ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [checks, setChecks] = useState<Record<string, CheckRecord>>({});

  const today = toDateKey();

  useEffect(() => {
    (async () => {
      try {
        // Anonymous sign-in for sitter
        await signInAsGuest();
        const hh = await getHouseholdByToken(token);
        if (!hh) { setError('유효하지 않거나 만료된 링크입니다.'); return; }

        // Check expiry
        if (hh.shareTokenExpiry && new Date(hh.shareTokenExpiry) < new Date()) {
          setError('공유 링크가 만료되었습니다. 집사에게 새 링크를 요청하세요.'); return;
        }

        setHousehold(hh);

        // Subscribe real-time
        subscribeToCats(hh.id, setCats);
        subscribeToRecipes(hh.id, setRecipes);
        subscribeToChecks(hh.id, today, (list) => {
          const map: Record<string, CheckRecord> = {};
          list.forEach((c) => { map[c.id] = c; });
          setChecks(map);
        });
      } catch (e) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleToggleCheck = useCallback(
    async (recipe: Recipe, catId: string, timeSlot: string) => {
      if (!household) return;
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? 'guest';
      const key = `${today}_${recipe.id}_${catId}_${timeSlot}`;
      const current = checks[key];
      const newDone = !(current?.done ?? false);
      const record: CheckRecord = {
        id: key,
        date: today,
        recipeId: recipe.id,
        catId,
        done: newDone,
        doneAt: newDone ? new Date().toISOString() : undefined,
        doneBy: uid,
        householdId: household.id,
      };
      setChecks((prev) => ({ ...prev, [key]: record }));
      await upsertCheck(household.id, record);
    },
    [checks, household, today]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.caramel} />
        <Text style={{ color: colors.muted, marginTop: 12 }}>체크리스트 불러오는 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={styles.errorTitle}>링크 오류</Text>
        <Text style={styles.errorDesc}>{error}</Text>
      </View>
    );
  }

  const activeRecipes = recipes.filter((r) => r.active);
  const grouped: Record<string, Recipe[]> = { morning: [], lunch: [], evening: [] };
  activeRecipes.forEach((r) => r.times.forEach((t) => {
    if (!grouped[t].includes(r)) grouped[t].push(r);
  }));

  let total = 0; let done = 0;
  activeRecipes.forEach((r) => {
    const catId = r.catIds[0];
    r.times.forEach((t) => {
      total++;
      if (checks[`${today}_${r.id}_${catId}_${t}`]?.done) done++;
    });
  });
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🐱 CatCare</Text>
        <View style={styles.guestBadge}>
          <Text style={styles.guestText}>펫시터 뷰</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Household & date info */}
        <View style={[styles.infoCard, shadow.sm]}>
          <Text style={styles.hhName}>🏠 {household?.name}</Text>
          <Text style={styles.dateText}>{formatFullDate(today)}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>완료 현황</Text>
            <Text style={styles.progressCount}>{done} / {total}</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
          {pct === 100 && (
            <Text style={styles.allDoneText}>🎉 오늘 루틴 모두 완료!</Text>
          )}
        </View>

        {/* Cat tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {cats.map((cat) => (
              <View key={cat.id} style={styles.catChip}>
                <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                <Text style={styles.catChipText}>{cat.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Checklist by time group */}
        {(['morning', 'lunch', 'evening'] as const).map((t) => {
          if (!grouped[t].length) return null;
          return (
            <View key={t} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{TIME_LABELS[t]}</Text>
                <View style={styles.sectionLine} />
              </View>
              {grouped[t].map((recipe) => {
                const catId = recipe.catIds[0];
                const cat = cats.find((c) => c.id === catId);
                const key = `${today}_${recipe.id}_${catId}_${t}`;
                const isDone = checks[key]?.done ?? false;
                const sharedNames = recipe.catIds
                  .map((id) => cats.find((c) => c.id === id)?.name)
                  .filter(Boolean).join(', ');
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[styles.checkItem, isDone && styles.checkItemDone]}
                    onPress={() => handleToggleCheck(recipe, catId, t)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkBox, isDone && styles.checkBoxDone]}>
                      {isDone && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                    </View>
                    <View style={styles.checkText}>
                      <Text style={[styles.checkTitle, isDone && styles.checkTitleDone]}>
                        {recipe.name}
                      </Text>
                      <Text style={styles.checkMeta}>{sharedNames}</Text>
                      {checks[key]?.doneAt && (
                        <Text style={styles.doneTime}>
                          ✓ {new Date(checks[key].doneAt!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 완료
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {t === 'morning' ? '아침' : t === 'lunch' ? '점심' : '저녁'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {activeRecipes.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={styles.emptyText}>등록된 루틴 항목이 없습니다</Text>
          </View>
        )}

        {/* Footer notice */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 이 화면은 공유 링크를 통해 접근한 펫시터 전용 뷰입니다.{'\n'}
            체크 내역은 집사에게 실시간으로 전달됩니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: 32 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal, marginTop: 16, marginBottom: 8 },
  errorDesc: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  logo: { fontSize: 20, fontWeight: '800', color: colors.caramel },
  guestBadge: {
    backgroundColor: colors.sand, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  guestText: { fontSize: 12, color: colors.brownMid },
  content: { padding: spacing.lg, paddingBottom: 40 },
  infoCard: {
    backgroundColor: colors.cream, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  hhName: { fontSize: 17, fontWeight: '700', color: colors.charcoal, marginBottom: 4 },
  dateText: { fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: colors.brownMid },
  progressCount: { fontSize: 13, color: colors.caramel, fontWeight: '700' },
  progressBg: { height: 6, backgroundColor: colors.sand, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.caramel, borderRadius: 3 },
  allDoneText: { fontSize: 14, color: colors.sage, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: colors.sand, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
  },
  catChipText: { fontSize: 13, color: colors.brownMid },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#fff', marginBottom: 8, ...shadow.sm,
  },
  checkItemDone: { backgroundColor: colors.checkedBg, borderColor: colors.sageMid },
  checkBox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkBoxDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  checkText: { flex: 1 },
  checkTitle: { fontSize: 15, color: colors.charcoal },
  checkTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  checkMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  doneTime: { fontSize: 11, color: colors.sage, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14, color: colors.muted },
  footer: {
    marginTop: spacing.lg, backgroundColor: colors.warnBg,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: '#FFE082',
  },
  footerText: { fontSize: 12, color: colors.warnText, lineHeight: 20, textAlign: 'center' },
});
