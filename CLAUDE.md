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
npm run test:platform    # 플랫폼 가드 검증 (grep) + 네이티브 마운트 스모크(jest-expo)
npm run test             # 전체 jest 단위 테스트
npm run test:e2e         # E2E 테스트 실행 (headless)
npm run test:e2e:headed  # E2E 테스트 실행 (브라우저 표시)
npm run test:e2e:ui      # Playwright UI 모드
```

패키지 추가 시 peer dependency 충돌이 있으면 `--legacy-peer-deps` 필요.

## Push 전 필수 검증 (배포 회귀 방지)

**`git push` 전에 반드시 아래 순서를 수행한다.** 하나라도 실패하면 push 금지.

1. **커밋 범위와 import 의존성 일치 확인** — 커밋에 포함되는 파일이 참조하는 모든 모듈(`import`/`require`)이 이미 원격에 있거나 같은 커밋에 포함되어 있는지 확인한다. 분리 커밋 시 특히 주의 — 로컬엔 있어도 원격엔 없는 파일을 import하면 Vercel 빌드가 실패한다.
2. **Clean 빌드 검증** — 커밋되지 않은 변경사항을 `git stash --keep-index --include-untracked`로 숨긴 뒤 `npm run build`를 실행해 원격과 동일한 상태에서 빌드가 성공하는지 확인한다. 성공 후 `git stash pop`으로 복원.
3. **플랫폼 가드 검증** — `npm run test:platform`으로 네이티브 마운트 스모크 + 웹 전용 globals 가드 사전 검증. 웹 E2E만으론 RN/Hermes 분기 누락을 못 잡는다.
4. **E2E 테스트 통과 확인** — `npm run test:e2e`로 전체 시나리오 통과 확인.

로컬 빌드/테스트가 통과해도 **커밋 범위에서 제외된 파일이 있으면 원격은 실패한다.** "테스트 통과함 = 배포 성공"이 아님을 반드시 기억할 것.

## 플랫폼 인지(Web + Mobile) — 단일 코드베이스 양쪽 동작

이 프로젝트는 같은 JS를 **웹(`expo export --platform web`)과 네이티브(Android APK / iOS)** 양쪽에 배포한다. 한쪽에서만 통과해도 다른 쪽은 깨질 수 있다.

### 절대 금지 — 플랫폼 가드 없이 다음을 직접 사용 금지

- `window.location`, `window.document`, `document.*`, `localStorage`, `sessionStorage`
- `navigator.userAgent`, `fetch`의 웹 전용 옵션, `URL`/`URLSearchParams`(폴리필 의존)
- DOM 이벤트(`addEventListener`, `MouseEvent`, ...)

이유: RN/Hermes에서 `window`는 정의돼 있지만 `window.location`은 없다. `typeof window === 'undefined'` 체크는 **웹과 네이티브 모두 통과**하므로 가드로 충분하지 않다. 반드시 다음 중 하나를 사용:

```ts
import { Platform } from 'react-native';
if (Platform.OS !== 'web') return null;          // 네이티브 즉시 반환
// 웹 분기
if (typeof window !== 'undefined' && window.location) {
  window.location.reload();
}
```

### 검증 — 웹 E2E만으론 부족

`npm run test:e2e`는 **웹 번들에서만** 검증한다. 네이티브 분기 누락은 다음으로 잡는다:

1. **`npm run test:platform`** (필수, 빠름) — 두 단계 검증:
   - `scripts/check-platform-guards.sh` — `window.location` / `document.*` / `localStorage` 등 웹 전용 globals이 `Platform.OS` 가드 없이 사용되는지 grep 검증
   - `__tests__/App.platform.test.tsx` — App을 `Platform.OS = 'ios'/'android'/'web'` 각각에서 마운트해 throw 여부 확인 (jest-expo)
2. 큰 네이티브 변경 시 추가로 — 최소 1회 `npm run android`/`npm run ios` 또는 EAS preview 빌드(APK)로 실 디바이스 첫 화면 진입 확인.

### EAS Build 시 주의

- `eas-cli`를 **devDependency로 설치 금지** — `@expo/config-plugins`가 SDK 호환 버전(~v8) 대신 v55를 끌어와 prebuild가 깨진 네이티브 코드를 생성, 앱 시작과 동시에 크래시함. 항상 `npx --package=eas-cli@latest -- eas <cmd>` 형태로 호출(npx 캐시).
- `EXPO_PUBLIC_*` 환경변수는 빌드 시 인라인되므로 EAS env에 등록 필요(`eas env:create --environment production`).
- Supabase 마이그레이션 파일을 추가했으면 **EAS 빌드 전 서버 적용 필수** — 새 RPC가 없으면 native 앱이 catch 분기로 떨어져 동작 이상.

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
