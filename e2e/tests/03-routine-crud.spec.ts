import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';
import { TEST_CAT, TEST_RECIPE } from '../helpers/test-data';
import { ensureLoggedIn } from '../helpers/auth';

async function goToCatsAndExpand(page: import('@playwright/test').Page) {
  await ensureLoggedIn(page);
  await page.getByText('고양이', { exact: true }).click();
  await expect(page.getByText('고양이 관리')).toBeVisible();
  // 고양이 카드 클릭하여 펼치기
  const catCard = page.locator('[data-testid^="cats-expand-"]').first();
  await catCard.waitFor({ timeout: 10_000 });
  await catCard.click();
  // 루틴 패널이 펼쳐질 때까지 대기
  await page.getByText('+ 루틴 추가').waitFor({ timeout: 5_000 });
}

test.describe.serial('Routine CRUD', () => {
  test('사전 준비: 고양이 등록', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    await page.getByTestId(sel.catsAddButton).click();
    await expect(page.getByText('고양이 등록', { exact: true })).toBeVisible();
    await page.getByTestId(sel.catFormNameInput).fill(TEST_CAT.name);
    await page.getByTestId(sel.catFormGenderMale).click();
    await page.getByTestId(sel.catFormSaveButton).click();
    await expect(page.getByTestId(sel.catFormSaveButton)).not.toBeVisible({ timeout: 15_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    await expect(page.locator('[data-testid^="cats-card-"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('루틴 등록', async ({ page }) => {
    await goToCatsAndExpand(page);
    await page.getByText('+ 루틴 추가').click();
    await expect(page.getByText('루틴 항목 등록')).toBeVisible();

    await page.getByTestId(sel.recipeFormNameInput).fill(TEST_RECIPE.name);
    await page.getByTestId(sel.recipeFormSaveButton).click();
    await expect(page.getByText('루틴 항목 등록')).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await goToCatsAndExpand(page);
    // CatsScreen의 펼침 패널 안에서 루틴 이름 확인 (HomeScreen의 숨겨진 요소 회피)
    const catsPanel = page.locator('[data-testid^="cats-card-"]').first();
    await expect(catsPanel.locator(`text=${TEST_RECIPE.name}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('루틴 수정', async ({ page }) => {
    await goToCatsAndExpand(page);
    // CatsScreen 패널 안에서 루틴 이름 클릭
    const catsPanel = page.locator('[data-testid^="cats-card-"]').first();
    await catsPanel.locator(`text=${TEST_RECIPE.name}`).first().click();
    await expect(page.getByText('루틴 수정')).toBeVisible();

    await page.getByTestId(sel.recipeFormNameInput).clear();
    await page.getByTestId(sel.recipeFormNameInput).fill(TEST_RECIPE.editedName);
    await page.getByTestId(sel.recipeFormSaveButton).click();
    await expect(page.getByText('루틴 수정')).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await goToCatsAndExpand(page);
    const catsPanelAfter = page.locator('[data-testid^="cats-card-"]').first();
    await expect(catsPanelAfter.locator(`text=${TEST_RECIPE.editedName}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('루틴 삭제', async ({ page }) => {
    await goToCatsAndExpand(page);
    const catsPanel = page.locator('[data-testid^="cats-card-"]').first();
    await catsPanel.locator(`text=${TEST_RECIPE.editedName}`).first().click();
    await expect(page.getByText('루틴 수정')).toBeVisible();

    // 삭제 버튼 클릭 → BottomSheet 닫힘(300ms) → window.confirm 다이얼로그 → 삭제 실행
    const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId(sel.recipeFormDeleteButton).click();
    await dialogPromise;
    // 삭제 API 완료 대기
    await page.waitForTimeout(2000);

    await page.reload();
    await goToCatsAndExpand(page);
    const catsPanelAfter = page.locator('[data-testid^="cats-card-"]').first();
    await expect(catsPanelAfter.locator(`text=${TEST_RECIPE.editedName}`)).not.toBeVisible({ timeout: 5_000 });
  });
});
