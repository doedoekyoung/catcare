// 달력에서 과거 날짜 클릭 → 편집 모드(저장/취소) → DB 반영 검증.
// 사전 준비는 admin client로 직접 insert (UI 등록 race 회피, 등록 자체는 02/03 spec에서 검증됨).
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { sel } from '../helpers/selectors';
import { TEST_CAT, TEST_RECIPE } from '../helpers/test-data';
import { ensureLoggedIn } from '../helpers/auth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@catcare.test';

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function setupFixtures() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { users } } = await admin.auth.admin.listUsers();
  const authUser = users.find((u) => u.email === TEST_EMAIL)!;
  const { data: userData } = await admin
    .from('users').select('household_id').eq('uid', authUser.id).single();
  const householdId = userData!.household_id as string;

  const now = new Date().toISOString();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 기존 fixture가 남아있을 수 있으니 먼저 정리
  await admin.from('check_records').delete().eq('household_id', householdId);
  await admin.from('recipes').delete().eq('household_id', householdId);
  await admin.from('cats').delete().eq('household_id', householdId);

  const { data: cat, error: catErr } = await admin
    .from('cats')
    .insert({
      name: TEST_CAT.name, gender: 'male',
      household_id: householdId, owner_id: authUser.id,
      created_at: now, updated_at: now,
    })
    .select().single();
  if (catErr) throw catErr;

  const { error: recErr } = await admin
    .from('recipes')
    .insert({
      name: TEST_RECIPE.name, time: 'morning', times: ['morning'],
      days: [], cat_ids: [cat!.id], active: true,
      household_id: householdId,
      created_at: sevenDaysAgo.toISOString(), updated_at: now,
    });
  if (recErr) throw recErr;
}

test.describe.serial('Past Routine Edit', () => {
  test.beforeAll(async () => {
    await setupFixtures();
  });

  test('어제 날짜 → 체크 토글 → 저장 → 새로고침 후 유지', async ({ page }) => {
    await ensureLoggedIn(page);
    // cats 로드 wait — 비어있으면 홈 빈 메시지 표시
    await expect(page.getByText('고양이를 등록해보세요')).not.toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid^="home-check-"]').first().waitFor({ timeout: 15_000 });
    await page.getByText('기록', { exact: true }).click();
    await page.getByTestId(sel.recordsTabCalendar).click();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = dateKey(yesterday);
    const yesterdayCell = page.getByTestId(sel.recordsCalDay(yKey));
    if (!(await yesterdayCell.isVisible().catch(() => false))) {
      await page.getByTestId(sel.recordsCalPrevMonth).click();
    }
    await expect(yesterdayCell).toBeVisible({ timeout: 5_000 });
    await yesterdayCell.click();

    // fetch 완료(라벨 전환) 대기 후 편집 모드 진입
    await expect(page.getByTestId(sel.recordsCalEditToggle)).toContainText('이 날의 체크 수정', { timeout: 5_000 });
    await page.getByTestId(sel.recordsCalEditToggle).click();
    await expect(page.getByTestId(sel.recordsCalEditBody)).toBeVisible();

    const firstCheck = page.locator('[data-testid^="records-cal-check-"]').first();
    await expect(firstCheck).toBeVisible({ timeout: 5_000 });
    await firstCheck.click();

    await expect(page.getByTestId(sel.recordsCalEditSave)).toContainText('1개 변경');
    await page.getByTestId(sel.recordsCalEditSave).click();
    await expect(page.getByTestId(sel.recordsCalEditToggle)).toBeVisible({ timeout: 5_000 });

    // 새로고침 후 유지 — cats + recipes 둘 다 로드되어야 RoutineChecklist에 항목이 뜸
    await page.reload();
    await ensureLoggedIn(page);
    await expect(page.getByText('고양이를 등록해보세요')).not.toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid^="home-check-"]').first().waitFor({ timeout: 15_000 });
    await page.getByText('기록', { exact: true }).click();
    await page.getByTestId(sel.recordsTabCalendar).click();
    const yesterdayCell2 = page.getByTestId(sel.recordsCalDay(yKey));
    if (!(await yesterdayCell2.isVisible().catch(() => false))) {
      await page.getByTestId(sel.recordsCalPrevMonth).click();
    }
    await yesterdayCell2.click();
    await expect(page.getByTestId(sel.recordsCalEditToggle)).toContainText('이 날의 체크 수정', { timeout: 5_000 });
    await page.getByTestId(sel.recordsCalEditToggle).click();

    const firstCheck2 = page.locator('[data-testid^="records-cal-check-"]').first();
    await expect(firstCheck2).toBeVisible();
    await expect(firstCheck2.locator('text=✓')).toBeVisible({ timeout: 3_000 });
  });

  test('어제 날짜 → 체크 토글 → 취소 → DB 변경 없음', async ({ page }) => {
    await ensureLoggedIn(page);
    await expect(page.getByText('고양이를 등록해보세요')).not.toBeVisible({ timeout: 20_000 });
    await page.getByText('기록', { exact: true }).click();
    await page.getByTestId(sel.recordsTabCalendar).click();

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const tKey = dateKey(twoDaysAgo);
    const cell = page.getByTestId(sel.recordsCalDay(tKey));
    if (!(await cell.isVisible().catch(() => false))) {
      await page.getByTestId(sel.recordsCalPrevMonth).click();
    }
    await expect(cell).toBeVisible({ timeout: 5_000 });
    await cell.click();
    await expect(page.getByTestId(sel.recordsCalEditToggle)).toContainText('이 날의 체크 수정', { timeout: 5_000 });
    await page.getByTestId(sel.recordsCalEditToggle).click();

    const firstCheck = page.locator('[data-testid^="records-cal-check-"]').first();
    await firstCheck.click(); // pendingChecks에만 반영
    await page.getByTestId(sel.recordsCalEditCancel).click();
    await expect(page.getByTestId(sel.recordsCalEditToggle)).toBeVisible({ timeout: 5_000 });

    // 다시 열어 체크가 원상복구(off)됐는지 확인
    await page.getByTestId(sel.recordsCalEditToggle).click();
    const firstCheck2 = page.locator('[data-testid^="records-cal-check-"]').first();
    await expect(firstCheck2).toBeVisible();
    await expect(firstCheck2.locator('text=✓')).not.toBeVisible({ timeout: 2_000 });
  });

  test('내일 날짜는 클릭 비활성화', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();
    await page.getByTestId(sel.recordsTabCalendar).click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tKey = dateKey(tomorrow);
    const tomorrowCell = page.getByTestId(sel.recordsCalDay(tKey));
    if (!(await tomorrowCell.isVisible().catch(() => false))) {
      await page.getByTestId(sel.recordsCalNextMonth).click();
    }
    await expect(tomorrowCell).toBeVisible({ timeout: 5_000 });

    await tomorrowCell.click({ force: true });
    await expect(page.getByTestId(sel.recordsCalEditToggle)).not.toBeVisible({ timeout: 1_500 });
  });
});
