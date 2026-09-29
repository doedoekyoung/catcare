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
  morningColor: '#E65100',
  morningBg: '#FFF3E0',
  lunchColor: '#2E7D32',
  lunchBg: '#E8F5E9',
  eveningColor: '#1565C0',
  eveningBg: '#E3F2FD',
} as const;

export const CAT_TAG_COLORS = [
  '#C4956A', // caramel (default)
  '#7A9E7E', // sage
  '#6B8EC4', // blue
  '#C46A4A', // terracotta
  '#9B6AC4', // purple
  '#C4B06A', // gold
  '#4AB8B8', // teal
  '#C46A8E', // pink
  '#6A9EC4', // sky
  '#8EC46A', // green
] as const;

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

// 태그 색상 + 알파(hex, 예: 0x18)를 흰 배경 위에 미리 섞어 "불투명" hex로 반환.
// 안드로이드에서 elevation(그림자)이 걸린 View에 진짜 반투명 배경(color+alpha 문자열)을
// 쓰면 그림자 합성이 깨져 밝은 사각형이 떠 보이는 렌더링 버그가 있다 — 실기기에서 확인.
// shadow.sm/md와 함께 쓰는 View의 "옅은 색조" 배경엔 항상 이 함수로 미리 섞은 불투명
// 색을 써야 한다(RoutineChecklist의 완료 상태 배경에서 최초 발견).
export function tintOnWhite(hexColor: string, alpha: number, base: string = '#FFFFFF'): string {
  const c = hexColor.replace('#', '');
  const b = base.replace('#', '');
  const cr = parseInt(c.slice(0, 2), 16), cg = parseInt(c.slice(2, 4), 16), cb = parseInt(c.slice(4, 6), 16);
  const br = parseInt(b.slice(0, 2), 16), bg = parseInt(b.slice(2, 4), 16), bb = parseInt(b.slice(4, 6), 16);
  const a = alpha / 255;
  const mix = (fg: number, bgc: number) => Math.round(fg * a + bgc * (1 - a));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(cr, br))}${toHex(mix(cg, bg))}${toHex(mix(cb, bb))}`;
}

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
