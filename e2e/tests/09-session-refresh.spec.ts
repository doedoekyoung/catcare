// access token 만료 후 앱을 다시 열면 refresh token으로 조용히 갱신되어 로그인이 유지되는지 검증.
//
// 회귀 배경: onAuthStateChange 콜백 안에서 DB 조회를 await하면 refresh 직후 auth lock 데드락이 나
// refresh는 성공(200)했는데 앱이 진행하지 못하고 10초 fallback으로 로그인 화면이 떴다.
// ensureLoggedIn 헬퍼는 로딩에서 멈추면 저장소를 지우고 재로그인해 이 버그를 가리므로 쓰지 않는다.
import { test, expect, type Page } from '@playwright/test';
import { sel } from '../helpers/selectors';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/test-data';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// supabase-js 기본 storageKey: sb-<프로젝트ref>-auth-token
const SESSION_KEY = `sb-${SUPABASE_URL.match(/^https?:\/\/([^./]+)/)![1]}-auth-token`;
const USER_CACHE_KEY = '_cc_user';

async function login(page: Page) {
  await page.goto('/');
  await page.getByTestId(sel.authEmailInput).fill(TEST_EMAIL);
  await page.getByTestId(sel.authPasswordInput).fill(TEST_PASSWORD);
  await page.getByTestId(sel.authSubmitButton).click();
  await expect(page.getByText('오늘의 돌봄 루틴')).toBeVisible({ timeout: 15_000 });
}

const readRefreshToken = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.refresh_token ?? null, SESSION_KEY);

// 저장된 세션의 expires_at만 과거로 — access token을 강제 만료. refresh token은 유효 그대로.
async function expireAccessToken(page: Page, { dropUserCache }: { dropUserCache: boolean }) {
  await page.evaluate(([k, cacheKey, drop]) => {
    const s = JSON.parse(localStorage.getItem(k as string)!);
    s.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem(k as string, JSON.stringify(s));
    if (drop) localStorage.removeItem(cacheKey as string);
  }, [SESSION_KEY, USER_CACHE_KEY, dropUserCache] as const);
}

test.describe.serial('Session refresh (access token 만료)', () => {
  // 로그인 상태부터 직접 만들므로 storageState 없이 실행
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const dropUserCache of [false, true]) {
    test(`만료 후 재실행 → 재로그인 없이 홈 유지 (유저 캐시 ${dropUserCache ? '없음=네이티브 콜드 스타트' : '있음'})`, async ({ page }) => {
      await login(page);
      const before = await readRefreshToken(page);
      expect(before).toBeTruthy();

      await expireAccessToken(page, { dropUserCache });
      await page.reload();

      // 10초 fallback(로그인 화면)보다 훨씬 빨라야 한다 — 정상이면 1~2초.
      await expect(page.getByText('오늘의 돌봄 루틴')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByTestId(sel.authEmailInput)).toBeHidden();

      // refresh가 실제로 일어나 refresh token이 교체(rotation)됐는지
      await expect.poll(() => readRefreshToken(page), { timeout: 5_000 }).not.toBe(before);
    });
  }
});
