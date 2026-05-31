// src/screens/RecordsScreen.tsx
// REQ-V4-02, V5-03~04

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { BottomSheet, Button, Input, EmptyState } from '../components/ui';
import { RoutineChecklist } from '../components/RoutineChecklist';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { toDateKey, getLast30Days } from '../utils/date';
import { getLogsForDateRange, upsertLog, upsertCheck, getChecksForDateRange } from '../services/dbService';
import type { DailyLog, CheckRecord, Recipe, TimeSlot } from '../types';

type MissItem = { recipeId: string; recipeName: string; catId: string; timeSlot: TimeSlot };

const TAG_OPTIONS = [
  { value: '#EF4444', label: '응급' },
  { value: '#F97316', label: '위험' },
  { value: '#EAB308', label: '주의' },
  { value: '#22C55E', label: '안정' },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const TIME_LABEL_KR: Record<TimeSlot, string> = { morning: '아침', lunch: '점심', evening: '저녁' };
const TIME_ORDER: Record<TimeSlot, number> = { morning: 0, lunch: 1, evening: 2 };

function formatDateHeader(dateStr: string, today: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = WEEKDAYS[d.getDay()];
  if (dateStr === today) return `${d.getMonth() + 1}월 ${d.getDate()}일 (${day}) · 오늘`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`;
}

function formatDisplayDateCal(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = WEEKDAYS[d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${day}요일`;
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
}
function formatLogTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? '오전' : '오후';
  const hh = h % 12 || 12;
  return `${ampm} ${hh}:${String(m).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
function toCalKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function RecordsScreen() {
  const { cats, recipes, logs, household, user, setLogs, checks: todayChecks } = useStore();

  const today = toDateKey();
  const [activeTab, setActiveTab] = useState<'write' | 'calendar'>('write');
  const [viewDate, setViewDate] = useState<string>(today);
  const [activeCatFilter, setActiveCatFilter] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const [historyLogs, setHistoryLogs] = useState<DailyLog[]>([]);
  useEffect(() => {
    if (!household?.id) return;
    const days = getLast30Days();
    getLogsForDateRange(household.id, days[0], today).then(setHistoryLogs).catch(() => {});
  }, [household?.id, today]);

  const [historyChecks, setHistoryChecks] = useState<CheckRecord[]>([]);
  useEffect(() => {
    if (!household?.id) return;
    const days = getLast30Days();
    getChecksForDateRange(household.id, days[0], today).then(setHistoryChecks).catch(() => {});
  }, [household?.id, today]);

  const allLogs = useMemo(() => {
    const map: Record<string, DailyLog> = {};
    historyLogs.forEach((l) => { map[l.id] = l; });
    logs.forEach((l) => { map[l.id] = l; });
    return Object.values(map);
  }, [historyLogs, logs]);

  const dayLogs = useMemo(
    () => allLogs.filter((l) => l.date === viewDate),
    [allLogs, viewDate]
  );

  // 필터 변경/고양이 로드 시 전체 모드에서 첫 카드 펼침 기본
  useEffect(() => {
    if (activeCatFilter === null) {
      setExpandedCats(cats.length > 0 ? new Set([cats[0].id]) : new Set());
    }
  }, [activeCatFilter, cats.length]);

  const toggleCard = (catId: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const canGoNext = viewDate < today;
  const goPrev = () => setViewDate(prevDay(viewDate));
  const goNext = () => { if (canGoNext) setViewDate(nextDay(viewDate)); };

  // Memo BottomSheet state
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logText, setLogText] = useState('');
  const [logTagColor, setLogTagColor] = useState<string | null>(null);
  const [logCatId, setLogCatId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const openAddLog = (catId: string | null) => {
    setEditingLogId(null);
    setLogText('');
    setLogTagColor(null);
    setLogCatId(catId);
    setLogModalVisible(true);
  };
  const openEditLog = (log: DailyLog) => {
    setEditingLogId(log.id);
    setLogText(log.text);
    setLogTagColor(log.tagColor ?? null);
    setLogCatId(log.catId ?? null);
    setLogModalVisible(true);
  };
  const handleSaveLog = async () => {
    if (!logText.trim() || !household || !user) return;
    const existing = editingLogId ? allLogs.find((l) => l.id === editingLogId) : null;
    const log: DailyLog = {
      id: existing?.id ?? crypto.randomUUID(),
      date: viewDate,
      text: logText.trim(),
      tagColor: logTagColor ?? undefined,
      catId: logCatId ?? undefined,
      householdId: household.id,
      authorId: user.uid,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertLog(household.id, log);
      setLogs(existing
        ? logs.map((l) => l.id === log.id ? log : l)
        : [...logs, log]);
      // historyLogs에도 반영 — 방금 쓴 메모가 즉시 보이도록
      setHistoryLogs((prev) => {
        const map: Record<string, DailyLog> = {};
        prev.forEach((l) => { map[l.id] = l; });
        map[log.id] = log;
        return Object.values(map);
      });
      setLogModalVisible(false);
      setEditingLogId(null);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(`저장 실패: ${e?.message ?? ''}`);
    }
  };

  const visibleCats = activeCatFilter === null ? cats : cats.filter((c) => c.id === activeCatFilter);
  const commonLogs = dayLogs.filter((l) => !l.catId);

  // Calendar state (preserved)
  const nowDate = new Date();
  const [calYear, setCalYear] = useState(nowDate.getFullYear());
  const [calMonth, setCalMonth] = useState(nowDate.getMonth());
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const logsByDate = useMemo(() => {
    const map: Record<string, DailyLog[]> = {};
    const filtered = activeCatFilter ? allLogs.filter((l) => l.catId === activeCatFilter) : allLogs;
    filtered.forEach((l) => { if (!map[l.date]) map[l.date] = []; map[l.date].push(l); });
    return map;
  }, [allLogs, activeCatFilter]);

  const missByDate = useMemo(() => {
    const result: Record<string, MissItem[]> = {};
    if (!recipes.length) return result;
    const doneKeys = new Set(historyChecks.filter((c) => c.done).map((c) => c.id));
    const days = getLast30Days();
    days.forEach((date) => {
      if (date >= today) return;
      const dow = new Date(date + 'T00:00:00').getDay();
      recipes.forEach((r) => {
        if (!r.active) return;
        if (date < r.createdAt.slice(0, 10)) return;
        const scheduled = (r.days ?? []).length === 0 || (r.days ?? []).includes(dow);
        if (!scheduled) return;
        r.times.forEach((ts) => {
          r.catIds.forEach((catId) => {
            if (activeCatFilter && activeCatFilter !== catId) return;
            const key = `${date}_${r.id}_${catId}_${ts}`;
            if (doneKeys.has(key)) return;
            if (!result[date]) result[date] = [];
            result[date].push({ recipeId: r.id, recipeName: r.name, catId, timeSlot: ts });
          });
        });
      });
    });
    Object.keys(result).forEach((d) => {
      result[d].sort((a, b) => TIME_ORDER[a.timeSlot] - TIME_ORDER[b.timeSlot]);
    });
    return result;
  }, [recipes, historyChecks, activeCatFilter, today]);

  const selectedMisses = selectedCalDate ? (missByDate[selectedCalDate] ?? []) : [];
  const selectedMissesByCat = useMemo(() => {
    const groups: Record<string, MissItem[]> = {};
    selectedMisses.forEach((m) => {
      if (!groups[m.catId]) groups[m.catId] = [];
      groups[m.catId].push(m);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [selectedMisses]);

  const [toggledMissCats, setToggledMissCats] = useState<Set<string>>(new Set());
  useEffect(() => { setToggledMissCats(new Set()); }, [selectedCalDate, activeCatFilter]);

  // 달력에서 선택한 날의 checks (오늘이면 store, 과거면 일회성 fetch).
  // 과거 날짜 루틴 수정용 — 미래는 비활성화이므로 fetch 안 함.
  const [selectedDateChecks, setSelectedDateChecks] = useState<Record<string, CheckRecord>>({});
  const [selectedDateLoading, setSelectedDateLoading] = useState(false);
  // 편집 모드 buffer — pendingChecks는 토글 즉시 반영, 저장 클릭 시 일괄 upsert.
  // originalChecks는 편집 진입 시점의 snapshot(원본). 두 map의 done 차이로 변경 항목 산출.
  const [showEditCheck, setShowEditCheck] = useState(false);
  const [originalChecks, setOriginalChecks] = useState<Record<string, CheckRecord>>({});
  const [pendingChecks, setPendingChecks] = useState<Record<string, CheckRecord>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  useEffect(() => {
    setShowEditCheck(false);
    setOriginalChecks({});
    setPendingChecks({});
    if (!household?.id || !selectedCalDate) {
      setSelectedDateChecks({}); setSelectedDateLoading(false); return;
    }
    if (selectedCalDate === today) {
      setSelectedDateChecks(todayChecks); setSelectedDateLoading(false); return;
    }
    if (selectedCalDate > today) {
      setSelectedDateChecks({}); setSelectedDateLoading(false); return;
    }
    setSelectedDateLoading(true);
    getChecksForDateRange(household.id, selectedCalDate, selectedCalDate)
      .then((arr) => {
        const map: Record<string, CheckRecord> = {};
        arr.forEach((c) => { map[c.id] = c; });
        setSelectedDateChecks(map);
      })
      .catch(() => setSelectedDateChecks({}))
      .finally(() => setSelectedDateLoading(false));
  }, [household?.id, selectedCalDate, today, todayChecks]);

  const selectedCatIdsForCheck = useMemo(
    () => activeCatFilter ? [activeCatFilter] : cats.map((c) => c.id),
    [activeCatFilter, cats]
  );

  const pendingChangeKeys = useMemo(() => {
    const keys = new Set<string>();
    const all = new Set([...Object.keys(pendingChecks), ...Object.keys(originalChecks)]);
    all.forEach((k) => {
      const orig = originalChecks[k]?.done ?? false;
      const cur = pendingChecks[k]?.done ?? false;
      if (orig !== cur) keys.add(k);
    });
    return keys;
  }, [pendingChecks, originalChecks]);

  const openEditMode = () => {
    setOriginalChecks(selectedDateChecks);
    setPendingChecks(selectedDateChecks);
    setShowEditCheck(true);
  };
  const cancelEdit = () => {
    setOriginalChecks({});
    setPendingChecks({});
    setShowEditCheck(false);
  };
  const saveEdit = async () => {
    if (!household || pendingChangeKeys.size === 0) return;
    setSavingEdit(true);
    try {
      const updates: CheckRecord[] = [];
      pendingChangeKeys.forEach((k) => {
        const rec = pendingChecks[k];
        if (rec) updates.push(rec);
      });
      // 순차 실행 — throttleWrite는 key별이라 다른 key끼리는 동시 실행 가능하지만,
      // 일괄 변경은 보통 N <= 수십이라 순차로 충분하고 디버깅이 쉬움.
      for (const rec of updates) {
        await upsertCheck(household.id, rec);
      }
      setSelectedDateChecks(pendingChecks);
      // 미완료 카운트(missByDate)에 즉시 반영
      setHistoryChecks((prev) => {
        const map: Record<string, CheckRecord> = {};
        prev.forEach((c) => { map[c.id] = c; });
        updates.forEach((u) => { map[u.id] = u; });
        return Object.values(map);
      });
      setOriginalChecks({});
      setPendingChecks({});
      setShowEditCheck(false);
    } catch {
      if (typeof window !== 'undefined') window.alert('저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePastToggle = useCallback(
    (recipe: Recipe, catId: string, ts: TimeSlot) => {
      if (!household || !user || !selectedCalDate) return;
      const key = `${selectedCalDate}_${recipe.id}_${catId}_${ts}`;
      const current = pendingChecks[key];
      const newDone = !(current?.done ?? false);
      const record: CheckRecord = {
        id: key, date: selectedCalDate, recipeId: recipe.id, catId,
        done: newDone,
        // 과거 보정 — 정확한 시각을 모르므로 doneAt은 비움.
        doneAt: undefined,
        doneBy: user.uid,
        householdId: household.id,
        memo: current?.memo,
      };
      setPendingChecks((prev) => ({ ...prev, [key]: record }));
    },
    [household, user, selectedCalDate, pendingChecks]
  );
  const toggleMissCat = (catId: string) => {
    setToggledMissCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };
  const isMissCatOpen = (catId: string, idx: number) => {
    const toggled = toggledMissCats.has(catId);
    return idx === 0 ? !toggled : toggled;
  };
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
  const selectedLogs = selectedCalDate ? (logsByDate[selectedCalDate] ?? []) : [];

  // 달력 날짜 → 쓰기 탭으로 점프
  const jumpToWrite = (dateKey: string) => {
    setViewDate(dateKey);
    setActiveCatFilter(null);
    setActiveTab('write');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록</Text>
      </View>

      {/* Sub-tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          testID="records-tab-write"
          style={[styles.tab, activeTab === 'write' && styles.tabActive]}
          onPress={() => setActiveTab('write')}
        >
          <Text style={[styles.tabText, activeTab === 'write' && styles.tabTextActive]}>쓰기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="records-tab-calendar"
          style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>달력</Text>
        </TouchableOpacity>
      </View>

      {/* Cat filter chips — 쓰기/달력 공통 */}
      {cats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipBarScroll}
        >
          <View style={styles.chipBarContent}>
            <TouchableOpacity
              testID="records-chip-all"
              style={[styles.chip, activeCatFilter === null && styles.chipActive]}
              onPress={() => setActiveCatFilter(null)}
            >
              <Text style={[styles.chipText, activeCatFilter === null && styles.chipTextActive]}>전체</Text>
            </TouchableOpacity>
            {cats.map((c) => (
              <TouchableOpacity
                key={c.id}
                testID={`records-chip-${c.id}`}
                style={[styles.chip, activeCatFilter === c.id && styles.chipActive]}
                onPress={() => setActiveCatFilter(c.id)}
              >
                <Text style={[styles.chipText, activeCatFilter === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {activeTab === 'write' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {cats.length === 0 ? (
            <EmptyState
              title="고양이를 먼저 등록해주세요"
              desc="고양이 탭에서 첫 고양이를 등록한 뒤 메모를 작성할 수 있어요"
            />
          ) : (
            <>
              {/* Date nav */}
              <View style={styles.dateNav}>
                <TouchableOpacity style={styles.dateArrow} onPress={goPrev} testID="records-date-prev">
                  <Text style={styles.dateArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.dateLabel}>{formatDateHeader(viewDate, today)}</Text>
                <TouchableOpacity
                  style={[styles.dateArrow, !canGoNext && { opacity: 0.3 }]}
                  onPress={goNext}
                  disabled={!canGoNext}
                  testID="records-date-next"
                >
                  <Text style={styles.dateArrowText}>›</Text>
                </TouchableOpacity>
              </View>

              {/* 전체 모드 요약 카드 */}
              {activeCatFilter === null && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>
                    {viewDate === today ? '오늘 전체 요약' : '이 날 전체 요약'}
                  </Text>
                  <Text style={styles.summaryValue}>메모 {dayLogs.length}개</Text>
                </View>
              )}

              {/* Cat accordion cards */}
              {visibleCats.map((cat) => {
                const isOpen = activeCatFilter === cat.id || (activeCatFilter === null && expandedCats.has(cat.id));
                const catLogs = dayLogs.filter((l) => l.catId === cat.id);
                const tagColor = cat.tagColor ?? colors.caramel;

                return (
                  <View key={cat.id} style={styles.catCard} testID={`records-cat-card-${cat.id}`}>
                    <TouchableOpacity
                      style={styles.catCardHead}
                      testID={`records-cat-header-${cat.id}`}
                      onPress={() => {
                        if (activeCatFilter === null) toggleCard(cat.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[styles.catDot, { backgroundColor: tagColor }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.catName}>{cat.name}</Text>
                          <Text style={[styles.catSum, catLogs.length === 0 && { color: colors.caramel }]}>
                            {catLogs.length === 0 ? '메모 없음 · 탭해서 추가' : `메모 ${catLogs.length}개`}
                          </Text>
                        </View>
                      </View>
                      {activeCatFilter === null && (
                        <Text style={[styles.chev, isOpen && { color: colors.brownMid }]}>
                          {isOpen ? '▲' : '▼'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={styles.catCardBody}>
                        {catLogs.map((log) => {
                          const tagOption = log.tagColor ? TAG_OPTIONS.find((t) => t.value === log.tagColor) : null;
                          return (
                            <TouchableOpacity
                              key={log.id}
                              style={styles.memoItem}
                              onPress={() => openEditLog(log)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.memoMeta}>
                                <Text style={styles.memoTime}>{formatLogTime(log.createdAt)}</Text>
                                {tagOption && (
                                  <View style={[styles.tagBadge, { backgroundColor: tagOption.value + '20', borderColor: tagOption.value }]}>
                                    <Text style={[styles.tagBadgeText, { color: tagOption.value }]}>{tagOption.label}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.memoText}>{log.text}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        <Button
                          testID={`records-add-log-${cat.id}`}
                          label="+ 메모 추가"
                          variant="secondary"
                          size="sm"
                          onPress={() => openAddLog(cat.id)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}

              {/* 공통 메모 — 전체 모드에서만, catId 없는 메모 모음 */}
              {activeCatFilter === null && commonLogs.length > 0 && (
                <View style={styles.catCard}>
                  <View style={styles.catCardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catName}>공통 메모</Text>
                      <Text style={styles.catSum}>고양이 지정 없음 · {commonLogs.length}개</Text>
                    </View>
                  </View>
                  <View style={styles.catCardBody}>
                    {commonLogs.map((log) => {
                      const tagOption = log.tagColor ? TAG_OPTIONS.find((t) => t.value === log.tagColor) : null;
                      return (
                        <TouchableOpacity
                          key={log.id}
                          style={styles.memoItem}
                          onPress={() => openEditLog(log)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.memoMeta}>
                            <Text style={styles.memoTime}>{formatLogTime(log.createdAt)}</Text>
                            {tagOption && (
                              <View style={[styles.tagBadge, { backgroundColor: tagOption.value + '20', borderColor: tagOption.value }]}>
                                <Text style={[styles.tagBadgeText, { color: tagOption.value }]}>{tagOption.label}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.memoText}>{log.text}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Month navigation */}
          <View style={styles.calHeader}>
            <TouchableOpacity testID="records-cal-prev-month" style={styles.calNavBtn} onPress={prevCalMonth}>
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>{calYear}년 {MONTHS_KR[calMonth]}</Text>
            <TouchableOpacity testID="records-cal-next-month" style={styles.calNavBtn} onPress={nextCalMonth}>
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={styles.legendMissBadge}>
                <Text style={styles.legendMissText}>N</Text>
              </View>
              <Text style={styles.legendText}>미완료</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.caramel }]} />
              <Text style={styles.legendText}>메모</Text>
            </View>
            {TAG_OPTIONS.map((t) => (
              <View key={t.value} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: t.value }]} />
                <Text style={styles.legendText}>{t.label}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calGrid}>
            {WEEKDAYS.map((w, i) => (
              <View key={w} style={styles.calDayHeader}>
                <Text style={[styles.calDayHeaderText, i === 0 && { color: '#EF4444' }, i === 6 && { color: '#3B82F6' }]}>
                  {w}
                </Text>
              </View>
            ))}
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.calCell} />;
              }
              const dateKey = toCalKey(calYear, calMonth, day);
              const dateLogs = logsByDate[dateKey] ?? [];
              const missCount = (missByDate[dateKey] ?? []).length;
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedCalDate;
              const isFuture = dateKey > today;
              const dayOfWeek = (getFirstDayOfWeek(calYear, calMonth) + day - 1) % 7;

              return (
                <TouchableOpacity
                  testID={`records-cal-day-${dateKey}`}
                  key={dateKey}
                  disabled={isFuture}
                  style={[
                    styles.calCell,
                    isSelected && { backgroundColor: colors.caramel + '20' },
                    isToday && styles.calCellToday,
                    isFuture && { opacity: 0.35 },
                  ]}
                  onPress={() => setSelectedCalDate(isSelected ? null : dateKey)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.calDayNum,
                    isToday && styles.calDayNumToday,
                    dayOfWeek === 0 && { color: '#EF4444' },
                    dayOfWeek === 6 && { color: '#3B82F6' },
                  ]}>
                    {day}
                  </Text>
                  {dateLogs.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 2, justifyContent: 'center' }}>
                      {dateLogs.slice(0, 3).map((log) => (
                        <View key={log.id} style={[styles.calDot, { backgroundColor: log.tagColor ?? colors.caramel }]} />
                      ))}
                    </View>
                  )}
                  {missCount > 0 && (
                    <View style={[styles.missBadge, missCount >= 10 && styles.missBadgeWide]}>
                      <Text style={styles.missBadgeText}>{missCount >= 10 ? '9+' : missCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day detail */}
          {selectedCalDate && (
            <View style={[styles.selectedLogCard, shadow.sm]}>
              <View style={styles.selectedLogHeader}>
                <Text style={styles.selectedLogDate}>{formatDisplayDateCal(selectedCalDate)}</Text>
              </View>

              {selectedMisses.length > 0 && (
                <View style={styles.missBlock}>
                  <View style={styles.missBlockHead}>
                    <Text style={styles.missBlockTitle}>
                      {activeCatFilter
                        ? `✗ ${cats.find((c) => c.id === activeCatFilter)?.name ?? ''}의 미완료 루틴 ${selectedMisses.length}건`
                        : `✗ 미완료 루틴 ${selectedMisses.length}건`}
                    </Text>
                    {!activeCatFilter && selectedMissesByCat.length > 0 && (
                      <Text style={styles.missBlockSub}>{selectedMissesByCat.length}마리</Text>
                    )}
                  </View>
                  {activeCatFilter ? (
                    selectedMisses.map((m, i) => (
                      <View
                        key={`${m.recipeId}_${m.catId}_${m.timeSlot}`}
                        style={[styles.missFlatItem, i > 0 && styles.missFlatItemBorder]}
                      >
                        <View style={styles.missSlot}>
                          <Text style={styles.missSlotText}>{TIME_LABEL_KR[m.timeSlot]}</Text>
                        </View>
                        <Text style={styles.missFlatName}>{m.recipeName}</Text>
                      </View>
                    ))
                  ) : (
                    selectedMissesByCat.map(([catId, items], idx) => {
                      const cat = cats.find((c) => c.id === catId);
                      const tagColor = cat?.tagColor ?? colors.caramel;
                      const open = isMissCatOpen(catId, idx);
                      return (
                        <View key={catId} style={styles.missCatGroup}>
                          <TouchableOpacity
                            style={styles.missCatHead}
                            onPress={() => toggleMissCat(catId)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.missCatDot, { backgroundColor: tagColor }]} />
                            <Text style={styles.missCatName}>{cat?.name ?? '—'}</Text>
                            <View style={styles.missCountPill}>
                              <Text style={styles.missCountText}>{items.length}</Text>
                            </View>
                            <Text style={styles.missChev}>{open ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                          {open && (
                            <View style={styles.missCatBody}>
                              {items.map((m) => (
                                <View key={`${m.recipeId}_${m.timeSlot}`} style={styles.missCatItem}>
                                  <View style={styles.missSlot}>
                                    <Text style={styles.missSlotText}>{TIME_LABEL_KR[m.timeSlot]}</Text>
                                  </View>
                                  <Text style={styles.missCatItemName}>{m.recipeName}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* 과거/오늘 날짜 — 체크 수정 편집 모드 (저장/취소) */}
              <View style={styles.editCheckWrap}>
                {!showEditCheck ? (
                  <TouchableOpacity
                    testID="records-cal-edit-toggle"
                    style={[styles.editCheckToggle, selectedDateLoading && { opacity: 0.5 }]}
                    onPress={openEditMode}
                    disabled={selectedDateLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editCheckToggleText}>
                      {selectedDateLoading ? '불러오는 중...' : '✓ 이 날의 체크 수정'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View testID="records-cal-edit-body">
                    <RoutineChecklist
                      date={selectedCalDate}
                      cats={cats}
                      recipes={recipes}
                      selectedCatIds={selectedCatIdsForCheck}
                      checks={pendingChecks}
                      onToggle={handlePastToggle}
                      testIDPrefix="records-cal-check"
                      highlightedKeys={pendingChangeKeys}
                    />
                    <View style={styles.editCheckActions}>
                      <Button
                        label="취소"
                        variant="ghost"
                        onPress={cancelEdit}
                        testID="records-cal-edit-cancel"
                      />
                      <Button
                        label={pendingChangeKeys.size > 0 ? `저장 (${pendingChangeKeys.size}개 변경)` : '저장'}
                        onPress={saveEdit}
                        disabled={pendingChangeKeys.size === 0}
                        loading={savingEdit}
                        testID="records-cal-edit-save"
                      />
                    </View>
                  </View>
                )}
              </View>

              {selectedLogs.length > 0 ? (
                selectedLogs.map((log) => {
                  const tagOption = log.tagColor ? TAG_OPTIONS.find((t) => t.value === log.tagColor) : null;
                  const logCat = log.catId ? cats.find((c) => c.id === log.catId) : null;
                  return (
                    <View key={log.id} style={selectedLogs.length > 1 ? { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0e8df' } : undefined}>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        {tagOption && (
                          <View style={[styles.logTagBadge, { backgroundColor: tagOption.value + '20', borderColor: tagOption.value }]}>
                            <View style={[styles.logTagDot, { backgroundColor: tagOption.value }]} />
                            <Text style={[styles.logTagText, { color: tagOption.value }]}>{tagOption.label}</Text>
                          </View>
                        )}
                        {logCat && (
                          <View style={[styles.logTagBadge, { backgroundColor: (logCat.tagColor ?? colors.caramel) + '20', borderColor: logCat.tagColor ?? colors.caramel }]}>
                            <View style={[styles.logTagDot, { backgroundColor: logCat.tagColor ?? colors.caramel }]} />
                            <Text style={[styles.logTagText, { color: logCat.tagColor ?? colors.caramel }]}>{logCat.name}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.selectedLogText}>{log.text}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.selectedLogEmpty}>이 날의 메모가 없어요</Text>
              )}
              <Button
                label="이 날짜로 쓰기 열기"
                variant="ghost"
                size="sm"
                onPress={() => jumpToWrite(selectedCalDate)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}

          {logs.length === 0 && (
            <EmptyState
              title="아직 메모가 없어요"
              desc="쓰기 탭에서 오늘의 메모를 작성해보세요"
            />
          )}
        </ScrollView>
      )}

      {/* Memo BottomSheet */}
      <BottomSheet
        visible={logModalVisible}
        onClose={() => { setLogModalVisible(false); setEditingLogId(null); }}
        title={editingLogId ? '메모 수정' : '메모 추가'}
      >
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
                  const selected = logCatId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.tagChip, { borderColor: color, backgroundColor: selected ? color : color + '18' }]}
                      onPress={() => setLogCatId(selected ? null : cat.id)}
                    >
                      <Text style={[styles.tagChipText, { color: selected ? '#fff' : color }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
        <Input
          testID="log-form-text-input"
          label="메모"
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
          <Button testID="log-form-save-button" label="저장" variant="primary" onPress={handleSaveLog} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: colors.border,
    backgroundColor: colors.warmWhite,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.caramel },
  tabText: { fontSize: 14, color: colors.muted },
  tabTextActive: { color: colors.caramel, fontWeight: '600' },
  content: { padding: spacing.lg, paddingBottom: 80 },

  // Write mode
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4, marginBottom: spacing.md,
  },
  dateArrow: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cream,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dateArrowText: { fontSize: 18, color: colors.brownMid, lineHeight: 20 },
  dateLabel: { fontSize: 15, fontWeight: '600', color: colors.brownMid },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  chipText: { fontSize: 13, color: colors.brownMid },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  chipBarScroll: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexShrink: 0, flexGrow: 0, backgroundColor: colors.warmWhite,
  },
  chipBarContent: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 10,
  },
  summaryCard: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  summaryLabel: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  summaryValue: { fontSize: 14, color: colors.charcoal, fontWeight: '600' },
  catCard: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, marginBottom: 10, overflow: 'hidden',
  },
  catCardHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 8,
  },
  catDot: { width: 12, height: 12, borderRadius: 6 },
  catName: { fontSize: 15, fontWeight: '600', color: colors.charcoal },
  catSum: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chev: { fontSize: 10, color: colors.muted, width: 16, textAlign: 'center' },
  catCardBody: {
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  memoItem: {
    backgroundColor: colors.cream, borderRadius: radius.sm,
    padding: 10,
  },
  memoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  memoTime: { fontSize: 11, color: colors.muted },
  tagBadge: {
    paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.full,
    borderWidth: 1,
  },
  tagBadgeText: { fontSize: 11, fontWeight: '600' },
  memoText: { fontSize: 14, color: colors.charcoal, lineHeight: 20 },

  // BottomSheet chip styles
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

  // Calendar styles (preserved)
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
    flexDirection: 'row', gap: 12, marginBottom: spacing.md, flexWrap: 'wrap',
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
  missBadge: {
    position: 'absolute', top: 3, right: 3,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#fff',
  },
  missBadgeWide: { minWidth: 20, paddingHorizontal: 3 },
  missBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', lineHeight: 10 },
  legendMissBadge: {
    backgroundColor: '#EF4444', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  legendMissText: { color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 10 },
  missBlock: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: radius.md, padding: 12, marginBottom: spacing.md,
  },
  missBlockHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  missBlockTitle: { fontSize: 13, color: '#EF4444', fontWeight: '700', flex: 1 },
  missBlockSub: { fontSize: 11, color: colors.muted },
  missFlatItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
  },
  missFlatItemBorder: {
    borderTopWidth: 1, borderTopColor: 'rgba(239,68,68,0.15)',
  },
  missFlatName: { fontSize: 13, color: colors.charcoal, flex: 1 },
  missCatGroup: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 10, marginBottom: 8, overflow: 'hidden',
  },
  missCatHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, backgroundColor: 'rgba(239,68,68,0.04)',
  },
  missCatDot: { width: 10, height: 10, borderRadius: 5 },
  missCatName: { fontSize: 13, fontWeight: '700', color: colors.charcoal, flex: 1 },
  missCountPill: {
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  missCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  missChev: { fontSize: 10, color: colors.muted, width: 16, textAlign: 'center', marginLeft: 4 },
  missCatBody: { padding: 10, borderTopWidth: 1, borderTopColor: colors.border },
  missCatItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  missCatItemName: { fontSize: 12, color: colors.charcoal, flex: 1 },
  missSlot: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    minWidth: 36, alignItems: 'center',
  },
  missSlotText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  selectedLogCard: {
    backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg,
  },
  selectedLogHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  selectedLogDate: { fontSize: 13, color: colors.brownMid, fontWeight: '600' },
  logTagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 8,
  },
  logTagDot: { width: 8, height: 8, borderRadius: 4 },
  logTagText: { fontSize: 11, fontWeight: '600' },
  selectedLogText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  selectedLogEmpty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 8 },
  editCheckWrap: {
    marginTop: spacing.md, marginBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md,
  },
  editCheckToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.caramel,
    backgroundColor: colors.caramel + '12',
  },
  editCheckToggleText: { fontSize: 12, fontWeight: '600', color: colors.caramel },
  editCheckActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm,
    marginTop: spacing.md,
  },
});
