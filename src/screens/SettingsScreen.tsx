// src/screens/SettingsScreen.tsx
// REQ-V1-03~05, V5-01, V5-06

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Share, Platform,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';

function webConfirm(title: string, message: string, onConfirm: () => void, confirmLabel = '확인') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: confirmLabel, onPress: onConfirm },
    ]);
  }
}

function webAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { signOut } from '../services/authService';
import {
  regenerateShareToken,
  getUserByEmail,
  addMemberToHousehold,
  removeMemberFromHousehold,
  getUsersByIds,
} from '../services/dbService';
import type { User } from '../types';
import { Button, Card } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';

export default function SettingsScreen() {
  const { user, household, cats, recipes, setUser, setHousehold } = useStore();
  const [shareLoading, setShareLoading] = useState(false);

  // 집사 관리 상태
  const [members, setMembers] = useState<User[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const isOwner = user?.uid === household?.ownerId;

  useEffect(() => {
    if (!household?.memberIds?.length) return;
    getUsersByIds(household.memberIds).then(setMembers).catch(() => {});
  }, [household?.memberIds]);

  const handleAddMember = async () => {
    if (!household || !emailInput.trim()) return;
    if (emailInput.trim().toLowerCase() === user?.email?.toLowerCase()) {
      webAlert('오류', '본인 이메일은 추가할 수 없어요.');
      return;
    }
    setAddLoading(true);
    try {
      const found = await getUserByEmail(emailInput.trim());
      if (!found) {
        webAlert('사용자 없음', '해당 이메일로 가입된 계정을 찾을 수 없어요.');
        return;
      }
      if (household.memberIds.includes(found.uid)) {
        webAlert('이미 추가됨', '이미 이 가구의 집사예요.');
        return;
      }
      await addMemberToHousehold(household.id, found.uid, household.memberIds);
      const newMemberIds = [...household.memberIds, found.uid];
      setHousehold({ ...household, memberIds: newMemberIds });
      setMembers((prev) => [...prev, found]);
      setEmailInput('');
      setAddModalVisible(false);
      webAlert('완료', `${found.displayName}님이 집사로 추가되었습니다.`);
    } catch (e: any) {
      webAlert('오류', e?.message ?? '추가 중 오류가 발생했어요.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = (member: User) => {
    if (!household) return;
    webConfirm(
      '집사 제거',
      `${member.displayName}님을 이 가구에서 제거할까요?`,
      async () => {
        try {
          await removeMemberFromHousehold(household.id, member.uid, household.memberIds);
          const newMemberIds = household.memberIds.filter((id) => id !== member.uid);
          setHousehold({ ...household, memberIds: newMemberIds });
          setMembers((prev) => prev.filter((m) => m.uid !== member.uid));
        } catch (e: any) {
          webAlert('오류', e?.message ?? '제거 중 오류가 발생했어요.');
        }
      },
      '제거',
    );
  };

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

  const handleRegenerateToken = () => {
    if (!household) return;
    webConfirm(
      '링크 재생성',
      '기존 링크가 무효화되고 새 링크가 생성됩니다. 계속할까요?',
      async () => {
        const token = await regenerateShareToken(household.id);
        setHousehold({ ...household, shareToken: token });
        webAlert('완료', '새 링크가 생성되었습니다.');
      },
      '재생성',
    );
  };

  const handleSignOut = () => {
    webConfirm(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      async () => {
        await signOut();
        setUser(null);
      },
      '로그아웃',
    );
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

        {/* 집사 관리 */}
        {settingSection('👥 집사 관리', <>
          <Card style={{ backgroundColor: colors.cream }}>
            <Text style={styles.shareTitle}>함께 돌보는 집사</Text>
            <Text style={styles.shareDesc}>
              같은 가구에 추가된 집사는 고양이, 루틴, 기록을 모두 함께 조회하고 수정할 수 있어요.
            </Text>
            {members.map((m) => (
              <View key={m.uid} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.displayName}</Text>
                  <Text style={styles.memberEmail}>{m.email}</Text>
                </View>
                <View style={styles.memberBadgeWrap}>
                  {m.uid === household?.ownerId
                    ? <Text style={styles.ownerBadge}>집사장</Text>
                    : isOwner && m.uid !== user?.uid && (
                      <TouchableOpacity onPress={() => handleRemoveMember(m)}>
                        <Text style={styles.removeBtn}>제거</Text>
                      </TouchableOpacity>
                    )
                  }
                </View>
              </View>
            ))}
            {isOwner && (
              <Button
                label="+ 집사 추가"
                variant="secondary"
                onPress={() => setAddModalVisible(true)}
                style={{ marginTop: spacing.md }}
              />
            )}
          </Card>
        </>)}

        {/* 집사 추가 모달 */}
        <Modal
          visible={addModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAddModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>집사 추가</Text>
              <Text style={styles.modalDesc}>추가할 집사의 가입 이메일을 입력해 주세요.</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="example@email.com"
                placeholderTextColor={colors.muted}
                value={emailInput}
                onChangeText={setEmailInput}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              <View style={[styles.row, { marginTop: spacing.md }]}>
                <Button
                  label="취소"
                  variant="secondary"
                  onPress={() => { setAddModalVisible(false); setEmailInput(''); }}
                  style={{ flex: 1 }}
                />
                <Button
                  label={addLoading ? '검색 중…' : '추가'}
                  onPress={handleAddMember}
                  loading={addLoading}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

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

  // 집사 관리
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.charcoal },
  memberEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  memberBadgeWrap: { paddingLeft: 8 },
  ownerBadge: {
    fontSize: 11, color: colors.brownMid, backgroundColor: colors.sand,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden',
  },
  removeBtn: { fontSize: 12, color: '#e05252', fontWeight: '600' },

  // 모달
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: radius.lg,
    padding: spacing.xl, width: '100%', maxWidth: 400,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.charcoal, marginBottom: 6 },
  modalDesc: { fontSize: 13, color: colors.muted, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: colors.charcoal,
  },
});
