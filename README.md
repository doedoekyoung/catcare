# 🐱 CatCare — React Native + Firebase

고양이 돌봄 루틴 관리 앱 · MVP~V5 전체 구현체

---

## 📁 프로젝트 구조

```
catcare/
├── App.tsx                          # 앱 진입점
├── app.json                         # Expo 설정
├── babel.config.js
├── tsconfig.json
├── firestore.rules                  # Firebase 보안 규칙
├── package.json
└── src/
    ├── types/index.ts               # 전체 타입 정의
    ├── services/
    │   ├── firebase.ts              # Firebase 초기화
    │   ├── firestoreService.ts      # Firestore CRUD + 실시간 구독
    │   ├── authService.ts           # 인증 (이메일 + 익명)
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
    │   ├── CatDetailScreen.tsx      # 고양이 상세 + 차트
    │   ├── RecordsScreen.tsx        # 기록 타임라인
    │   ├── LogDetailScreen.tsx      # 날짜별 상세 로그
    │   ├── ShareScreen.tsx          # 펫시터 공유 링크 뷰
    │   └── SettingsScreen.tsx       # 설정
    └── navigation/AppNavigator.tsx  # 내비게이션 + 실시간 구독
```

---

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com) → 새 프로젝트 생성
2. **Authentication** → 이메일/비밀번호 및 익명 로그인 활성화
3. **Firestore Database** 생성 (프로덕션 모드)
4. **Storage** 활성화
5. `src/services/firebase.ts`의 `firebaseConfig` 값을 실제 값으로 교체:

```ts
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

### 3. Firestore 보안 규칙 등록
Firebase Console → Firestore → Rules 탭에 `firestore.rules` 내용을 붙여넣고 게시

### 4. 앱 실행
```bash
# Expo Go로 빠른 미리보기
npx expo start

# iOS 시뮬레이터
npx expo start --ios

# Android 에뮬레이터
npx expo start --android
```

---

## ✅ 기획서 요구사항 구현 현황

### MVP (REQ-M01 ~ M10)
| ID | 기능 | 상태 | 구현 위치 |
|----|------|------|----------|
| M01 | 고양이 등록 | ✅ | CatsScreen |
| M02 | 다묘 등록 | ✅ | CatsScreen |
| M03 | 고양이 선택 | ✅ | HomeScreen chips |
| M04 | 레시피 등록 | ✅ | CatsScreen |
| M05 | 고양이-레시피 연결 | ✅ | firestoreService |
| M06 | 체크리스트 조회 | ✅ | HomeScreen |
| M07 | 체크 완료 처리 | ✅ | HomeScreen + firestoreService |
| M08 | 기록 저장 | ✅ | Firestore + 오프라인 지속성 |
| M09 | 데일리 로그 | ✅ | HomeScreen 로그 모달 |
| M10 | 기록 보기 | ✅ | RecordsScreen |

### V1 ~ V5
| 단계 | REQ | 기능 | 구현 위치 |
|------|-----|------|----------|
| V1 | V1-01 | 다묘 동시 선택 | HomeScreen |
| V1 | V1-02 | 고양이별 기록 필터 | RecordsScreen |
| V1 | V1-03 | 공유 구조 기반 | Firestore household 모델 |
| V1 | V1-04 | 비회원 공유 링크 | ShareScreen + 익명 인증 |
| V1 | V1-05 | 카카오톡 공유 | SettingsScreen Share API |
| V2 | V2-01 | 레시피 중복 입력 | CatsScreen |
| V2 | V2-02 | 등록 순서 유지 | Firestore createdAt 정렬 |
| V2 | V2-03 | 오전/오후 구분 | CatsScreen 시간대 선택 |
| V2 | V2-04 | 시간대별 분류 보기 | HomeScreen 섹션 |
| V2 | V2-05 | 전체 일과 보기 | HomeScreen 다묘 통합 |
| V3 | V3-01 | 체크 상태 하루 유지 | Firestore date key |
| V3 | V3-02 | 체크리스트 자동 생성 | active recipe 기반 |
| V3 | V3-05 | 미완료 알림 | notificationService |
| V4 | V4-01 | 특이사항 기록 | HomeScreen 로그 |
| V4 | V4-02 | 특이사항 조회 | RecordsScreen |
| V4 | V4-03 | 항목별 메모 | LogDetailScreen |
| V4 | V4-04 | 이미지 첨부 | LogDetailScreen + Storage |
| V4 | V4-05 | 통합 타임라인 | LogDetailScreen |
| V5 | V5-01 | 고양이 프로필 CRUD | CatsScreen + CatDetailScreen |
| V5 | V5-02 | 레시피 활성/비활성 | CatsScreen 토글 |
| V5 | V5-03 | 완료율 차트 | RecordsScreen + CatDetailScreen |
| V5 | V5-04 | 루틴 현황 요약 | CatDetailScreen |
| V5 | V5-05 | PDF/CSV 내보내기 | exportService |
| V5 | V5-06 | IoT API 훅 | firestoreService 웹훅 구조 |

---

## 🔔 알림 설정 (REQ-V3-05)

앱 최초 실행 시 알림 권한을 요청합니다.
설정 화면에서 알림 시각을 사용자가 지정할 수 있도록 추후 확장 가능.

기본값: 매일 오후 9:00에 미완료 항목이 있을 경우 알림

---

## 📡 IoT 연동 준비 (REQ-V5-06)

`firestoreService.ts`의 웹훅 구조를 통해 외부 기기 데이터를 수신할 수 있습니다.

**중기 연동 예정 제품:**
- PETKIT Purobot Max Pro 2 (화장실 방문 자동 체크)
- Petlibro One RFID Feeder (다묘 급여 자동 기록)
- Petcube Bites 2 (외출 중 케어 로그)

---

## 🛠 개발 노트

### 오프라인 지원
`firebase.ts`에서 `enableIndexedDbPersistence` 활성화로 오프라인에서도 읽기/쓰기 가능.
온라인 복구 시 자동 동기화.

### 자정 초기화 (REQ-V3-01)
체크 기록은 `YYYY-MM-DD_recipeId_catId` 복합 키로 저장.
날짜가 바뀌면 새 키가 생성되므로 자동으로 초기화됨.

### 공유 링크 보안
- 링크 만료 기간: 기본 7일 (REQ 개발 노트 준수)
- 재생성 시 기존 토큰 즉시 무효화
- 익명 인증으로 체크 행위자 기록

---

문의: anndk0127@gmail.com
