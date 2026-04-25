// src/screens/ShareScreen.tsx
// REQ-V1-04: 비회원 공유 링크 — 읽기 + 체크 권한
// 익명 사용자는 RLS에 막히므로 SECURITY DEFINER RPC(share_get_data/checks/upsert_check)를 통해서만 데이터 접근.
// 실시간 구독 대신 30초 폴링 + 수동 새로고침으로 최신화.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
  shareGetData, shareGetChecks, shareUpsertCheck,
  shareGetLogs, shareInsertLog,
} from '../services/dbService';
import { Button, Input, Card, BottomSheet } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import InAppBrowserBanner from '../components/InAppBrowserBanner';
import { toDateKey, formatFullDate } from '../utils/date';
import type { Cat, Recipe, CheckRecord, Household, TimeSlot, DailyLog } from '../types';
import type { RootStackParamList } from '../types';

const TAG_OPTIONS = [
  { value: '#EF4444', label: '응급' },
  { value: '#F97316', label: '위험' },
  { value: '#EAB308', label: '주의' },
  { value: '#22C55E', label: '안정' },
];
const MAX_LOGS = 5;

type RouteProps = RouteProp<RootStackParamList, 'ShareLink'>;

const TIME_LABELS: Record<TimeSlot, string> = { morning: '아침', lunch: '점심', evening: '저녁' };
const TIME_SLOTS: TimeSlot[] = ['morning', 'lunch', 'evening'];
const POLL_INTERVAL_MS = 30_000;

