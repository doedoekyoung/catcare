import { type Page, expect } from '@playwright/test';
import { sel } from './selectors';
import { TEST_EMAIL, TEST_PASSWORD } from './test-data';

/**
 * 앱에 로그인된 상태를 보장.
 * 로딩 화면, 로그인 화면, 홈 화면 모두 처리.
 */
export async function ensureLoggedIn(page: Page) {
  await page.goto('/');
  // 어떤 상태든 나타날 때까지 최대 30초 대기
  for (let i = 0; i < 60; i++) {
    // 이미 홈 화면이면 바로 리턴
    if (await page.getByText('오늘의 돌봄 루틴').isVisible().catch(() => false)) {
      await page.waitForTimeout(500); // store 안정화
      return;
    }
    // 로그인 폼이 보이면 로그인 수행
    if (await page.getByTestId(sel.authEmailInput).isVisible().catch(() => false)) {
      await page.getByTestId(sel.authEmailInput).fill(TEST_EMAIL);
      await page.getByTestId(sel.authPasswordInput).fill(TEST_PASSWORD);
      await page.getByTestId(sel.authSubmitButton).click();
      await expect(page.getByText('오늘의 돌봄 루틴')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(500);
      return;
    }
    // 로딩 화면의 리셋 버튼이 보이면 클릭 → 세션 리셋 후 새로고침
    if (await page.getByText('로그인 문제 해결').isVisible().catch(() => false)) {
      // localStorage 직접 클리어 후 새로고침
      await page.evaluate(() => {
        localStorage.clear();
      });
      await page.reload();
      // 로그인 화면이 나올 때까지 대기
      await page.getByTestId(sel.authEmailInput).waitFor({ timeout: 15_000 });
      await page.getByTestId(sel.authEmailInput).fill(TEST_EMAIL);
      await page.getByTestId(sel.authPasswordInput).fill(TEST_PASSWORD);
      await page.getByTestId(sel.authSubmitButton).click();
      await expect(page.getByText('오늘의 돌봄 루틴')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(500);
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('앱이 어떤 화면으로도 전환되지 않았습니다 (30초 타임아웃)');
}
