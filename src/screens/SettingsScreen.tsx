// src/screens/SettingsScreen.tsx
// REQ-V1-03~05, V5-01, V5-06

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { signOut } from '../services/authService';
import { regenerateShareToken } from '../services/dbService';
import { Button, Card } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';

export default function SettingsScreen() {
  const { user, household, cats, recipes, setUser, setHousehold } = useStore();
  const [shareLoading, setShareLoading] = useState(false);

  // REQ-V1-04: Share link generation
  const handleShareLink = async () => {
    if (!household) return;
    setShareLoading(true);
    try {
      let token = household.shareToken;
      // Regenerate if expired
      const expiry = household.shareTokenExpiry ? new Date(household.shareTokenExpiry) : null;
      if (!token || !expiry || expiry < new Date()) {
        token = await regenerateShareToken(household.id);
        setHousehold({ ...household, shareToken: token });
      }
      const url = `https://catcare.app/share/${token}`;
      await Share.share({
        message: `CatCare 공유 링크\n\n${url}\n\n이 링크로 오늘의 고양이 체크리스트를 확인하고 체크할 수 있습니다 🐱\n(7일 유효)`,
        title: 'CatCare 인수인계 공유',
      });
    } finally {
      setShareLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!household) return;
    Alert.alert(
      '링크 재생성',
      '기존 링크가 무효화되고 새 링크가 생성됩니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '재생성',
          onPress: async () => {
            const token = await regenerateShareToken(household.id);
            setHousehold({ ...household, shareToken: token });
            Alert.alert('완료', '새 링크가 생성되었습니다.');
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setUser(null);
        },
      },
    ]);
  };

  const settingSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const settingRow = (icon: string, label: string, value?: string, onPress?: () => void) => (
    <TouchableOpacity
      style={[styles.settingRow, shadow.sm]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      {onPress && <Text style={styles.rowArrow}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile */}
        {settingSection('👤 프로필', <>
          {settingRow('🐱', '표시 이름', user?.displayName ?? '-')}
          {settingRow('📧', '이메일', user?.email ?? '-')}
        </>)}

        {/* Stats */}
        {settingSection('📊 현황', <>
          {settingRow('🐈', '등록된 고양이', `${cats.length}마리`)}
          {settingRow('📋', '활성 루틴 항목', `${recipes.filter((r) => r.active).length}개`)}
        </>)}

        {/* Share / Handover (REQ-V1-03~05) */}
        {settingSection('🔗 공유 & 인수인계', <>
          <Card style={{ backgroundColor: colors.cream }}>
            <Text style={styles.shareTitle}>펫시터 공유 링크</Text>
            <Text style={styles.shareDesc}>
              링크로 접속한 사람은 로그인 없이 오늘의 체크리스트를 조회하고
              항목을 체크할 수 있습니다. 링크는 7일간 유효합니다.
            </Text>
            {household?.shareToken && (
              <View style={styles.tokenBox}>
                <Text style={styles.tokenText} numberOfLines={1} ellipsizeMode="tail">
                  catcare.app/share/{household.shareToken}
                </Text>
              </View>
            )}
            <View style={[styles.row, { marginTop: spacing.md }]}>
              <Button
                label="🔗 링크 공유"
                onPress={handleShareLink}
                loading={shareLoading}
                style={{ flex: 1 }}
              />
              <Button
                label="🔄 재생성"
                variant="secondary"
                onPress={handleRegenerateToken}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </>)}

        {/* IoT (REQ-V5-06 placeholder) */}
        {settingSection('📡 IoT 연동 (준비 중)', <>
          <Card style={{ backgroundColor: colors.warnBg }}>
            <Text style={styles.iotTitle}>🚀 V6에서 오픈 예정</Text>
            <Text style={styles.iotDesc}>
              PETKIT, Petlibro RFID 급식기, Petcube 카메라 등의 스마트 기기와
              연동하여 체크리스트를 자동으로 완료 처리할 수 있습니다.
            </Text>
          </Card>
        </>)}

        {/* Account */}
        {settingSection('🔐 계정', <>
          {settingRow('🚪', '로그아웃', undefined, handleSignOut)}
        </>)}

        <Text style={styles.version}>CatCare v1.0.0 · MVP~V5</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  content: { padding: spacing.lg, paddingBottom: 80 },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: 12, color: colors.muted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 8,
  },
  rowIcon: { fontSize: 22 },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, color: colors.charcoal },
  rowValue: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowArrow: { fontSize: 20, color: colors.muted },
  shareTitle: { fontSize: 15, fontWeight: '600', color: colors.charcoal, marginBottom: 6 },
  shareDesc: { fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: spacing.sm },
  tokenBox: {
    backgroundColor: colors.sand, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tokenText: { fontSize: 12, color: colors.brownMid, fontFamily: 'monospace' },
  row: { flexDirection: 'row', gap: 10 },
  iotTitle: { fontSize: 14, fontWeight: '600', color: colors.warnText, marginBottom: 6 },
  iotDesc: { fontSize: 13, color: colors.warnText, lineHeight: 20, opacity: 0.85 },
  version: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: spacing.lg },
});
