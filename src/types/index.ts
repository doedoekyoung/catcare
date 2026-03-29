// src/types/index.ts

export type TimeSlot = 'am' | 'pm' | 'all';

export interface Cat {
  id: string;
  name: string;
  emoji: string;
  breed?: string;
  birthDate?: string;         // ISO date string
  weight?: number;            // kg
  photoUri?: string;
  ownerId: string;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  time: TimeSlot;
  catIds: string[];           // REQ-M05: cat-recipe connection
  active: boolean;            // REQ-V5-02: activate/deactivate
  householdId: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckRecord {
  id: string;
  date: string;               // 'YYYY-MM-DD'
  recipeId: string;
  catId: string;
  done: boolean;
  doneAt?: string;            // ISO timestamp
  doneBy?: string;            // userId
  memo?: string;              // REQ-V4-03: per-item memo
  householdId: string;
}

export interface DailyLog {
  id: string;
  date: string;               // 'YYYY-MM-DD'
  catId?: string;             // optional: per-cat log
  text: string;               // REQ-V4-01
  photoUri?: string;          // REQ-V4-04
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
  shareToken?: string;        // REQ-V1-04: share link token
  shareTokenExpiry?: string;  // ISO timestamp
  createdAt: string;
}

// ── Navigation Types ──────────────────────────────────────────────────────────
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

// ── Store Types ───────────────────────────────────────────────────────────────
export interface AppState {
  user: User | null;
  household: Household | null;
  cats: Cat[];
  recipes: Recipe[];
  checks: Record<string, CheckRecord>;   // key: `${date}_${recipeId}_${catId}`
  logs: DailyLog[];
  selectedCatIds: string[];
  isLoading: boolean;
  isOnboarded: boolean;

  // Actions
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
