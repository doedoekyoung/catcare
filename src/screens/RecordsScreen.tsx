// src/screens/RecordsScreen.tsx
// REQ-V4-02, V5-03~04

import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { BottomSheet, Button, Input, EmptyState } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { toDateKey, getLast30Days } from '../utils/date';
import { getLogsForDateRange, upsertLog } from '../services/dbService';
import type { DailyLog } from '../types';

const TAG_OPTIONS = [
  { value: '#EF4444', label: '응급' },
  { value: '#F97316', label: '위험' },
  { value: '#EAB308', label: '주의' },
  { value: '#22C55E', label: '안정' },
];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

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
  const { cats, logs, household, user, setLogs } = useStore();

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
    allLogs.forEach((l) => { if (!map[l.date]) map[l.date] = []; map[l.date].push(l); });
    return map;
  }, [allLogs]);
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

              {/* Cat chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md, flexGrow: 0 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
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
            <TouchableOpacity style={styles.calNavBtn} onPress={prevCalMonth}>
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>{calYear}년 {MONTHS_KR[calMonth]}</Text>
            <TouchableOpacity style={styles.calNavBtn} onPress={nextCalMonth}>
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            {TAG_OPTIONS.map((t) => (
              <View key={t.value} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: t.value }]} />
                <Text style={styles.legendText}>{t.label}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.caramel }]} />
              <Text style={styles.legendText}>메모</Text>
            </View>
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
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedCalDate;
              const dayOfWeek = (getFirstDayOfWeek(calYear, calMonth) + day - 1) % 7;

              return (
                <TouchableOpacity
                  key={dateKey}
                  style={[
                    styles.calCell,
                    isSelected && { backgroundColor: colors.caramel + '20' },
                    isToday && styles.calCellToday,
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
});
