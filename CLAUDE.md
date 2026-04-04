# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # 의존성 설치
npm run web              # 웹 개발 서버 (Expo)
npm run start            # Expo 개발 서버 (Expo Go)
npm run build            # Vercel용 웹 빌드 (expo export --platform web)
npm run ios              # iOS 시뮬레이터
npm run android          # Android 에뮬레이터
npm run test:e2e         # E2E 테스트 실행 (headless)
npm run test:e2e:headed  # E2E 테스트 실행 (브라우저 표시)
npm run test:e2e:ui      # Playwright UI 모드
```

패키지 추가 시 peer dependency 충돌이 있으면 `--legacy-peer-deps` 필요.

## E2E 테스트

**코드 변경 후 반드시 `npm run test:e2e`를 실행하여 모든 테스트가 통과하는지 확인해야 한다.** 테스트가 실패하는 상태로 커밋하지 않는다.

- **프레임워크**: Playwright (Chromium)
- **테스트 대상**: 빌드된 웹 앱 (`dist/`)을 `serve`로 제공
- **사전 조건**: `npm run build`로 빌드가 완료되어 있어야 함
- **환경변수**: `.env.local` (Supabase URL/KEY) + `.env.test` (테스트 계정 정보)

### 테스트 구조 (`e2e/`)
| 파일 | 내용 |
|------|------|
| `tests/01-auth.spec.ts` | 로그인/회원가입 |
| `tests/02-cat-crud.spec.ts` | 고양이 등록/수정/삭제 |
| `tests/03-routine-crud.spec.ts` | 루틴 등록/수정/삭제 |
| `tests/04-routine-check.spec.ts` | 홈 체크 토글 |
| `tests/05-log-crud.spec.ts` | 메모 작성/수정 |
| `helpers/auth.ts` | 로그인 헬퍼 (`ensureLoggedIn`) |
| `helpers/cleanup.ts` | Supabase API로 테스트 데이터 정리 |
| `helpers/selectors.ts` | testID 셀렉터 모음 |
| `helpers/test-data.ts` | 테스트 데이터 상수 |

### testID 규칙
- 네이밍: `{screen}-{element}-{qualifier}` (예: `cat-form-name-input`)
- React Native Web에서 `testID`는 `data-testid`로 렌더링됨
- 새 UI 요소 추가 시 E2E 테스트에서 사용할 `testID`를 함께 추가할 것

## 아키텍처

### 기술 스택
- **Expo SDK 51** + **React Native 0.74** — 모바일 앱 (향후 배포 목표)
- **Expo web** (`expo export --platform web`) — 현재 Vercel로 배포 중
- **Supabase** — Auth, PostgreSQL DB, Realtime, Storage
- **Zustand** — 전역 상태 관리
- **@react-navigation** (Stack + BottomTabs) — 네비게이션

### 데이터 흐름
```
AppNavigator.tsx
  └─ subscribeToAuthState() → Supabase Auth
       └─ 로그인 시: getHouseholdById → subscribeToCats/Recipes/Checks/Logs
            └─ 각 subscribe 함수: 초기 fetch + Supabase Realtime 채널 구독
                 └─ Zustand store (useStore) → 각 Screen에서 소비
```

### 서비스 레이어 (`src/services/`)
| 파일 | 역할 |
|------|------|
| `supabase.ts` | Supabase 클라이언트 초기화, TABLES 상수 |
| `authService.ts` | 이메일 회원가입/로그인, 익명 로그인, auth 상태 구독 |
| `dbService.ts` | 모든 DB CRUD + Realtime 구독 + Storage 업로드 |
| `analyticsService.ts` | GA4 `logEvent` 래퍼 (gtag 주입 필요) |
| `exportService.ts` | CSV/HTML 리포트 생성 후 네이티브 공유 |
| `notificationService.ts` | Expo 푸시 알림 스케줄링 |

### 핵심 데이터 모델
- **Household** — 가구 단위. 모든 데이터의 루트. `household_id`로 격리
- **User** — `auth.users(id)`를 PK로 참조하는 `users` 테이블
- **Recipe** — 루틴 항목. `cat_ids[]`로 다묘 연결, `time: 'am'|'pm'|'all'`
- **CheckRecord** — PK: `${date}_${recipeId}_${catId}` (자정 자동 초기화 구조)
- **DailyLog** — 특이사항 기록. 사진 포함 가능

### 환경변수 (`EXPO_PUBLIC_` 접두사 필수)
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GA_MEASUREMENT_ID
```
로컬: `.env.local` / 배포: Vercel Environment Variables

### Supabase Realtime 구독 패턴
`dbService.ts`의 모든 `subscribe*` 함수는 동일한 패턴:
1. 초기 데이터 fetch (`.select()`)
2. `postgres_changes` 채널 등록 → 변경 시 재fetch
3. 반환값이 unsubscribe 함수 (`() => supabase.removeChannel(channel)`)

`AppNavigator.tsx`에서 구독하고 반환된 unsubscribe를 `useEffect` cleanup에서 호출.

### 네비게이션 구조
```
Stack
  ├─ Auth (비로그인)
  └─ Main → BottomTabs
       ├─ Home (체크리스트)
       ├─ Cats (고양이 + 루틴 관리)
       ├─ Records (기록 타임라인)
       └─ Settings
```
`ShareScreen`은 공유 링크 전용 — 익명 로그인 후 특정 household의 체크리스트만 조회/체크 가능.

### Vercel 배포
- `vercel.json`: `expo export --platform web` → `dist/` 출력
- `web/index.html`: GA4 gtag 스크립트 주입 (`%EXPO_PUBLIC_GA_MEASUREMENT_ID%` 치환)
- `react-native-web`, `react-dom`, `@expo/metro-runtime` 필수
