// src/components/Logo.tsx
//
// CatCare 브랜드 로고. 웹에서는 /logo.svg (postbuild가 dist로 복사) 를 사용한다.
// 네이티브는 추후 SVG 트랜스포머 설치 후 같은 경로를 참조하도록 확장한다.

import React from 'react';
import { Image, View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../utils/theme';

type LogoProps = {
  height?: number;
  withTagline?: boolean;
};

export default function Logo({ height = 48, withTagline = false }: LogoProps) {
  const width = height * 3.2;

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'web' ? (
        <Image
          source={{ uri: '/logo.svg' }}
          style={{ width, height, resizeMode: 'contain' }}
          accessibilityLabel="CatCare"
        />
      ) : (
        <Text style={[styles.fallback, { fontSize: height * 0.55 }]}>CatCare</Text>
      )}
      {withTagline && (
        <Text style={styles.tagline}>고양이 돌봄 루틴 관리</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  fallback: {
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
    letterSpacing: 0.3,
  },
});
