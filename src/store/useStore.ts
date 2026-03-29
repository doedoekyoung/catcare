// src/store/useStore.ts

import { create } from 'zustand';
import type { AppState, Cat, Recipe, CheckRecord, DailyLog, Household, User } from '../types';

export const useStore = create<AppState>((set, get) => ({
  user: null,
  household: null,
  cats: [],
  recipes: [],
  checks: {},
  logs: [],
  selectedCatIds: [],
  isLoading: false,
  isOnboarded: false,

  setUser: (user) => set({ user }),
  setHousehold: (household) => set({ household }),
  setCats: (cats) => {
    set({ cats });
    // Ensure selectedCatIds are still valid
    const valid = get().selectedCatIds.filter((id) =>
      cats.some((c) => c.id === id)
    );
    if (valid.length === 0 && cats.length > 0) {
      set({ selectedCatIds: [cats[0].id] });
    } else {
      set({ selectedCatIds: valid });
    }
  },
  setRecipes: (recipes) => set({ recipes }),
  setChecks: (checks) => set({ checks }),
  setLogs: (logs) => set({ logs }),
  setSelectedCatIds: (ids) => set({ selectedCatIds: ids }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsOnboarded: (isOnboarded) => set({ isOnboarded }),

  toggleCatSelection: (catId) => {
    const current = get().selectedCatIds;
    if (current.includes(catId)) {
      // Keep at least 1 selected
      if (current.length === 1) return;
      set({ selectedCatIds: current.filter((id) => id !== catId) });
    } else {
      set({ selectedCatIds: [...current, catId] });
    }
  },

  toggleCheck: (key, value) => {
    const checks = { ...get().checks };
    checks[key] = { ...(checks[key] ?? {}), ...value } as CheckRecord;
    set({ checks });
  },
}));

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectActiveRecipesForCats = (
  recipes: Recipe[],
  catIds: string[]
): Recipe[] =>
  catIds.length === 0
    ? []
    : recipes.filter(
        (r) => r.active && r.catIds.some((cid) => catIds.includes(cid))
      );

export const selectChecksForDate = (
  checks: Record<string, CheckRecord>,
  date: string
): Record<string, CheckRecord> => {
  const result: Record<string, CheckRecord> = {};
  Object.entries(checks).forEach(([k, v]) => {
    if (v.date === date) result[k] = v;
  });
  return result;
};

export const selectCompletionRate = (
  recipes: Recipe[],
  checks: Record<string, CheckRecord>,
  date: string,
  catIds: string[]
): { done: number; total: number; pct: number } => {
  const active = selectActiveRecipesForCats(recipes, catIds);
  let total = 0;
  let done = 0;
  active.forEach((r) => {
    const catId = r.catIds.find((id) => catIds.includes(id)) ?? r.catIds[0];
    r.times.forEach((t) => {
      total++;
      if (checks[`${date}_${r.id}_${catId}_${t}`]?.done) done++;
    });
  });
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
};

// Weekly completion data for chart (REQ-V5-03)
export const selectWeeklyStats = (
  recipes: Recipe[],
  checks: Record<string, CheckRecord>,
  cats: Cat[]
): { date: string; pct: number }[] => {
  const result: { date: string; pct: number }[] = [];
  const catIds = cats.map((c) => c.id);
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0');
    const { pct } = selectCompletionRate(recipes, checks, dateStr, catIds);
    result.push({ date: dateStr.slice(5), pct });
  }
  return result;
};