export default function ShareScreen() {
  const route = useRoute<RouteProps>();
  const token = route.params?.token ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [checks, setChecks] = useState<Record<string, CheckRecord>>({});
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  // 메모 작성 모달 상태 (펫시터는 추가만 가능, 수정·삭제 불가)
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logText, setLogText] = useState('');
  const [logTagColor, setLogTagColor] = useState<string | null>(null);
  const [logCatId, setLogCatId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = toDateKey();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChecks = useCallback(async () => {
    if (!token) return;
    const list = await shareGetChecks(token, today);
    const map: Record<string, CheckRecord> = {};
    list.forEach((c) => { map[c.id] = c; });
    setChecks(map);
  }, [token, today]);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    const list = await shareGetLogs(token, today);
    setLogs(list);
  }, [token, today]);

  const loadAll = useCallback(async () => {
    if (!token) { setError('공유 링크가 올바르지 않습니다.'); return; }
    const bundle = await shareGetData(token);
    if (!bundle) {
      setError('유효하지 않거나 만료된 링크입니다. 집사에게 새 링크를 요청하세요.');
      return;
    }
    setHousehold(bundle.household);
    setCats(bundle.cats);
    setRecipes(bundle.recipes);
    await loadChecks();
    // 메모 RPC가 서버에 아직 없을 수 있음 — 실패해도 본 화면은 정상 노출
    await loadLogs().catch(() => {});
  }, [token, loadChecks, loadLogs]);

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (e: any) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAll]);

  // 폴링: 펫시터가 화면을 열어두는 동안 다른 집사의 체크·메모를 반영
  useEffect(() => {
    if (error || loading) return;
    pollRef.current = setInterval(() => {
      loadChecks().catch(() => {});
      loadLogs().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [error, loading, loadChecks, loadLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([loadChecks(), loadLogs()]); } catch {}
    setRefreshing(false);
  }, [loadChecks, loadLogs]);

  const openLogModal = useCallback(() => {
    setLogText('');
    setLogTagColor(null);
    setLogCatId(activeCatId);
    setLogModalVisible(true);
  }, [activeCatId]);

  const handleSaveLog = useCallback(async () => {
    const text = logText.trim();
    if (!text || saving) return;
    if (logs.length >= MAX_LOGS) {
      if (typeof window !== 'undefined') window.alert(`메모는 하루 최대 ${MAX_LOGS}개까지 등록할 수 있습니다.`);
      return;
    }
    setSaving(true);
    try {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await shareInsertLog(token, {
        id, date: today, catId: logCatId, text, tagColor: logTagColor,
      });
      await loadLogs();
      setLogModalVisible(false);
      setLogText('');
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(`저장 실패: ${e?.message ?? ''}`);
    } finally {
      setSaving(false);
    }
  }, [logText, saving, logs.length, token, today, logCatId, logTagColor, loadLogs]);

  const handleToggleCheck = useCallback(
    async (recipe: Recipe, catId: string, timeSlot: TimeSlot) => {
      if (!household) return;
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
        doneBy: 'guest',
        householdId: household.id,
      };
      // 낙관적 업데이트
      setChecks((prev) => ({ ...prev, [key]: record }));
      try {
        await shareUpsertCheck(token, record);
      } catch (e: any) {
        console.error('[share-check] upsert failed:', e?.message);
        setChecks((prev) => {
          const next = { ...prev };
          if (current) next[key] = current; else delete next[key];
          return next;
        });
      }
    },
    [checks, household, today, token]
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <InAppBrowserBanner />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>링크를 열 수 없습니다</Text>
          <Text style={styles.errorDesc}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 활성 루틴에서 선택된 고양이 기준으로 필터링
  const filteredRecipes = recipes.filter((r) => {
    if (!r.active) return false;
    if (activeCatId === null) return true;
    return r.catIds.includes(activeCatId);
  });

  const grouped: Record<TimeSlot, Recipe[]> = { morning: [], lunch: [], evening: [] };
  filteredRecipes.forEach((r) => r.times.forEach((t) => {
    if (!grouped[t].includes(r)) grouped[t].push(r);
  }));

  // 진행도: 선택된 고양이 기준. 전체 탭에선 모든 고양이 합산.
  let total = 0; let done = 0;
  filteredRecipes.forEach((r) => {
    const catsForThis = activeCatId ? [activeCatId] : r.catIds;
    catsForThis.forEach((cid) => {
      r.times.forEach((t) => {
        total++;
        if (checks[`${today}_${r.id}_${cid}_${t}`]?.done) done++;
      });
    });
  });
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <InAppBrowserBanner />
      <View style={styles.header}>
        <Text style={styles.logo}>CatCare</Text>
        <View style={styles.guestBadge}>
          <Text style={styles.guestText}>펫시터 뷰</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.caramel} />}
      >
        <View style={[styles.infoCard, shadow.sm]}>
          <Text style={styles.hhName}>{household?.name}</Text>
          <Text style={styles.dateText}>{formatFullDate(today)}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>완료 현황</Text>
            <Text style={styles.progressCount}>{done} / {total}</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
          {total > 0 && pct === 100 && (
            <Text style={styles.allDoneText}>오늘 루틴을 모두 완료했어요</Text>
          )}
        </View>

        {/* 고양이 탭 */}
        {cats.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[styles.catChip, activeCatId === null && styles.catChipActive]}
                onPress={() => setActiveCatId(null)}
              >
                <Text style={[styles.catChipText, activeCatId === null && styles.catChipTextActive]}>전체</Text>
              </TouchableOpacity>
              {cats.map((cat) => {
                const sel = activeCatId === cat.id;
                const tag = cat.tagColor ?? colors.caramel;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, sel && { backgroundColor: tag + '22', borderColor: tag }]}
                    onPress={() => setActiveCatId(cat.id)}
                  >
                    <View style={[styles.catChipDot, { backgroundColor: tag }]} />
                    <Text style={[styles.catChipText, sel && { color: tag, fontWeight: '700' }]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {TIME_SLOTS.map((t) => {
          if (!grouped[t].length) return null;
          return (
            <View key={t} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{TIME_LABELS[t]}</Text>
                <View style={styles.sectionLine} />
              </View>
              {grouped[t].map((recipe) => {
                const catsForThis = activeCatId
                  ? recipe.catIds.filter((id) => id === activeCatId)
                  : recipe.catIds;
                return catsForThis.map((catId) => {
                  const cat = cats.find((c) => c.id === catId);
                  const tag = cat?.tagColor ?? colors.caramel;
                  const key = `${today}_${recipe.id}_${catId}_${t}`;
                  const isDone = checks[key]?.done ?? false;
                  return (
                    <TouchableOpacity
                      key={key}
                      testID={`share-check-${recipe.id}-${catId}-${t}`}
                      style={[
                        styles.checkItem,
                        isDone
                          ? { backgroundColor: tag + '18', borderColor: tag + '60' }
                          : { backgroundColor: '#fff', borderColor: tag + '50' },
                        { borderLeftWidth: 3, borderLeftColor: tag },
                      ]}
                      onPress={() => handleToggleCheck(recipe, catId, t)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkBox, isDone && { backgroundColor: tag, borderColor: tag }]}>
                        {isDone && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                      </View>
                      <View style={styles.checkText}>
                        <Text style={[styles.checkTitle, isDone && styles.checkTitleDone]}>{recipe.name}</Text>
                        {cat && <Text style={styles.checkMeta}>{cat.name}</Text>}
                        {checks[key]?.doneAt && (
                          <Text style={styles.doneTime}>
                            {new Date(checks[key].doneAt!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 완료
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                });
              })}
            </View>
          );
        })}

        {filteredRecipes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>등록된 루틴이 없습니다</Text>
          </View>
        )}

        {/* 메모 섹션 — 오늘 기록 조회 + 펫시터용 추가 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>오늘의 메모</Text>
            <View style={styles.sectionLine} />
          </View>
          {logs.length > 0 && logs.map((log) => {
            const logCat = log.catId ? cats.find((c) => c.id === log.catId) : null;
            return (
              <Card key={log.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  {log.tagColor && (
                    <View style={[styles.logTagBadge, { backgroundColor: log.tagColor + '20', borderColor: log.tagColor }]}>
                      <View style={[styles.logTagDot, { backgroundColor: log.tagColor }]} />
                      <Text style={[styles.logTagText, { color: log.tagColor }]}>
                        {TAG_OPTIONS.find((t) => t.value === log.tagColor)?.label ?? ''}
                      </Text>
                    </View>
                  )}
                  {logCat && (
                    <View style={[styles.logTagBadge, { backgroundColor: (logCat.tagColor ?? colors.caramel) + '20', borderColor: logCat.tagColor ?? colors.caramel }]}>
                      <View style={[styles.logTagDot, { backgroundColor: logCat.tagColor ?? colors.caramel }]} />
                      <Text style={[styles.logTagText, { color: logCat.tagColor ?? colors.caramel }]}>{logCat.name}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.logText}>{log.text}</Text>
              </Card>
            );
          })}
          {logs.length < MAX_LOGS ? (
            <Button
              testID="share-log-add-button"
              label="+ 메모 추가"
              variant="secondary"
              size="sm"
              onPress={openLogModal}
              style={{ marginTop: 4 }}
            />
          ) : (
            <Text style={styles.logLimitText}>오늘 메모가 가득 찼습니다 ({MAX_LOGS}/{MAX_LOGS})</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            이 화면은 공유 링크를 통해 접근한 펫시터 전용 뷰입니다.{'\n'}
            체크·메모 내역은 집사에게 전달됩니다.
          </Text>
        </View>
      </ScrollView>

      <BottomSheet
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        title="메모 추가"
      >
        {cats.length > 0 && (
          <View style={styles.catSelectRow}>
            <Text style={styles.tagLabel}>고양이</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.tagChip, { borderColor: colors.border }, logCatId === null && styles.tagChipSelected]}
                  onPress={() => setLogCatId(null)}
                >
                  <Text style={[styles.tagChipText, logCatId === null && { color: colors.charcoal, fontWeight: '600' }]}>전체</Text>
                </TouchableOpacity>
                {cats.map((cat) => {
                  const c = cat.tagColor ?? colors.caramel;
                  const sel = logCatId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.tagChip, { borderColor: c, backgroundColor: sel ? c : c + '18' }]}
                      onPress={() => setLogCatId(sel ? null : cat.id)}
                    >
                      <Text style={[styles.tagChipText, { color: sel ? '#fff' : c }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
        <Input
          testID="share-log-text-input"
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
              style={[styles.tagChip, { borderColor: colors.border }, logTagColor === null && styles.tagChipSelected]}
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
          <Button
            testID="share-log-save-button"
            label={saving ? '저장 중...' : '저장'}
            variant="primary"
            onPress={handleSaveLog}
            disabled={saving || !logText.trim()}
            style={{ flex: 1 }}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.charcoal, marginBottom: 8 },
  errorDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 22 },
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
    padding: spacing.md, marginBottom: spacing.md,
  },
  hhName: { fontSize: 17, fontWeight: '700', color: colors.charcoal, marginBottom: 4 },
  dateText: { fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: colors.brownMid },
  progressCount: { fontSize: 13, color: colors.caramel, fontWeight: '700' },
  progressBg: { height: 6, backgroundColor: colors.sand, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.caramel, borderRadius: 3 },
  allDoneText: { fontSize: 13, color: colors.sage, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: colors.cream, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.caramel + '18', borderColor: colors.caramel,
  },
  catChipDot: { width: 8, height: 8, borderRadius: 4 },
  catChipText: { fontSize: 12, color: colors.muted },
  catChipTextActive: { color: colors.caramel, fontWeight: '700' },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, marginBottom: 8, ...shadow.sm,
  },
  checkBox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
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
  logTagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  logTagDot: { width: 6, height: 6, borderRadius: 3 },
  logTagText: { fontSize: 11, fontWeight: '600' },
  logText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  logLimitText: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 8 },
  catSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: spacing.md,
  },
  tagLabel: { fontSize: 12, color: colors.muted, minWidth: 44 },
  tagRow: { marginBottom: spacing.sm },
  tagOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tagChip: {
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: radius.full, borderWidth: 1.5,
    backgroundColor: colors.cream,
  },
  tagChipSelected: { backgroundColor: colors.warmWhite },
  tagChipText: { fontSize: 12, color: colors.muted },
});
