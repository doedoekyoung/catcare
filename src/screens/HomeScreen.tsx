// src/screens/HomeScreen.tsx

import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { upsertCheck, getChecksForDateRange } from '../services/dbService';
import { TodayView } from '../components/TodayView';
import { toDateKey, getLast30Days } from '../utils/date';
import { isScheduledOn } from '../utils/schedule';
import type { CheckRecord, Recipe, TimeSlot } from '../types';

export default function HomeScreen() {
  const {
    cats, recipes, checks, selectedCatIds, user, household,
    setSelectedCatIds, toggleCheck,
  } = useStore();

  const selectCat = (catId: string | null) => {
    setSelectedCatIds(catId ? [catId] : cats.map((c) => c.id));
  };

  // 7일 완료율 계산용
  const [historyChecks, setHistoryChecks] = useState<CheckRecord[]>([]);
  useEffect(() => {
    if (!household?.id) return;
    const days = getLast30Days();
    getChecksForDateRange(household.id, days[days.length - 7], days[days.length - 1])
      .then(setHistoryChecks).catch(() => {});
  }, [household?.id]);

  const getCatRate = useCallback((catId: string): number => {
    const catRecipes = recipes.filter((r) => r.active && r.catIds.includes(catId));
    let total = 0; let done = 0;
    const days = getLast30Days().slice(-7);
    days.forEach((date) => {
      catRecipes.forEach((r) => {
        if (!isScheduledOn(r, date)) return;
        r.times.forEach((t) => {
          total++;
          if (historyChecks.some((c) => c.id === `${date}_${r.id}_${catId}_${t}` && c.done)) done++;
        });
      });
    });
    return total === 0 ? 100 : Math.round((done / total) * 100);
  }, [recipes, historyChecks]);

  const today = toDateKey();

  const handleToggleCheck = useCallback(
    async (recipe: Recipe, catId: string, timeSlot: TimeSlot) => {
      if (!household || !user) return;
      const key = `${today}_${recipe.id}_${catId}_${timeSlot}`;
      const current = checks[key];
      const newDone = !(current?.done ?? false);
      const record: CheckRecord = {
        id: key, date: today, recipeId: recipe.id, catId,
        done: newDone,
        doneAt: newDone ? new Date().toISOString() : undefined,
        doneBy: user.uid,
        householdId: household.id,
        memo: current?.memo,
      };
      toggleCheck(key, record);
      await upsertCheck(household.id, record);
    },
    [checks, household, user, today, toggleCheck]
  );

  return (
    <TodayView
      date={today}
      cats={cats}
      recipes={recipes}
      checks={checks}
      selectedCatIds={selectedCatIds}
      onSelectCat={selectCat}
      onToggle={handleToggleCheck}
      getCatRate={getCatRate}
      testIDPrefix="home-check"
    />
  );
}
