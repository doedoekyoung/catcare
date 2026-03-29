// src/types/index.ts

export type TimeSlot = 'morning' | 'lunch' | 'evening';

export interface Cat {
  id: string;
  name: string;
  emoji?: string;              // deprecated — photoUri 우선
  photoUri?: string;
  gender?: 'male' | 'female' | 'neutered';
  tagColor?: string;           // 홈 탭 & 루틴 카드 색상
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  metDate?: string;            // 만난 날 (ISO date)
  notes?: string;              // 특이사항 자유 기재
  breed?: string;
  weight?: number;
  ownerId: string;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  times: TimeSlot[];           // 복수 시간대 선택
  catIds: string[];
  active: boolean;
  householdId: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckRecord {
  id: string;
  date: string;
  recipeId: string;
  catId: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
  memo?: string;
  householdId: string;
}

export interface DailyLog {
  id: string;
  date: string;
  catId?: string;
  text: string;
  photoUri?: string;
  householdId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  householdId?: string;
  role: 'owner' | 'sitter' | 'member';
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  shareToken?: string;
  shareTokenExpiry?: string;
  createdAt: string;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  CatDetail: { catId: string };
  RecipeForm: { catId?: string; recipeId?: string };
  LogDetail: { date: string };
  ShareLink: { token: string };
};

export type MainTabParamList = {
  Home: undefined;
  Cats: undefined;
  Records: undefined;
  Settings: undefined;
};

export interface AppState {
  user: User | null;
  household: Household | null;
  cats: Cat[];
  recipes: Recipe[];
  checks: Record<string, CheckRecord>;
  logs: DailyLog[];
  selectedCatIds: string[];
  isLoading: boolean;
  isOnboarded: boolean;

  setUser: (user: User | null) => void;
  setHousehold: (h: Household | null) => void;
  setCats: (cats: Cat[]) => void;
  setRecipes: (recipes: Recipe[]) => void;
  setChecks: (checks: Record<string, CheckRecord>) => void;
  setLogs: (logs: DailyLog[]) => void;
  setSelectedCatIds: (ids: string[]) => void;
  setIsLoading: (v: boolean) => void;
  setIsOnboarded: (v: boolean) => void;
  toggleCatSelection: (catId: string) => void;
  toggleCheck: (key: string, value: Partial<CheckRecord>) => void;
}
