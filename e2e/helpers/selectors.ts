// testID 기반 셀렉터 모음
// React Native Web에서 testID → data-testid 매핑

export const sel = {
  // Auth
  authTabLogin: 'auth-tab-login',
  authTabSignup: 'auth-tab-signup',
  authEmailInput: 'auth-email-input',
  authPasswordInput: 'auth-password-input',
  authNameInput: 'auth-name-input',
  authSubmitButton: 'auth-submit-button',
  authErrorText: 'auth-error-text',

  // Bottom Nav
  navHome: '홈',
  navCats: '고양이',
  navRecords: '기록',
  navSettings: '관리',

  // Cats
  catsAddButton: 'cats-add-button',
  catFormNameInput: 'cat-form-name-input',
  catFormSaveButton: 'cat-form-save-button',
  catFormGenderMale: 'cat-form-gender-male',
  catFormGenderFemale: 'cat-form-gender-female',
  catFormDeleteButton: 'cat-form-delete-button',

  // Recipe
  recipeAddButton: (catId: string) => `cats-add-recipe-${catId}`,
  recipeFormNameInput: 'recipe-form-name-input',
  recipeFormSaveButton: 'recipe-form-save-button',
  recipeFormTimeMorning: 'recipe-form-time-morning',
  recipeFormDeleteButton: 'recipe-form-delete-button',
  recipeToggle: (recipeId: string) => `recipe-toggle-${recipeId}`,

  // Home
  homeLogButton: 'home-log-button',
  logFormTextInput: 'log-form-text-input',
  logFormSaveButton: 'log-form-save-button',
} as const;
