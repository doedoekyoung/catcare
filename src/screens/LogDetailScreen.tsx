// src/screens/LogDetailScreen.tsx
// REQ-V4-02~05: 날짜별 로그 상세, 항목별 메모, 이미지 첨부, 통합 타임라인

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/useStore';
import { upsertCheck, upsertLog, uploadPhoto, deleteLog } from '../services/dbService';
import { Card, Input, Button, BottomSheet, Tag } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { formatFullDate, formatTime } from '../utils/date';
import type { RootStackParamList, CheckRecord, DailyLog } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'LogDetail'>;

export default function LogDetailScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { cats, recipes, checks, logs, household, user, setChecks, setLogs } = useStore();

  const date = route.params.date;

  // All check records for this date
  const dayChecks = useMemo(
    () => Object.values(checks).filter((c) => c?.date === date),
    [checks, date]
  );
  // All logs for this date
  const dayLogs = useMemo(
    () => logs.filter((l) => l.date === date),
    [logs, date]
  );

  const [memoModal, setMemoModal] = useState(false);
  const [activeMemoCheckId, setActiveMemoCheckId] = useState('');
  const [memoText, setMemoText] = useState('');
  const [logModal, setLogModal] = useState(false);
  const [logText, setLogText] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);

  // ── Memo per check item (REQ-V4-03) ──────────────────────────────────────

  const openMemoModal = (checkId: string, existing?: string) => {
    setActiveMemoCheckId(checkId);
    setMemoText(existing ?? '');
    setMemoModal(true);
  };

  const handleSaveMemo = async () => {
    if (!household) return;
    const check = checks[activeMemoCheckId];
    if (!check) return;
    const updated: CheckRecord = { ...check, memo: memoText.trim() };
    await upsertCheck(household.id, updated);
    setChecks({ ...checks, [activeMemoCheckId]: updated });
    setMemoModal(false);
  };

  // ── Daily log text ────────────────────────────────────────────────────────

  const openLogModal = (existing?: DailyLog) => {
    setLogText(existing?.text ?? '');
    setLogModal(true);
  };

  const handleSaveLog = async () => {
    if (!logText.trim() || !household || !user) return;
    const existing = dayLogs[0];
    const log: DailyLog = {
      id: existing?.id ?? `${date}_${user.uid}`,
      date,
      text: logText.trim(),
      householdId: household.id,
      authorId: user.uid,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      photoUri: existing?.photoUri,
    };
    await upsertLog(household.id, log);
    setLogs(logs.map((l) => l.id === log.id ? log : l)
      .concat(existing ? [] : [log]));
    setLogModal(false);
  };

  const handleDeleteLog = (log: DailyLog) => {
    Alert.alert('로그 삭제', '이 메모를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          if (!household) return;
          await deleteLog(household.id, log.id);
          setLogs(logs.filter((l) => l.id !== log.id));
        },
      },
    ]);
  };

  // ── Photo attach (REQ-V4-04) ──────────────────────────────────────────────

  const handlePickPhoto = async (log: DailyLog) => {
    if (!household) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled) return;
    setPhotoLoading(true);
    try {
      const url = await uploadPhoto(
        household.id,
        result.assets[0].uri,
        `logs/${log.id}.jpg`
      );
      const updated = { ...log, photoUri: url };
      await upsertLog(household.id, updated);
      setLogs(logs.map((l) => l.id === log.id ? updated : l));
    } finally {
      setPhotoLoading(false);
    }
  };

  // ── Unified timeline items ────────────────────────────────────────────────

  type TimelineItem =
    | { kind: 'check'; check: CheckRecord; time: string }
    | { kind: 'log'; log: DailyLog; time: string };

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    dayChecks.filter((c) => c.done && c.doneAt).forEach((c) => {
      items.push({ kind: 'check', check: c, time: c.doneAt! });
    });
    dayLogs.forEach((l) => {
      items.push({ kind: 'log', log: l, time: l.createdAt });
    });
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [dayChecks, dayLogs]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.caramel }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{formatFullDate(date)}</Text>
        <TouchableOpacity style={styles.addLogBtn} onPress={() => openLogModal()}>
          <Text style={{ fontSize: 18 }}>✏️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Summary strip */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{dayChecks.filter((c) => c.done).length}</Text>
            <Text style={styles.summaryLabel}>완료 항목</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{dayChecks.filter((c) => !c.done).length}</Text>
            <Text style={styles.summaryLabel}>미완료 항목</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{dayLogs.length}</Text>
            <Text style={styles.summaryLabel}>메모 수</Text>
          </View>
        </View>

        {/* Unified Timeline (REQ-V4-05) */}
        <Text style={styles.sectionTitle}>⏱ 타임라인</Text>
        {timeline.length === 0 ? (
          <Card style={{ backgroundColor: colors.cream }}>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
              이 날의 기록이 없습니다
            </Text>
          </Card>
        ) : (
          timeline.map((item, idx) => (
            <View key={idx} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <Text style={styles.timelineTime}>{formatTime(item.time)}</Text>
                {idx < timeline.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={[styles.timelineCard, shadow.sm]}>
                {item.kind === 'check' ? (
                  <CheckTimelineItem
                    check={item.check}
                    recipe={recipes.find((r) => r.id === item.check.recipeId)}
                    cat={cats.find((c) => c.id === item.check.catId)}
                    onMemo={() => openMemoModal(item.check.id, item.check.memo)}
                  />
                ) : (
                  <LogTimelineItem
                    log={item.log}
                    onEdit={() => openLogModal(item.log)}
                    onDelete={() => handleDeleteLog(item.log)}
                    onPhoto={() => handlePickPhoto(item.log)}
                    photoLoading={photoLoading}
                  />
                )}
              </View>
            </View>
          ))
        )}

        {/* Unchecked items */}
        {dayChecks.filter((c) => !c.done).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>⚠️ 미완료 항목</Text>
            {dayChecks.filter((c) => !c.done).map((c) => {
              const recipe = recipes.find((r) => r.id === c.recipeId);
              const cat = cats.find((cat) => cat.id === c.catId);
              return (
                <View key={c.id} style={[styles.missedRow, shadow.sm]}>
                  <Text style={{ fontSize: 18 }}>⬜</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missedName}>{recipe?.name ?? '-'}</Text>
                    <Text style={styles.missedCat}>{cat?.emoji} {cat?.name}</Text>
                  </View>
                  <Tag
                    label={recipe?.time === 'am' ? '오전' : recipe?.time === 'pm' ? '오후' : '종일'}
                    type={recipe?.time ?? 'all'}
                  />
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Memo modal */}
      <BottomSheet
        visible={memoModal}
        onClose={() => setMemoModal(false)}
        title="📝 항목 메모"
      >
        <Input
          label="메모"
          value={memoText}
          onChangeText={setMemoText}
          placeholder="이 항목에 대한 메모를 입력하세요"
          multiline
          numberOfLines={3}
          containerStyle={{ marginBottom: spacing.lg }}
        />
        <View style={styles.row}>
          <Button label="취소" variant="secondary" onPress={() => setMemoModal(false)} style={{ flex: 1 }} />
          <Button label="저장" onPress={handleSaveMemo} style={{ flex: 1 }} />
        </View>
      </BottomSheet>

      {/* Log modal */}
      <BottomSheet
        visible={logModal}
        onClose={() => setLogModal(false)}
        title="✏️ 로그 작성"
      >
        <Input
          label="특이사항"
          value={logText}
          onChangeText={setLogText}
          multiline
          numberOfLines={5}
          placeholder="오늘의 특이사항을 기록하세요"
          containerStyle={{ marginBottom: spacing.lg }}
          style={{ minHeight: 100 }}
        />
        <View style={styles.row}>
          <Button label="취소" variant="secondary" onPress={() => setLogModal(false)} style={{ flex: 1 }} />
          <Button label="저장" onPress={handleSaveLog} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckTimelineItem({ check, recipe, cat, onMemo }: any) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text style={{ fontSize: 16 }}>✅</Text>
        <Text style={{ fontSize: 14, color: colors.charcoal, flex: 1 }}>
          {recipe?.name ?? '알 수 없는 항목'}
        </Text>
        {recipe && <Tag label={recipe.time === 'am' ? '오전' : recipe.time === 'pm' ? '오후' : '종일'} type={recipe.time} />}
      </View>
      {cat && (
        <Text style={{ fontSize: 12, color: colors.muted }}>{cat.emoji} {cat.name}</Text>
      )}
      {check.memo ? (
        <View style={{ marginTop: 8, backgroundColor: colors.cream, borderRadius: 8, padding: 8 }}>
          <Text style={{ fontSize: 12, color: colors.brownMid }}>{check.memo}</Text>
        </View>
      ) : null}
      <TouchableOpacity onPress={onMemo} style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: colors.caramel }}>
          {check.memo ? '✏️ 메모 수정' : '+ 메모 추가'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function LogTimelineItem({ log, onEdit, onDelete, onPhoto, photoLoading }: any) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>📓</Text>
        <Text style={{ fontSize: 14, color: colors.charcoal, flex: 1, lineHeight: 22 }}>
          {log.text}
        </Text>
      </View>
      {log.photoUri && (
        <Image
          source={{ uri: log.photoUri }}
          style={{ width: '100%', height: 180, borderRadius: 10, marginTop: 10 }}
          resizeMode="cover"
        />
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity onPress={onEdit}>
          <Text style={{ fontSize: 12, color: colors.caramel }}>✏️ 수정</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onPhoto}>
          <Text style={{ fontSize: 12, color: colors.caramel }}>
            {photoLoading ? '⏳ 업로드 중...' : log.photoUri ? '📷 사진 변경' : '📷 사진 추가'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete}>
          <Text style={{ fontSize: 12, color: colors.terracotta }}>🗑️ 삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal, flex: 1, textAlign: 'center' },
  addLogBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, paddingBottom: 60 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  summaryItem: {
    flex: 1, backgroundColor: colors.cream, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  summaryNum: { fontSize: 22, fontWeight: '800', color: colors.caramel },
  summaryLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.brownMid, marginBottom: 12 },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineLeft: { width: 48, alignItems: 'center' },
  timelineTime: { fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 4 },
  timelineLine: { flex: 1, width: 1.5, backgroundColor: colors.border },
  timelineCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, padding: spacing.md,
  },
  missedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.dangerBg, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: '#FFD0C4',
    padding: spacing.md, marginBottom: 8,
  },
  missedName: { fontSize: 14, color: colors.charcoal },
  missedCat: { fontSize: 11, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
});
