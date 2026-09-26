// selectCompletionRate — 홈 화면 헤더의 "오늘 N/M 완료" 배지와 앱 아이콘 배지(오늘 남은
// 할 일 수)가 공유하는 핵심 계산. 두 곳이 같은 값을 보여줘야 하므로 여기서 엄격히 검증한다.
import { selectCompletionRate } from '../src/store/useStore';
import type { Recipe, CheckRecord } from '../src/types';

const DATE = '2026-09-26'; // 토요일

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'r1', name: '아침 사료', times: ['morning'], days: [],
    catIds: ['cat1'], active: true, householdId: 'hh1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function check(id: string, done: boolean): CheckRecord {
  return { id, date: DATE, recipeId: 'r', catId: 'c', done, householdId: 'hh1' };
}

describe('selectCompletionRate', () => {
  test('루틴이 없으면 0/0, pct 0 (division by zero 방지)', () => {
    expect(selectCompletionRate([], {}, DATE, ['cat1'])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  test('시간대가 여러 개면 그만큼 total에 더해짐', () => {
    const r = recipe({ times: ['morning', 'evening'] });
    const checks = { [`${DATE}_r1_cat1_morning`]: check(`${DATE}_r1_cat1_morning`, true) };
    expect(selectCompletionRate([r], checks, DATE, ['cat1'])).toEqual({ done: 1, total: 2, pct: 50 });
  });

  test('비활성(active=false) 루틴은 집계에서 제외', () => {
    const r = recipe({ active: false });
    expect(selectCompletionRate([r], {}, DATE, ['cat1'])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  test('그 날 요일에 해당하지 않는 루틴은 제외', () => {
    // DATE(2026-09-26)는 토요일(6). 월/화만 반복이면 해당 없음.
    const r = recipe({ days: [1, 2] });
    expect(selectCompletionRate([r], {}, DATE, ['cat1']).total).toBe(0);
  });

  test('선택된 고양이 목록에 없는 루틴은 제외', () => {
    const r = recipe({ catIds: ['cat2'] });
    expect(selectCompletionRate([r], {}, DATE, ['cat1']).total).toBe(0);
  });

  test('여러 고양이가 공유하는 루틴은 화면에 보이는 만큼 한 항목으로만 집계', () => {
    // RoutineChecklist/HomeScreen도 공유 루틴을 한 행으로만 그린다 — 배지가 그보다
    // 더 세거나 덜 세면 앱 안에서 보이는 완료율과 어긋난다.
    const r = recipe({ catIds: ['cat1', 'cat2'], times: ['morning'] });
    expect(selectCompletionRate([r], {}, DATE, ['cat1', 'cat2']).total).toBe(1);
  });

  test('완료 처리는 catIds 중 첫 번째 매칭 고양이의 체크만 본다', () => {
    const r = recipe({ catIds: ['cat1', 'cat2'], times: ['morning'] });
    const checks = { [`${DATE}_r1_cat2_morning`]: check(`${DATE}_r1_cat2_morning`, true) };
    // catIds 필터 순서상 cat1이 먼저 매칭되므로, cat2 체크만 있으면 미완료로 집계된다.
    expect(selectCompletionRate([r], checks, DATE, ['cat1', 'cat2'])).toEqual({ done: 0, total: 1, pct: 0 });
  });

  test('가구 전체(모든 고양이 id) 기준 — 배지가 실제로 쓰는 호출 형태', () => {
    const r1 = recipe({ id: 'r1', catIds: ['cat1'], times: ['morning', 'evening'] });
    const r2 = recipe({ id: 'r2', catIds: ['cat2'], times: ['morning'] });
    const checks = {
      [`${DATE}_r1_cat1_morning`]: check(`${DATE}_r1_cat1_morning`, true),
      [`${DATE}_r2_cat2_morning`]: check(`${DATE}_r2_cat2_morning`, true),
    };
    const allCatIds = ['cat1', 'cat2'];
    const { done, total } = selectCompletionRate([r1, r2], checks, DATE, allCatIds);
    expect({ done, total, remaining: total - done }).toEqual({ done: 2, total: 3, remaining: 1 });
  });
});
