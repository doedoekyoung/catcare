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

  // Records
  recordsTabWrite: 'records-tab-write',
  recordsTabCalendar: 'records-tab-calendar',
  recordsDatePrev: 'records-date-prev',
  recordsDateNext: 'records-date-next',
  recordsChipAll: 'records-chip-all',
  recordsChip: (catId: string) => `records-chip-${catId}`,
  recordsCatCard: (catId: string) => `records-cat-card-${catId}`,
  recordsCatHeader: (catId: string) => `records-cat-header-${catId}`,
  recordsAddLog: (catId: string) => `records-add-log-${catId}`,
  logFormTextInput: 'log-form-text-input',
  logFormSaveButton: 'log-form-save-button',

  // Calendar (past routine edit)
  recordsCalPrevMonth: 'records-cal-prev-month',
  recordsCalNextMonth: 'records-cal-next-month',
  recordsCalDay: (dateKey: string) => `records-cal-day-${dateKey}`,
  recordsCalEditToggle: 'records-cal-edit-toggle',
  recordsCalEditBody: 'records-cal-edit-body',
  recordsCalEditSave: 'records-cal-edit-save',
  recordsCalEditCancel: 'records-cal-edit-cancel',
  recordsCalCheck: (recipeId: string, slot: 'morning' | 'lunch' | 'evening') => `records-cal-check-${recipeId}-${slot}`,
} as const;
