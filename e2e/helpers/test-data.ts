// 테스트 데이터 상수
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@catcare.test';
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';
export const TEST_NAME = 'E2E집사';

export const SIGNUP_TEST_EMAIL = 'e2e-signup-test@catcare.test';
export const SIGNUP_TEST_PASSWORD = 'SignupTest123!';
export const SIGNUP_TEST_NAME = 'E2E가입집사';

export const TEST_CAT = {
  name: 'E2E냥이',
  editedName: 'E2E수정냥이',
};

export const TEST_RECIPE = {
  name: 'E2E밥주기',
  editedName: 'E2E밥주기(수정)',
};

export const TEST_LOG = {
  text: 'E2E 테스트 메모입니다',
  editedText: 'E2E 테스트 메모 수정',
  secondText: 'E2E 두번째 메모입니다',
};
