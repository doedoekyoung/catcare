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

    await page.getByText('기록', { exact: true }).click();
    await expect(page.getByTestId(sel.recordsTabWrite)).toBeVisible();

    // 전체 모드 기본 — 첫 고양이 카드가 자동 펼침 상태, "+ 메모 추가" 버튼이 보임
    await page.locator('[data-testid^="records-add-log-"]').first().click();
    await expect(page.getByTestId(sel.logFormTextInput)).toBeVisible();

    await page.getByTestId(sel.logFormTextInput).fill(TEST_LOG.text);
    await page.getByTestId(sel.logFormSaveButton).click();
    await expect(page.getByTestId(sel.logFormSaveButton)).not.toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(TEST_LOG.text)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();
    await expect(page.getByText(TEST_LOG.text)).toBeVisible({ timeout: 10_000 });
  });

  test('메모 수정', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();

    await expect(page.getByText(TEST_LOG.text)).toBeVisible({ timeout: 10_000 });
    await page.getByText(TEST_LOG.text).click();
    await expect(page.getByTestId(sel.logFormTextInput)).toBeVisible();

    const input = page.getByTestId(sel.logFormTextInput);
    await expect(input).toHaveValue(TEST_LOG.text);

    await input.clear();
    await input.fill(TEST_LOG.editedText);
    await page.getByTestId(sel.logFormSaveButton).click();
    await expect(page.getByTestId(sel.logFormSaveButton)).not.toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(TEST_LOG.editedText)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();
    await expect(page.getByText(TEST_LOG.editedText)).toBeVisible({ timeout: 10_000 });
  });

  test('복수 메모 추가 후 모두 표시', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();

    await expect(page.getByText(TEST_LOG.editedText)).toBeVisible({ timeout: 10_000 });

    // "+ 메모 추가" 버튼으로 두번째 메모 작성
    await page.locator('[data-testid^="records-add-log-"]').first().click();
    await expect(page.getByTestId(sel.logFormTextInput)).toBeVisible();

    await page.getByTestId(sel.logFormTextInput).fill(TEST_LOG.secondText);
    await page.getByTestId(sel.logFormSaveButton).click();
    await expect(page.getByTestId(sel.logFormSaveButton)).not.toBeVisible({ timeout: 10_000 });

    // 두 메모가 모두 기록에 표시
    await expect(page.getByText(TEST_LOG.editedText)).toBeVisible();
    await expect(page.getByText(TEST_LOG.secondText)).toBeVisible();

    // 새로고침 후에도 유지
    await page.reload();
    await ensureLoggedIn(page);
    await page.getByText('기록', { exact: true }).click();
    await expect(page.getByText(TEST_LOG.editedText)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(TEST_LOG.secondText)).toBeVisible({ timeout: 10_000 });
  });
});
