// 루틴 "N일마다"(격일 등) 반복 — 홈 노출 판정 + 등록 UI.
// 전제: supabase/migrations/20260920_recipe_interval.sql 이 서버에 적용돼 있어야 한다.
// 사전 준비는 admin client로 직접 insert (08 spec과 동일한 이유: UI 등록 race 회피).
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { sel } from '../helpers/selectors';
import { TEST_CAT } from '../helpers/test-data';
import { ensureLoggedIn } from '../helpers/auth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@catcare.test';

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const NAMES = {
  todayEvery2: 'E2E격일오늘시작',
  yesterdayEvery2: 'E2E격일어제시작',
  tomorrowEvery3: 'E2E3일마다내일시작',
  daily: 'E2E매일루틴',
  ui: 'E2E격일UI등록',
};

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
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

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

  const base = {
    time: 'morning', times: ['morning'], days: [], cat_ids: [cat!.id], active: true,
    household_id: householdId, created_at: weekAgo.toISOString(), updated_at: now,
  };
  const { error } = await admin.from('recipes').insert([
    // 오늘 시작 격일 → 오늘 해당
    { ...base, name: NAMES.todayEvery2, interval_days: 2, start_date: dateKey(0) },
    // 어제 시작 격일 → 오늘은 간격 사이라 해당 없음
    { ...base, name: NAMES.yesterdayEvery2, interval_days: 2, start_date: dateKey(-1) },
    // 내일 시작 3일마다 → 시작일 이전이라 오늘은 해당 없음
    { ...base, name: NAMES.tomorrowEvery3, interval_days: 3, start_date: dateKey(1) },
    // 대조군: 기존 방식(매일)
    { ...base, name: NAMES.daily },
  ]);
  if (error) throw error;
}

test.describe.serial('Routine interval (N일마다)', () => {
  test.beforeAll(async () => {
    await setupFixtures();
  });

  test('홈: 오늘 해당하는 루틴만 노출 (시작일 이전/간격 사이는 숨김)', async ({ page }) => {
    await ensureLoggedIn(page);
    await expect(page.getByText(NAMES.daily).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(NAMES.todayEvery2).first()).toBeVisible();
    await expect(page.getByText(NAMES.yesterdayEvery2)).toHaveCount(0);
    await expect(page.getByText(NAMES.tomorrowEvery3)).toHaveCount(0);
  });

  test('등록 UI: N일마다(격일) 선택 → 저장 → 카드에 격일 표시 · 새로고침 후 유지', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    await expect(page.getByText('고양이 관리')).toBeVisible();
    const catCard = page.locator('[data-testid^="cats-expand-"]').first();
    await catCard.waitFor({ timeout: 10_000 });
    await catCard.click();
    await page.getByText('+ 루틴 추가').click();
    await expect(page.getByText('루틴 항목 등록')).toBeVisible();

    await page.getByTestId(sel.recipeFormNameInput).fill(NAMES.ui);
    await page.getByTestId(sel.recipeFormModeInterval).click();
    await page.getByTestId(sel.recipeFormIntervalChip(2)).click();
    await page.getByTestId(sel.recipeFormStartToday).click();
    await page.getByTestId(sel.recipeFormSaveButton).click();
    await expect(page.getByText('루틴 항목 등록')).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    const panel = page.locator('[data-testid^="cats-card-"]').first();
    await panel.locator('[data-testid^="cats-expand-"]').first().click().catch(() => {});
    await expect(panel.getByText('격일 (').first()).toBeVisible({ timeout: 10_000 });

    // 오늘 시작이므로 홈에도 노출
    await page.getByText('홈', { exact: true }).click();
    await expect(page.getByText(NAMES.ui).first()).toBeVisible({ timeout: 10_000 });
  });
});
