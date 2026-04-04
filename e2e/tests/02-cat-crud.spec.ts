import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';
import { TEST_CAT } from '../helpers/test-data';
import { ensureLoggedIn } from '../helpers/auth';

test.describe.serial('Cat CRUD', () => {
  test('고양이 등록', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    await expect(page.getByText('고양이 관리')).toBeVisible();

    await page.getByTestId(sel.catsAddButton).click();
    await expect(page.getByText('고양이 등록', { exact: true })).toBeVisible();

    await page.getByTestId(sel.catFormNameInput).fill(TEST_CAT.name);
    await page.getByTestId(sel.catFormGenderMale).click();
    await page.getByTestId(sel.catFormSaveButton).click();

    // BottomSheet 닫힘 대기 (저장 완료 후 닫힘)
    await expect(page.getByTestId(sel.catFormSaveButton)).not.toBeVisible({ timeout: 15_000 });

    // 새로고침 후 카드 확인 — testID로 cats-card 존재 확인
    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    // cats-card-{id} testID를 가진 요소가 있는지 확인
    await expect(page.locator('[data-testid^="cats-card-"]').first()).toBeVisible({ timeout: 10_000 });
    // 해당 카드 안에 고양이 이름이 있는지 확인
    const catCard = page.locator('[data-testid^="cats-card-"]').first();
    await expect(catCard.getByText(TEST_CAT.name)).toBeVisible();
  });

  test('고양이 수정', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();

    // 카드가 보일 때까지 대기
    await expect(page.locator('[data-testid^="cats-card-"]').first()).toBeVisible({ timeout: 10_000 });
    await page.getByText('편집').first().click();
    await expect(page.getByText('고양이 수정')).toBeVisible();

    await page.getByTestId(sel.catFormNameInput).clear();
    await page.getByTestId(sel.catFormNameInput).fill(TEST_CAT.editedName);
    await page.getByTestId(sel.catFormSaveButton).click();

    await expect(page.getByText('고양이 수정')).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    const catCard = page.locator('[data-testid^="cats-card-"]').first();
    await expect(catCard).toBeVisible({ timeout: 10_000 });
    await expect(catCard.getByText(TEST_CAT.editedName)).toBeVisible();
  });

  test('고양이 삭제', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();

    // 카드가 보일 때까지 대기
    await expect(page.locator('[data-testid^="cats-card-"]').first()).toBeVisible({ timeout: 10_000 });

    // 수정된 이름의 카드에서 편집 클릭
    const targetCard = page.locator('[data-testid^="cats-card-"]').filter({ hasText: TEST_CAT.editedName }).first();
    await targetCard.getByText('편집').click();
    await expect(page.getByText('고양이 수정')).toBeVisible();

    // 삭제 버튼 클릭 → BottomSheet 닫힘(300ms) → window.confirm 다이얼로그 → 삭제 실행
    const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId(sel.catFormDeleteButton).click();
    await dialogPromise;
    // 삭제 API 완료 대기
    await page.waitForTimeout(2000);

    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    // 삭제된 고양이 이름이 없어야 함
    await expect(page.getByText(TEST_CAT.editedName)).not.toBeVisible({ timeout: 10_000 });
  });
});
