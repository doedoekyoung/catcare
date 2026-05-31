// 달력에서 어제 날짜 클릭 → 체크 수정 → DB 반영 + 새로고침 유지 확인.
// 내일 날짜는 클릭 비활성화 검증.
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

test.describe.serial('Past Routine Edit', () => {
  test('사전 준비: 고양이 + 루틴 등록', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();

    // 고양이 등록
    await page.getByTestId(sel.catsAddButton).click();
    await page.getByTestId(sel.catFormNameInput).fill(TEST_CAT.name);
    await page.getByTestId(sel.catFormGenderMale).click();
    await page.getByTestId(sel.catFormSaveButton).click();
    await expect(page.getByTestId(sel.catFormSaveButton)).not.toBeVisible({ timeout: 15_000 });

    // 새로고침 후 루틴 등록
    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    const expand = page.locator('[data-testid^="cats-expand-"]').first();
    await expand.waitFor({ timeout: 10_000 });
    await expand.click();
    await page.getByText('+ 루틴 추가').click();
    await page.getByTestId(sel.recipeFormNameInput).fill(TEST_RECIPE.name);
    await page.getByTestId(sel.recipeFormSaveButton).click();
    await expect(page.getByText('루틴 항목 등록')).not.toBeVisible({ timeout: 10_000 });

    // 루틴 createdAt을 7일 전으로 밀어 어제도 적용 대상이 되도록.
    // (앱 로직: date >= recipe.createdAt(YYYY-MM-DD)인 경우만 그 날 활성)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { users } } = await admin.auth.admin.listUsers();
    const authUser = users.find((u) => u.email === TEST_EMAIL)!;
    const { data: userData } = await admin
      .from('users').select('household_id').eq('uid', authUser.id).single();
    const householdId = userData!.household_id as string;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await admin
      .from('recipes')
      .update({ created_at: sevenDaysAgo.toISOString() })
      .eq('household_id', householdId);
  });

  test('어제 날짜 → 체크 수정 → 새로고침 후 유지', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();
    await page.getByTestId(sel.recordsTabCalendar).click();

    // 어제 dateKey 계산. 어제가 이전 달이면 prev month 한 번.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = dateKey(yesterday);
    const yesterdayCell = page.getByTestId(sel.recordsCalDay(yKey));
    if (!(await yesterdayCell.isVisible().catch(() => false))) {
      await page.getByTestId(sel.recordsCalPrevMonth).click();
    }
    await expect(yesterdayCell).toBeVisible({ timeout: 5_000 });
    await yesterdayCell.click();

    // 체크 수정 토글 펼치기
    await page.getByTestId(sel.recordsCalEditToggle).click();
    await expect(page.getByTestId(sel.recordsCalEditBody)).toBeVisible();

    // 첫 체크 항목 토글
    const firstCheck = page.locator('[data-testid^="records-cal-check-"]').first();
    await expect(firstCheck).toBeVisible({ timeout: 5_000 });
    await firstCheck.click();

    // DB write 대기 후 새로고침
    await page.waitForTimeout(800);
    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();
    await page.getByTestId(sel.recordsTabCalendar).click();

    const yesterdayCell2 = page.getByTestId(sel.recordsCalDay(yKey));
    if (!(await yesterdayCell2.isVisible().catch(() => false))) {
      await page.getByTestId(sel.recordsCalPrevMonth).click();
    }
    await yesterdayCell2.click();
    await page.getByTestId(sel.recordsCalEditToggle).click();

    // 체크가 유지되어 있는지 — DOM 텍스트에 ✓ 마크 또는 done 상태 검증.
    // 가장 단순한 검증: 첫 체크 항목 안에 ✓가 보이면 done.
    const firstCheck2 = page.locator('[data-testid^="records-cal-check-"]').first();
    await expect(firstCheck2).toBeVisible();
    await expect(firstCheck2.locator('text=✓')).toBeVisible({ timeout: 3_000 });
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

    // 클릭해도 selectedLogCard / editCheckToggle이 나타나지 않아야 함
    await tomorrowCell.click({ force: true }); // disabled여도 force로 클릭 시도
    await expect(page.getByTestId(sel.recordsCalEditToggle)).not.toBeVisible({ timeout: 1_500 });
  });
});
