// src/utils/theme.ts

import { StyleSheet } from 'react-native';

export const colors = {
  cream: '#FAF6F0',
  warmWhite: '#FFFDF9',
  sand: '#E8DDD0',
  caramel: '#C4956A',
  caramelDark: '#A67C52',
  terracotta: '#C46A4A',
  sage: '#7A9E7E',
  sageMid: '#A8C5AB',
  sageLight: '#D4E8D6',
  charcoal: '#2C2420',
  brownMid: '#6B4F3A',
  brownLight: '#9E7B5A',
  muted: '#8C7B70',
  border: '#DDD0C4',
  shadowColor: '#2C2420',
  checkedBg: '#F0EDE8',
  dangerBg: '#FDECEA',
  dangerText: '#C46A4A',
  white: '#FFFFFF',
  successBg: '#E8F5E9',
  successText: '#388E3C',
  warnBg: '#FFF8E1',
  warnText: '#795548',
  amColor: '#E65100',
  amBg: '#FFF3E0',
  pmColor: '#1565C0',
  pmBg: '#E3F2FD',
  allColor: '#6A1B9A',
  allBg: '#F3E5F5',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  displayLg: { fontSize: 28, fontWeight: '800' as const },
  displayMd: { fontSize: 22, fontWeight: '700' as const },
  displaySm: { fontSize: 18, fontWeight: '700' as const },
  bodyLg: { fontSize: 16, fontWeight: '400' as const },
  bodyMd: { fontSize: 14, fontWeight: '400' as const },
  bodySm: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const shadow = StyleSheet.create({
  sm: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
