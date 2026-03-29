// src/screens/CatDetailScreen.tsx
// REQ-V5-03: 완료율 차트, REQ-V5-04: 고양이별 루틴 현황

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/useStore';
import { updateCat } from '../services/firestoreService';
import { uploadPhoto } from '../services/firestoreService';
import { Card, Button, Tag } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import { getLast30Days, toDateKey, formatDisplayDate } from '../utils/date';
import type { RootStackParamList } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'CatDetail'>;

export default function CatDetailScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { cats, recipes, checks, household, setCats } = useStore();

  const cat = cats.find((c) => c.id === route.params.catId);
  const catRecipes = recipes.filter((r) => r.catIds.includes(route.params.catId));
  const [photoLoading, setPhotoLoading] = useState(false);

  // ── Monthly completion data ───────────────────────────────────────────────

  const monthlyStats = useMemo(() => {
    const days = getLast30Days();
    return days.map((date) => {
      const dayRecipes = catRecipes.filter((r) => r.active);
      const total = dayRecipes.length;
      if (total === 0) return { date, pct: 0, done: 0, total: 0 };
      const done = dayRecipes.filter((r) =>
        checks[`${date}_${r.id}_${cat?.id}`]?.done
      ).length;
      return { date, pct: Math.round((done / total) * 100), done, total };
    });
  }, [catRecipes, checks, cat?.id]);

  const avgPct = useMemo(() => {
    const active = monthlyStats.filter((d) => d.total > 0);
    if (!active.length) return 0;
    return Math.round(active.reduce((s, d) => s + d.pct, 0) / active.length);
  }, [monthlyStats]);

  const today = toDateKey();
  const todayStats = monthlyStats.find((d) => d.date === today);

  // ── Photo upload ──────────────────────────────────────────────────────────

  const handlePickPhoto = async () => {
    if (!cat || !household) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    setPhotoLoading(true);
    try {
      const url = await uploadPhoto(
        household.id,
        result.assets[0].uri,
        `cats/${cat.id}/profile.jpg`
      );
      await updateCat(household.id, cat.id, { photoUri: url });
      setCats(cats.map((c) => c.id === cat.id ? { ...c, photoUri: url } : c));
    } finally {
      setPhotoLoading(false);
    }
  };

  if (!cat) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: colors.muted, padding: 20 }}>고양이를 찾을 수 없습니다.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{cat.emoji} {cat.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={[styles.profileCard, shadow.md]}>
          <TouchableOpacity onPress={handlePickPhoto} style={styles.avatarWrap} activeOpacity={0.8}>
            {cat.photoUri ? (
              <Image source={{ uri: cat.photoUri }} style={styles.avatarPhoto} />
            ) : (
              <View style={styles.avatarEmoji}>
                <Text style={{ fontSize: 56 }}>{cat.emoji}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={{ fontSize: 14 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{cat.name}</Text>
          {cat.breed && <Text style={styles.profileMeta}>{cat.breed}</Text>}
          {cat.birthDate && (
            <Text style={styles.profileMeta}>
              생일 {cat.birthDate} · 나이 {calcAge(cat.birthDate)}살
            </Text>
          )}
          {cat.weight && <Text style={styles.profileMeta}>몸무게 {cat.weight}kg</Text>}
        </View>

        {/* Today status (REQ-V5-04) */}
        <View style={styles.statsRow}>
          {[
            { num: `${todayStats?.done ?? 0}/${todayStats?.total ?? 0}`, label: '오늘 완료', color: colors.caramel },
            { num: `${avgPct}%`, label: '30일 평균', color: colors.sage },
            { num: catRecipes.filter((r) => r.active).length, label: '활성 루틴', color: colors.brownLight },
          ].map(({ num, label, color }) => (
            <View key={label} style={[styles.statItem, shadow.sm]}>
              <Text style={[styles.statNum, { color }]}>{num}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* 30-day completion chart (REQ-V5-03) */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.chartTitle}>📊 30일 완료율</Text>
          <View style={styles.heatmapWrap}>
            {monthlyStats.map(({ date, pct }) => {
              const opacity = pct === 0 ? 0.1 : pct < 50 ? 0.4 : pct < 80 ? 0.7 : 1;
              return (
                <View
                  key={date}
                  style={[
                    styles.heatCell,
                    { backgroundColor: `rgba(196,149,106,${opacity})` },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.heatLegend}>
            {[0, 0.25, 0.5, 0.75, 1].map((o) => (
              <View key={o} style={[styles.heatCell, { backgroundColor: `rgba(196,149,106,${Math.max(o, 0.08)})` }]} />
            ))}
            <Text style={styles.legendText}>낮음 → 높음</Text>
          </View>
        </Card>

        {/* Active recipes summary */}
        <Text style={styles.sectionTitle}>📋 루틴 현황</Text>
        {catRecipes.length === 0 ? (
          <Card style={{ backgroundColor: colors.cream }}>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
              등록된 루틴이 없어요
            </Text>
          </Card>
        ) : (
          catRecipes.map((r) => {
            const isDoneToday = !!checks[`${today}_${r.id}_${cat.id}`]?.done;
            return (
              <View key={r.id} style={[styles.recipeRow, shadow.sm]}>
                <Text style={{ fontSize: 20 }}>{r.time === 'am' ? '☀️' : r.time === 'pm' ? '🌙' : '📅'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recipeName, !r.active && { textDecorationLine: 'line-through', color: colors.muted }]}>
                    {r.name}
                  </Text>
                </View>
                <Tag label={r.time === 'am' ? '오전' : r.time === 'pm' ? '오후' : '종일'} type={r.time} />
                <View style={[styles.doneDot, { backgroundColor: isDoneToday ? colors.sage : colors.border }]} />
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.charcoal },
  content: { padding: spacing.lg, paddingBottom: 60 },
  profileCard: {
    alignItems: 'center', backgroundColor: '#fff',
    borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.xl, marginBottom: spacing.lg,
  },
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  avatarPhoto: { width: 100, height: 100, borderRadius: 50 },
  avatarEmoji: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.caramel, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  profileName: { fontSize: 22, fontWeight: '700', color: colors.charcoal, marginBottom: 4 },
  profileMeta: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  statItem: {
    flex: 1, backgroundColor: colors.cream, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: colors.brownMid, marginBottom: spacing.md },
  heatmapWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  heatCell: { width: 18, height: 18, borderRadius: 4 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 10, color: colors.muted, marginLeft: 4 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: colors.brownMid,
    marginBottom: 10, marginTop: 4,
  },
  recipeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, marginBottom: 8,
  },
  recipeName: { fontSize: 14, color: colors.charcoal },
  doneDot: { width: 10, height: 10, borderRadius: 5 },
});
