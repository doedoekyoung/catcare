import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';
import { TEST_CAT, TEST_LOG } from '../helpers/test-data';
import { ensureLoggedIn } from '../helpers/auth';

test.describe.serial('Log CRUD', () => {
  test('사전 준비: 고양이 등록', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    await page.getByTestId(sel.catsAddButton).click();
    await page.getByTestId(sel.catFormNameInput).fill(TEST_CAT.name);
    await page.getByTestId(sel.catFormGenderMale).click();
    await page.getByTestId(sel.catFormSaveButton).click();
    await expect(page.getByTestId(sel.catFormSaveButton)).not.toBeVisible({ timeout: 15_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('고양이', { exact: true }).click();
    await expect(page.locator('[data-testid^="cats-card-"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('메모 작성', async ({ page }) => {
    await ensureLoggedIn(page);

    await page.getByTestId(sel.homeLogButton).click();
    await expect(page.getByTestId(sel.logFormTextInput)).toBeVisible();

    await page.getByTestId(sel.logFormTextInput).fill(TEST_LOG.text);
    await page.getByTestId(sel.logFormSaveButton).click();

    // 모달이 닫힐 때까지 대기
    await expect(page.getByTestId(sel.logFormSaveButton)).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await expect(page.getByText(TEST_LOG.text)).toBeVisible({ timeout: 10_000 });
  });

  test('메모 수정', async ({ page }) => {
    await ensureLoggedIn(page);

    // 기존 메모의 "수정" 버튼 클릭
    await expect(page.getByText(TEST_LOG.text)).toBeVisible({ timeout: 10_000 });
    await page.getByText('수정', { exact: true }).click();
    await expect(page.getByTestId(sel.logFormTextInput)).toBeVisible();

    const input = page.getByTestId(sel.logFormTextInput);
    await expect(input).toHaveValue(TEST_LOG.text);

    await input.clear();
    await input.fill(TEST_LOG.editedText);
    await page.getByTestId(sel.logFormSaveButton).click();

    // 모달이 닫힐 때까지 대기 (저장 완료 확인)
    await expect(page.getByTestId(sel.logFormSaveButton)).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await expect(page.getByText(TEST_LOG.editedText)).toBeVisible({ timeout: 10_000 });
  });
});
