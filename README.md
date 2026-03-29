# 🐱 CatCare

고양이 돌봄 루틴 관리 앱 · Expo + Supabase

---

## 프로젝트 구조

```
catcare/
├── App.tsx                          # 앱 진입점
├── app.json                         # Expo 설정
├── web/index.html                   # Expo 웹 빌드 템플릿 (GA4 스크립트 포함)
├── vercel.json                      # Vercel 배포 설정
└── src/
    ├── types/index.ts               # 전체 타입 정의
    ├── services/
    │   ├── supabase.ts              # Supabase 클라이언트 초기화
    │   ├── dbService.ts             # DB CRUD + Realtime 구독 + Storage
    │   ├── authService.ts           # 인증 (이메일 + 익명)
    │   ├── analyticsService.ts      # GA4 이벤트 로깅
    │   ├── exportService.ts         # PDF/CSV 내보내기
    │   └── notificationService.ts   # 푸시 알림
    ├── store/useStore.ts            # Zustand 전역 상태
    ├── utils/
    │   ├── theme.ts                 # 디자인 토큰
    │   └── date.ts                  # 날짜 유틸
    ├── components/ui.tsx            # 공통 UI 컴포넌트
    ├── screens/
    │   ├── AuthScreen.tsx           # 로그인/회원가입
    │   ├── HomeScreen.tsx           # 체크리스트 홈
    │   ├── CatsScreen.tsx           # 고양이 + 루틴 관리
    │   ├── CatDetailScreen.tsx      # 고양이 상세
    │   ├── RecordsScreen.tsx        # 기록 타임라인
    │   ├── LogDetailScreen.tsx      # 날짜별 상세 로그
    │   ├── ShareScreen.tsx          # 펫시터 공유 링크 뷰
    │   └── SettingsScreen.tsx       # 설정
    └── navigation/AppNavigator.tsx  # 네비게이션 + 실시간 구독
```

---

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일 생성:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Supabase Console → **Project Settings → API** 에서 URL과 anon key 확인.

### 3. Supabase 설정

**SQL Editor**에서 테이블 생성:

```sql
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  member_ids uuid[] not null default '{}',
  share_token text,
  share_token_expiry timestamptz,
  created_at timestamptz default now()
);

create table users (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  photo_url text,
  household_id uuid references households(id),
  role text not null default 'owner' check (role in ('owner', 'sitter', 'member'))
);

create table cats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null,
  breed text,
  birth_date text,
  weight numeric,
  photo_uri text,
  owner_id uuid not null,
  household_id uuid not null references households(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  time text not null check (time in ('am', 'pm', 'all')),
  cat_ids uuid[] not null default '{}',
  active boolean not null default true,
  household_id uuid not null references households(id) on delete cascade,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table check_records (
  id text primary key,
  date text not null,
  recipe_id uuid not null,
  cat_id uuid not null,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid,
  memo text,
  household_id uuid not null references households(id) on delete cascade
);

create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  cat_id uuid,
  text text not null,
  photo_uri text,
  household_id uuid not null references households(id) on delete cascade,
  author_id uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Authentication 설정:**
- Authentication → Providers → **Email** 활성화
- Authentication → Providers → **Anonymous** 활성화

**Realtime 활성화:**
- Database → Replication → `cats`, `recipes`, `check_records`, `daily_logs` 토글 ON

**Storage 버킷:**
- Storage → New bucket → 이름: `photos`, Public: ON

### 4. 앱 실행
```bash
npm run web      # 웹 개발 서버
npm run start    # Expo Go (모바일)
npm run ios      # iOS 시뮬레이터
npm run android  # Android 에뮬레이터
```

---

## 배포 (Vercel)

`vercel.json`이 자동으로 `expo export --platform web`을 실행합니다.

Vercel → Settings → Environment Variables에 `.env.local`과 동일한 값 등록 후 Redeploy.

---

## 핵심 설계 노트

### 체크 기록 자동 초기화
`CheckRecord`의 PK는 `${date}_${recipeId}_${catId}` 복합 키.
날짜가 바뀌면 새 키가 생성되므로 별도 초기화 로직 없이 자동으로 당일 기준으로 동작.

### 공유 링크 (펫시터 뷰)
- 공유 토큰 만료 기간: 7일
- 재생성 시 기존 토큰 즉시 무효화
- 익명 로그인으로 체크 행위자 기록 (`done_by`)

### IoT 연동 준비
`dbService.ts`의 `upsertCheck`를 외부 기기 웹훅에서 호출하는 구조로 확장 가능.
예정 기기: PETKIT Purobot, Petlibro RFID Feeder, Petcube Bites 2
