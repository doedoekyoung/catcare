// tintOnWhite — 반투명 tagColor+alpha 배경을 안드로이드 elevation과 함께 쓰면 그림자 합성이
// 깨지는 버그(실기기 확인) 회피용. color+alpha를 흰 배경에 미리 섞어 "불투명" hex로 만든다.
import { tintOnWhite } from '../src/utils/theme';

describe('tintOnWhite', () => {
  test('alpha 0 → 완전히 base(기본 흰색)', () => {
    expect(tintOnWhite('#C4956A', 0)).toBe('#ffffff');
  });

  test('alpha 255(0xff) → 원래 색 그대로', () => {
    expect(tintOnWhite('#C4956A', 255)).toBe('#c4956a');
  });

  test('RoutineChecklist가 쓰는 정확한 값(0x18) — 흰 배경과 옅게 섞인 불투명 색', () => {
    // 반투명 렌더링(color+'18' over #fff)과 동일한 시각 결과를 내되, alpha 채널이 없어야 함
    const result = tintOnWhite('#C4956A', 0x18);
    expect(result).toMatch(/^#[0-9a-f]{6}$/); // 8자리(알파 포함)가 아니라 6자리(불투명)
    // 원색보다는 훨씬 흰색에 가까워야 함(옅은 색조)
    const [r, g, b] = [result.slice(1, 3), result.slice(3, 5), result.slice(5, 7)].map((h) => parseInt(h, 16));
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(200);
  });

  test('다른 base 색과도 섞을 수 있음', () => {
    // black(0) * (128/255) + white(255) * (1 - 128/255) ≈ 127 (정수 반올림)
    expect(tintOnWhite('#000000', 128, '#FFFFFF')).toBe('#7f7f7f');
  });

  test('결과는 항상 6자리 불투명 hex(알파 채널 없음)', () => {
    expect(tintOnWhite('#7A9E7E', 0x60).length).toBe(7); // '#' + 6자리
  });
});
