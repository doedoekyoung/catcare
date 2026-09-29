// src/components/Logo.tsx
//
// CatCare 브랜드 로고. 웹에서는 /logo.svg (postbuild가 dist로 복사) 를 사용한다.
// 네이티브는 wordmark.png(assets/wordmark.png, 158×32)를 쓴다 — 이전엔 "CatCare" 텍스트
// fallback이었는데, 로그인/로딩 화면에도 실제 워드마크가 보이도록 이미지로 교체.

import React from 'react';
import { Image, View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../utils/theme';

// wordmark.png의 실제 비율(158×32) 그대로 사용 — 다른 비율로 늘리면 로고가 찌그러짐.
const WORDMARK_ASPECT_RATIO = 158 / 32;

type LogoProps = {
  height?: number;
  withTagline?: boolean;
};

export default function Logo({ height = 48, withTagline = false }: LogoProps) {
  const width = Platform.OS === 'web' ? height * 3.2 : height * WORDMARK_ASPECT_RATIO;

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'web' ? (
        <Image
          source={{ uri: '/logo.svg' }}
          style={{ width, height, resizeMode: 'contain' }}
          accessibilityLabel="CatCare"
        />
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        <Image
          source={require('../../assets/wordmark.png')}
          style={{ width, height, resizeMode: 'contain' }}
          accessibilityLabel="CatCare"
        />
      )}
      {withTagline && (
        <Text style={styles.tagline}>고양이 돌봄 루틴 관리</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
    letterSpacing: 0.3,
  },
});
