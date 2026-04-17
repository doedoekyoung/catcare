import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { sel } from '../helpers/selectors';
import { TEST_CAT, TEST_RECIPE, TEST_EMAIL, TEST_PASSWORD } from '../helpers/test-data';
import { ensureLoggedIn } from '../helpers/auth';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 테스트 계정 household의 share_token을 새로 발급하고 cat/recipe id를 가져옴.
async function prepareShareContext() {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const user = createClient(supabaseUrl, supabaseAnon);

  const { data: auth } = await user.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  const { data: u } = await user.from('users').select('household_id').eq('uid', auth.user!.id).single();
  const hhId = u!.household_id as string;

  // 항상 새 토큰 발급 (만료 고려 없이 재현 가능하게)
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('households')
    .update({ share_token: token, share_token_expiry: expiry })
    .eq('id', hhId);

  const { data: cats } = await admin.from('cats').select('id, name').eq('household_id', hhId);
  const { data: recipes } = await admin.from('recipes').select('id, name, times').eq('household_id', hhId).eq('active', true);
  await user.auth.signOut();

  return { token, hhId, cats: cats ?? [], recipes: recipes ?? [] };
}

test.describe.serial('Share Link (펫시터 뷰)', () => {
  test('사전 준비: 고양이 + 루틴 등록', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();

    // 고양이가 없으면 등록
    const existing = await page.locator('[data-testid^="cats-card-"]').count();
    if (existing === 0) {
      await page.getByTestId(sel.catsAddButton).click();
      await page.getByTestId(sel.catFormNameInput).fill(TEST_CAT.name);
      await page.getByTestId(sel.catFormGenderFemale).click();
      await page.getByTestId(sel.catFormSaveButton).click();
      await expect(page.getByTestId(sel.catFormSaveButton)).not.toBeVisible({ timeout: 15_000 });
    }

    // 고양이 카드 펼치고 루틴이 없으면 등록
    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    const expandToggle = page.locator('[data-testid^="cats-expand-"]').first();
    await expandToggle.waitFor({ timeout: 10_000 });
    await expandToggle.click();
    await page.getByText('+ 루틴 추가').waitFor({ timeout: 5_000 });

    const hasRecipe = await page.locator('[data-testid^="recipe-toggle-"]').count();
    if (hasRecipe === 0) {
      await page.getByText('+ 루틴 추가').click();
      await expect(page.getByText('루틴 항목 등록')).toBeVisible();
      await page.getByTestId(sel.recipeFormNameInput).fill(TEST_RECIPE.name);
      await page.getByTestId(sel.recipeFormSaveButton).click();
      await expect(page.getByText('루틴 항목 등록')).not.toBeVisible({ timeout: 15_000 });
    }
  });

  test('공유 URL로 펫시터 뷰 진입 (비로그인 브라우저)', async ({ browser }) => {
    const { token, cats, recipes } = await prepareShareContext();
    expect(cats.length).toBeGreaterThan(0);
    expect(recipes.length).toBeGreaterThan(0);

    // 완전 격리된 컨텍스트 = localStorage 없음 = 로그인 안 된 상태
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`/share/${token}`);

    // 펫시터 뷰 헤더 확인
    await expect(page.getByText('펫시터 뷰')).toBeVisible({ timeout: 15_000 });
    // 고양이 이름 중 하나가 보여야 함
    await expect(page.getByText(cats[0].name).first()).toBeVisible({ timeout: 10_000 });
    // 루틴 이름 중 하나가 보여야 함
    await expect(page.getByText(recipes[0].name).first()).toBeVisible();

    await ctx.close();
  });

  test('공유 뷰에서 체크 토글 → DB 반영', async ({ browser }) => {
    const { token, hhId, cats, recipes } = await prepareShareContext();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const today = new Date().toISOString().slice(0, 10);

    // 깨끗한 상태에서 시작
    await admin.from('check_records').delete().eq('household_id', hhId).eq('date', today);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/share/${token}`);
    await expect(page.getByText('펫시터 뷰')).toBeVisible({ timeout: 15_000 });

    // 첫 번째 체크 아이템 클릭 (testID로 정확히 타겟)
    const checkItem = page.locator('[data-testid^="share-check-"]').first();
    await checkItem.waitFor({ timeout: 10_000 });
    await checkItem.click();

    // DB에 INSERT됐는지 확인 (polling)
    let inserted: any = null;
    for (let i = 0; i < 10; i++) {
      const { data } = await admin.from('check_records')
        .select('*').eq('household_id', hhId).eq('date', today).eq('done', true);
      if (data && data.length > 0) { inserted = data[0]; break; }
      await page.waitForTimeout(500);
    }
    expect(inserted).not.toBeNull();
    expect(inserted.done).toBe(true);
    // 펫시터(익명) 체크는 done_by가 NULL로 저장됨
    expect(inserted.done_by).toBeNull();

    // 다시 클릭 → done=false로 토글
    await checkItem.click();
    for (let i = 0; i < 10; i++) {
      const { data } = await admin.from('check_records')
        .select('*').eq('household_id', hhId).eq('date', today).eq('id', inserted.id).single();
      if (data && data.done === false) { inserted = data; break; }
      await page.waitForTimeout(500);
    }
    expect(inserted.done).toBe(false);

    // cleanup
    await admin.from('check_records').delete().eq('household_id', hhId).eq('date', today);
    await ctx.close();
  });

  test('만료·잘못된 토큰 → 에러 메시지 노출', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/share/INVALID_TOKEN_XYZ');
    await expect(page.getByText('링크를 열 수 없습니다')).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });
});
