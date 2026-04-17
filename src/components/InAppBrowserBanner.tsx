// 웹에서 인앱 브라우저 감지 시 상단에 외부 브라우저 유도 배너를 표시.
// 네이버·카카오톡 등 인앱에서 OAuth·localStorage 제약으로 앱이 정상 동작하지 않는 것을 예방.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors, spacing, radius } from '../utils/theme';
import { detectInAppBrowser, openInExternalBrowser, copyUrl } from '../utils/inAppBrowser';

export default function InAppBrowserBanner() {
  const info = useMemo(() => detectInAppBrowser(), []);
  const [dismissed, setDismissed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');

  if (Platform.OS !== 'web' || !info.isInApp || dismissed) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleOpen = async () => {
    if (info.isAndroid || info.name === '네이버') {
      openInExternalBrowser(currentUrl, info);
      return;
    }
    // iOS: 범용 외부 실행 불가 → URL 복사 유도
    const ok = await copyUrl(currentUrl);
    setCopyState(ok ? 'ok' : 'fail');
  };

  const hint = info.isIOS
    ? 'Safari 등 외부 브라우저에서 열어주세요.'
    : `${info.name} 인앱 브라우저에서는 일부 기능이 제한됩니다.`;

  return (
    <View style={styles.banner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>외부 브라우저 사용을 권장합니다</Text>
        <Text style={styles.desc}>{hint}</Text>
        {copyState === 'ok' && (
          <Text style={styles.ok}>URL이 복사되었어요. Safari에 붙여넣어 열어주세요.</Text>
        )}
        {copyState === 'fail' && (
          <Text style={styles.fail}>URL 복사에 실패했습니다. 주소창에서 직접 열어주세요.</Text>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.openBtn} onPress={handleOpen} activeOpacity={0.8}>
          <Text style={styles.openBtnText}>
            {info.isIOS ? 'URL 복사' : '외부 브라우저로 열기'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={() => setDismissed(true)}>
          <Text style={styles.closeBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warnBg,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 13, fontWeight: '700', color: colors.warnText, marginBottom: 2 },
  desc: { fontSize: 11, color: colors.warnText, lineHeight: 16 },
  ok: { fontSize: 11, color: colors.sage, marginTop: 4 },
  fail: { fontSize: 11, color: colors.terracotta, marginTop: 4 },
  actions: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  openBtn: {
    backgroundColor: colors.caramel,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  openBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  closeBtn: { paddingVertical: 3, paddingHorizontal: 8 },
  closeBtnText: { fontSize: 11, color: colors.muted },
});
