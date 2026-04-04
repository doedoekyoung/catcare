import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';
import { TEST_CAT, TEST_RECIPE } from '../helpers/test-data';
import { ensureLoggedIn } from '../helpers/auth';

test.describe.serial('Routine Check', () => {
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
  });

  test('홈에서 체크 토글', async ({ page }) => {
    await ensureLoggedIn(page);
    // 홈 탭에서 체크 항목 확인
    const checkItem = page.locator('[data-testid^="home-check-"]').first();
    await expect(checkItem).toBeVisible({ timeout: 10_000 });
    await checkItem.click();

    // 완료 배지 1/x 확인
    await expect(page.getByText(/1\s*\//).first()).toBeVisible({ timeout: 5_000 });

    // 다시 클릭 → 해제
    await checkItem.click();
    await expect(page.getByText(/0\s*\//).first()).toBeVisible({ timeout: 5_000 });
  });
});
