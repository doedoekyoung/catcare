import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';
import { TEST_EMAIL, TEST_PASSWORD, SIGNUP_TEST_EMAIL, SIGNUP_TEST_PASSWORD, SIGNUP_TEST_NAME } from '../helpers/test-data';
import { cleanupSignupTestUser } from '../helpers/cleanup';

test.describe.serial('Auth', () => {
  // 이 테스트 그룹은 storageState 없이 실행 (로그인 자체를 테스트)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('빈 필드로 로그인 시 에러 표시', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(sel.authSubmitButton).waitFor();
    await page.getByTestId(sel.authSubmitButton).click();
    await expect(page.getByTestId(sel.authErrorText)).toBeVisible();
    await expect(page.getByTestId(sel.authErrorText)).toContainText('이메일과 비밀번호를 입력해주세요');
  });

  test('잘못된 비밀번호로 로그인 시 에러 표시', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(sel.authEmailInput).fill(TEST_EMAIL);
    await page.getByTestId(sel.authPasswordInput).fill('wrongpassword123');
    await page.getByTestId(sel.authSubmitButton).click();
    await expect(page.getByTestId(sel.authErrorText)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(sel.authErrorText)).toContainText('실패');
  });

  test('정상 로그인 → 홈 화면 이동', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(sel.authEmailInput).fill(TEST_EMAIL);
    await page.getByTestId(sel.authPasswordInput).fill(TEST_PASSWORD);
    await page.getByTestId(sel.authSubmitButton).click();
    await expect(page.getByText('오늘의 돌봄 루틴')).toBeVisible({ timeout: 15_000 });
  });

  test('회원가입 → 홈 화면 이동', async ({ page }) => {
    // 사전 정리: 이전 실행에서 남은 테스트 계정 삭제
    await cleanupSignupTestUser(SIGNUP_TEST_EMAIL);

    // 이전 테스트 세션이 남아있을 수 있으므로 완전 초기화
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId(sel.authTabSignup).waitFor({ timeout: 10_000 });
    await page.getByTestId(sel.authTabSignup).click();
    await expect(page.getByTestId(sel.authNameInput)).toBeVisible();

    await page.getByTestId(sel.authEmailInput).fill(SIGNUP_TEST_EMAIL);
    await page.getByTestId(sel.authPasswordInput).fill(SIGNUP_TEST_PASSWORD);
    await page.getByTestId(sel.authNameInput).fill(SIGNUP_TEST_NAME);
    await page.getByTestId(sel.authSubmitButton).click();

    // 홈 화면 진입 확인
    await expect(page.getByText('오늘의 돌봄 루틴')).toBeVisible({ timeout: 20_000 });

    // 사후 정리: 테스트 계정 삭제
    await cleanupSignupTestUser(SIGNUP_TEST_EMAIL);
  });

  test('회원가입 탭 전환', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(sel.authTabSignup).click();
    await expect(page.getByTestId(sel.authNameInput)).toBeVisible();
    await page.getByTestId(sel.authTabLogin).click();
    await expect(page.getByTestId(sel.authNameInput)).not.toBeVisible();
  });
});
