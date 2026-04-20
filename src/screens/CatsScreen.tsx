// src/screens/CatsScreen.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, Platform, Switch,
} from 'react-native';

// Alert.alert은 웹에서 동작하지 않으므로 플랫폼별 분기
function webAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function webConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = '삭제',
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/useStore';
import {
  addCat as fsAddCat, updateCat, deleteCat as fsDeleteCat,
  addRecipe as fsAddRecipe, updateRecipe, deleteRecipe as fsDeleteRecipe,
  getChecksForDateRange,
} from '../services/dbService';
import { Button, Input, BottomSheet, EmptyState } from '../components/ui';
import { colors, spacing, radius, shadow, CAT_TAG_COLORS } from '../utils/theme';
import { toDateKey } from '../utils/date';
import type { Cat, Recipe, TimeSlot, CheckRecord } from '../types';

const GENDER_OPTIONS = [
  { value: 'male' as const, label: '남아' },
  { value: 'female' as const, label: '여아' },
];

const TIME_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'morning', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'evening', label: '저녁' },
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function daysLabel(days: number[]): string {
  if (!days || days.length === 0 || days.length === 7) return '매일';
  return '매주 ' + [...days].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join('·');
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_VALUES  = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);
const MONTH_VALUES = Array.from({ length: 12 }, (_, i) => i + 1);
const DAY_VALUES   = Array.from({ length: 31 }, (_, i) => i + 1);
// 네이티브 스크롤 피커용 (0 = 미선택)
const YEARS  = [0, ...YEAR_VALUES];
const MONTHS = [0, ...MONTH_VALUES];
const DAYS   = [0, ...DAY_VALUES];

const ITEM_H   = 44;
const PICKER_H = ITEM_H * 5;

function ScrollPicker({
  values, selected, onSelect, renderLabel, color,
}: {
  values: number[];
  selected: number | null;
  onSelect: (v: number | null) => void;
  renderLabel: (v: number) => string;
  color: string;
}) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    const val = selected ?? 0;
    const idx = values.indexOf(val);
    if (idx >= 0) {
      setTimeout(() => ref.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 80);
    }
  }, []);

  return (
    <View style={{ flex: 1, height: PICKER_H }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: ITEM_H * 2, height: ITEM_H, width: '100%',
          backgroundColor: color + '18', borderRadius: 8,
          borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: color + '70',
        }}
      />
      <ScrollView
        ref={ref}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const i = Math.max(0, Math.min(idx, values.length - 1));
          const v = values[i];
          onSelect(v === 0 ? null : v);
        }}
      >
        {values.map((v) => {
          const isSel = v === (selected ?? 0);
          return (
            <TouchableOpacity
              key={v}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => {
                const i = values.indexOf(v);
                ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
                onSelect(v === 0 ? null : v);
              }}
            >
              <Text style={[
                { fontSize: 15, color: v === 0 ? colors.border : colors.muted },
                isSel && v !== 0 && { fontSize: 17, fontWeight: '700', color },
              ]}>
                {renderLabel(v)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// 웹: <select> 드롭다운 / 네이티브: 스크롤 피커
function DateDropdown({
  values, nativeValues, selected, onSelect, renderLabel, placeholder, color, disabled,
}: {
  values: number[];           // 웹 옵션 목록 (0 제외)
  nativeValues: number[];     // 네이티브 스크롤 피커용 (0 포함)
  selected: number | null;
  onSelect: (v: number | null) => void;
  renderLabel: (v: number) => string;
  placeholder: string;
  color: string;
  disabled?: boolean;
}) {
  if (Platform.OS === 'web') {
    const Sel = 'select' as any;
    return (
      <Sel
        value={selected ?? ''}
        disabled={disabled}
        onChange={(e: any) => {
          const v = Number(e.target.value);
          onSelect(v || null);
        }}
        style={{
          width: '100%',
          height: 44,
          border: `1.5px solid ${selected ? color : '#DDD0C4'}`,
          borderRadius: 8,
          backgroundColor: disabled ? '#EEEBE8' : '#FAF6F0',
          fontSize: 14,
          color: selected ? color : '#8C7B70',
          paddingLeft: 10,
          paddingRight: 4,
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'inherit',
          appearance: 'auto',
        }}
      >
        <option value="">{placeholder}</option>
        {values.map((v) => (
          <option key={v} value={v}>{renderLabel(v)}</option>
        ))}
      </Sel>
    );
  }

  // 네이티브: 기존 스크롤 피커
  return (
    <View style={[styles.pickerContainer, disabled && styles.pickerDisabled]}>
      <ScrollPicker
        values={nativeValues}
        selected={selected}
        onSelect={(v) => { if (!disabled) onSelect(v); }}
        renderLabel={(v) => v === 0 ? '-' : renderLabel(v)}
        color={color}
      />
    </View>
  );
}

function getLast7Days(): string[] {
  const result: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(toDateKey(d));
  }
  return result;
}

function getCheckStatus(
  recipe: Recipe,
  date: string,
  allChecks: CheckRecord[],
): '✓' | '✗' | '—' {
  const d = new Date(date + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const scheduled = recipe.days.length === 0 || recipe.days.includes(dayOfWeek);
  if (!scheduled) return '—';
  const done = allChecks.some(
    (c) => c.date === date && c.recipeId === recipe.id && c.done
  );
  return done ? '✓' : '✗';
}

export default function CatsScreen() {
  const { cats, recipes, household, user, setCats, setRecipes } = useStore();

  // ── 7-day history state ───────────────────────────────────────────────────────
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [historyChecks, setHistoryChecks] = useState<CheckRecord[]>([]);

  useEffect(() => {
    if (!household?.id) return;
    const last7 = getLast7Days();
    getChecksForDateRange(household.id, last7[0], last7[6])
      .then(setHistoryChecks)
      .catch(() => {});
  }, [household?.id]);

  const handleToggleExpand = (catId: string) => {
    setExpandedCatId((prev) => (prev === catId ? null : catId));
  };

  const getCompletionRate = useCallback((cat: Cat): number => {
    const catRecipes = recipes.filter((r) => r.active && r.catIds.includes(cat.id));
    const last7 = getLast7Days();
    let total = 0; let done = 0;
    last7.forEach((date) => {
      const d = new Date(date + 'T00:00:00').getDay();
      catRecipes.forEach((r) => {
        const scheduled = (r.days ?? []).length === 0 || (r.days ?? []).includes(d);
        if (!scheduled) return;
        r.times.forEach(() => { total++; });
        r.times.forEach((t) => {
          if (historyChecks.some((c) => c.date === date && c.recipeId === r.id && c.catId === cat.id && c.done && (c as any).timeSlot === t || historyChecks.some((c) => c.id === `${date}_${r.id}_${cat.id}_${t}` && c.done))) done++;
        });
      });
    });
    return total === 0 ? 100 : Math.round((done / total) * 100);
  }, [recipes, historyChecks]);

  // ── Cat modal state ───────────────────────────────────────────────────────────
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  const [catName, setCatName] = useState('');
  const [catPhotoUri, setCatPhotoUri] = useState('');
  const [catGender, setCatGender] = useState<'male' | 'female' | ''>('');
  const [catTagColor, setCatTagColor] = useState<string>(CAT_TAG_COLORS[0]);
  const [catBirthYear, setCatBirthYear] = useState<number | null>(null);
  const [catBirthMonth, setCatBirthMonth] = useState<number | null>(null);
  const [catBirthDay, setCatBirthDay] = useState<number | null>(null);
  const [catNotes, setCatNotes] = useState('');

  // ── Recipe modal state ────────────────────────────────────────────────────────
  const [recipeModal, setRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [targetCatId, setTargetCatId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [recipeTimes, setRecipeTimes] = useState<TimeSlot[]>(['morning']);
  const [recipeDays, setRecipeDays] = useState<number[]>([]); // 빈 배열 = 매일
  const [recipeSharedCatIds, setRecipeSharedCatIds] = useState<string[]>([]);

  // ── Image picker ──────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setCatPhotoUri(result.assets[0].uri);
  };

  // ── Cat CRUD ──────────────────────────────────────────────────────────────────

  const openAddCat = () => {
    setEditingCat(null);
    setCatName(''); setCatPhotoUri(''); setCatGender('');
    setCatTagColor(CAT_TAG_COLORS[0]);
    setCatBirthYear(null); setCatBirthMonth(null); setCatBirthDay(null);
    setCatNotes('');
    setCatModal(true);
  };

  const openEditCat = (cat: Cat) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatPhotoUri(cat.photoUri ?? '');
    setCatGender(cat.gender === 'male' ? 'male' : cat.gender === 'female' ? 'female' : '');
    setCatTagColor(cat.tagColor ?? CAT_TAG_COLORS[0]);
    setCatBirthYear(cat.birthYear ?? null);
    setCatBirthMonth(cat.birthMonth ?? null);
    setCatBirthDay(cat.birthDay ?? null);
    setCatNotes(cat.notes ?? '');
    setCatModal(true);
  };

  const handleSaveCat = async () => {
    if (!catName.trim() || !household || !user) return;
    const catData: Partial<Cat> = {
      name: catName.trim(),
      photoUri: catPhotoUri || undefined,
      gender: catGender || undefined,  // 중성화는 별도 저장 없이 UI 표기만
      tagColor: catTagColor,
      birthYear: catBirthYear ?? undefined,
      birthMonth: catBirthMonth ?? undefined,
      birthDay: catBirthDay ?? undefined,
      notes: catNotes || undefined,
    };
    try {
      if (editingCat) {
        await updateCat(household.id, editingCat.id, catData);
        setCats(cats.map((c) => c.id === editingCat.id ? { ...c, ...catData } : c));
      } else {
        const cat = await fsAddCat(household.id, {
          ...catData,
          name: catName.trim(),
          ownerId: user.uid,
          householdId: household.id,
        } as Omit<Cat, 'id' | 'createdAt' | 'updatedAt'>);
        setCats([...cats, cat]);
      }
      setCatModal(false);
    } catch (e: any) {
      webAlert('오류', `고양이 저장에 실패했습니다.\n${e?.message ?? ''}`);
    }
  };

  const handleDeleteCat = (cat: Cat) => {
    webConfirm(
      `${cat.name} 삭제`,
      '이 고양이와 연결된 루틴도 모두 삭제됩니다. 계속할까요?',
      async () => {
        if (!household) return;
        try {
          const linked = recipes.filter((r) => r.catIds.includes(cat.id));
          await Promise.all(linked.map((r) => fsDeleteRecipe(household.id, r.id)));
          await fsDeleteCat(household.id, cat.id);
          setCats(cats.filter((c) => c.id !== cat.id));
          setRecipes(recipes.filter((r) => !r.catIds.includes(cat.id)));
        } catch (e: any) {
          webAlert('삭제 실패', e?.message ?? '다시 시도해주세요.');
        }
      },
    );
  };

  // ── Recipe CRUD ───────────────────────────────────────────────────────────────

  const openAddRecipe = (catId: string) => {
    setEditingRecipe(null);
    setTargetCatId(catId);
    setRecipeName('');
    setRecipeTimes(['morning']);
    setRecipeDays([]);
    setRecipeSharedCatIds([catId]);
    setRecipeModal(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setTargetCatId(recipe.catIds[0]);
    setRecipeName(recipe.name);
    setRecipeTimes(recipe.times);
    setRecipeDays(recipe.days ?? []);
    setRecipeSharedCatIds(recipe.catIds);
    setRecipeModal(true);
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim() || !household || recipeTimes.length === 0) return;
    const catIds = recipeSharedCatIds.length > 0 ? recipeSharedCatIds : [targetCatId];
    const days = recipeDays.length === 7 ? [] : recipeDays; // 전체 선택 = 빈 배열(매일)
    try {
      if (editingRecipe) {
        await updateRecipe(household.id, editingRecipe.id, {
          name: recipeName.trim(), times: recipeTimes, days, catIds,
        });
        setRecipes(recipes.map((r) =>
          r.id === editingRecipe.id
            ? { ...r, name: recipeName.trim(), times: recipeTimes, days, catIds }
            : r
        ));
      } else {
        const recipe = await fsAddRecipe(household.id, {
          name: recipeName.trim(), times: recipeTimes, days, catIds,
          active: true, householdId: household.id,
        });
        setRecipes([...recipes, recipe]);
      }
      setRecipeModal(false);
    } catch (e: any) {
      webAlert('오류', `루틴 저장에 실패했습니다.\n${e?.message ?? ''}`);
    }
  };

  const handleDeleteRecipe = (recipe: Recipe) => {
    webConfirm(
      '루틴 삭제',
      `"${recipe.name}"을 삭제할까요?`,
      async () => {
        if (!household) return;
        try {
          await fsDeleteRecipe(household.id, recipe.id);
          setRecipes(recipes.filter((r) => r.id !== recipe.id));
        } catch (e: any) {
          webAlert('삭제 실패', e?.message ?? '다시 시도해주세요.');
        }
      },
    );
  };

  const handleToggleActive = async (recipe: Recipe) => {
    if (!household) return;
    await updateRecipe(household.id, recipe.id, { active: !recipe.active });
    setRecipes(recipes.map((r) => r.id === recipe.id ? { ...r, active: !r.active } : r));
  };

  const toggleRecipeTime = (t: TimeSlot) => {
    setRecipeTimes((prev) =>
      prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]
    );
  };

  // 개별 요일 토글 — "매일" 상태(length===0)에서 개별 요일을 누르면 해당 요일만 선택된 상태로 전환
  const toggleRecipeDay = (d: number) => {
    setRecipeDays((prev) => {
      if (prev.length === 0) return [d];
      const next = prev.includes(d) ? prev.filter((v) => v !== d) : [...prev, d];
      // 7개 모두 선택되면 "매일"(빈 배열)로 정규화
      return next.length === 7 ? [] : next;
    });
  };

  const setEveryDay = () => setRecipeDays([]);

  const toggleSharedCat = (catId: string) => {
    setRecipeSharedCatIds((prev) =>
      prev.includes(catId)
        ? prev.length > 1 ? prev.filter((id) => id !== catId) : prev
        : [...prev, catId]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>고양이 관리</Text>
        <Button testID="cats-add-button" label="+ 고양이" size="sm" onPress={openAddCat} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cats.length === 0 && (
          <EmptyState
            title="등록된 고양이가 없어요"
            desc="상단 버튼으로 첫 고양이를 등록해보세요"
            action={{ label: '+ 고양이 등록', onPress: openAddCat }}
          />
        )}

        {cats.map((cat) => {
          const catRecipes = recipes
            .filter((r) => r.catIds.includes(cat.id))
            .sort((a, b) => (a.createdAt ?? a.id).localeCompare(b.createdAt ?? b.id));
          const tagColor = cat.tagColor ?? colors.caramel;
          const isExpanded = expandedCatId === cat.id;
          const genderLabel = cat.gender === 'male' ? '남아' : cat.gender === 'female' ? '여아' : '';
          const metaParts = [genderLabel, cat.birthYear ? `${cat.birthYear}년생` : '', `루틴 ${catRecipes.length}개`].filter(Boolean);

          return (
            <View key={cat.id} testID={`cats-card-${cat.id}`} style={[styles.catCard, shadow.sm, isExpanded && { borderColor: tagColor }]}>
              {/* Cat row — tap to expand */}
              <TouchableOpacity testID={`cats-expand-${cat.id}`} style={styles.catRow} onPress={() => handleToggleExpand(cat.id)} activeOpacity={0.75}>
                <View style={[styles.catAvatar, { backgroundColor: tagColor + '20', borderColor: tagColor }]}>
                  {cat.photoUri ? (
                    <Image source={{ uri: cat.photoUri }} style={styles.catAvatarImg} />
                  ) : (
                    <Text style={[styles.catAvatarInitial, { color: tagColor }]}>{cat.name.charAt(0)}</Text>
                  )}
                </View>
                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <View style={[styles.tagDot, { backgroundColor: tagColor }]} />
                  </View>
                  <Text style={styles.catMeta}>{metaParts.join(' · ')}</Text>
                </View>
                <Text style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
                <TouchableOpacity style={styles.iconBtn} onPress={(e) => { e.stopPropagation?.(); openEditCat(cat); }}>
                  <Text style={styles.iconBtnText}>편집</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Expand panel — routines only */}
              {isExpanded && (
                <View style={styles.expandPanel}>
                  <Text style={styles.expandSectionTitle}>루틴</Text>
                  {catRecipes.map((r) => (
                    <View
                      key={r.id}
                      style={[styles.routineItem, { borderLeftColor: tagColor }, !r.active && styles.recipeCardInactive]}
                    >
                      <TouchableOpacity style={styles.recipeInfo} onPress={() => openEditRecipe(r)} activeOpacity={0.75}>
                        <Text style={[styles.recipeName, !r.active && styles.recipeNameInactive]}>{r.name}</Text>
                        <View style={styles.recipeTimeTags}>
                          {r.times.map((t) => (
                            <View key={t} style={[styles.timeTag, { backgroundColor: tagColor + '18', borderColor: tagColor + '50' }]}>
                              <Text style={[styles.timeTagText, { color: tagColor }]}>
                                {t === 'morning' ? '아침' : t === 'lunch' ? '점심' : '저녁'}
                              </Text>
                            </View>
                          ))}
                          <Text style={styles.recipeMeta}>{daysLabel(r.days ?? [])}</Text>
                          {r.catIds.length > 1 && (
                            <Text style={styles.recipeMeta}>공유: {r.catIds.map((id) => cats.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                      <Switch
                        testID={`recipe-toggle-${r.id}`}
                        value={r.active}
                        onValueChange={() => handleToggleActive(r)}
                        thumbColor={r.active ? '#fff' : '#ccc'}
                        trackColor={{ false: colors.border, true: tagColor }}
                      />
                    </View>
                  ))}
                  <TouchableOpacity testID={`cats-add-recipe-${cat.id}`} style={styles.routineAddBtn} onPress={() => openAddRecipe(cat.id)}>
                    <Text style={styles.routineAddText}>+ 루틴 추가</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Add/Edit Cat Modal ── */}
      <BottomSheet
        visible={catModal}
        onClose={() => setCatModal(false)}
        title={editingCat ? '고양이 수정' : '고양이 등록'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 사진 + 태그 컬러 */}
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
              {catPhotoUri ? (
                <Image source={{ uri: catPhotoUri }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: catTagColor + '30' }]}>
                  <Text style={[styles.photoHint, { color: catTagColor }]}>사진 선택</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.colorPickerWrap}>
              <Text style={styles.fieldLabel}>태그 색상</Text>
              <View style={styles.colorRow}>
                {CAT_TAG_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, catTagColor === c && styles.colorDotSel]}
                    onPress={() => setCatTagColor(c)}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* 이름 */}
          <Input
            testID="cat-form-name-input"
            label="이름 *"
            value={catName}
            onChangeText={setCatName}
            placeholder="예: 루나, 모카, 호두"
            maxLength={20}
          />

          {/* 성별 */}
          <Text style={styles.fieldLabel}>성별 *</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              testID="cat-form-gender-male"
              style={[styles.optionChip, catGender === 'male' && styles.optionChipSel]}
              onPress={() => setCatGender('male')}
            >
              <Text style={[styles.optionText, catGender === 'male' && styles.optionTextSel]}>남아</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="cat-form-gender-female"
              style={[styles.optionChip, catGender === 'female' && styles.optionChipSel]}
              onPress={() => setCatGender('female')}
            >
              <Text style={[styles.optionText, catGender === 'female' && styles.optionTextSel]}>여아</Text>
            </TouchableOpacity>
          </View>

          {/* 생년월일 — 드롭다운 (웹) / 스크롤 피커 (네이티브) */}
          <Text style={styles.fieldLabel}>생년월일/만난 날</Text>
          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <DateDropdown
                values={YEAR_VALUES}
                nativeValues={YEARS}
                selected={catBirthYear}
                onSelect={(v) => { setCatBirthYear(v); if (!v) { setCatBirthMonth(null); setCatBirthDay(null); } }}
                renderLabel={(v) => `${v}년`}
                placeholder="년도"
                color={catTagColor}
              />
            </View>
            <View style={styles.pickerCol}>
              <DateDropdown
                values={MONTH_VALUES}
                nativeValues={MONTHS}
                selected={catBirthMonth}
                onSelect={(v) => { setCatBirthMonth(v); if (!v) setCatBirthDay(null); }}
                renderLabel={(v) => `${v}월`}
                placeholder="월"
                color={catTagColor}
                disabled={!catBirthYear}
              />
            </View>
            <View style={styles.pickerCol}>
              <DateDropdown
                values={DAY_VALUES}
                nativeValues={DAYS}
                selected={catBirthDay}
                onSelect={setCatBirthDay}
                renderLabel={(v) => `${v}일`}
                placeholder="일"
                color={catTagColor}
                disabled={!catBirthMonth}
              />
            </View>
          </View>

          {/* 특이사항 */}
          <Input
            label="특이사항 (선택)"
            value={catNotes}
            onChangeText={setCatNotes}
            placeholder="알레르기, 지병, 성격 등 자유롭게 기록"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80 }}
          />

          <View style={[styles.row, { marginTop: spacing.md }]}>
            <Button label="취소" variant="secondary" onPress={() => setCatModal(false)} style={{ flex: 1 }} />
            <Button testID="cat-form-save-button" label={editingCat ? '수정' : '등록'} onPress={handleSaveCat} style={{ flex: 1 }} />
          </View>
          {editingCat && (
            <TouchableOpacity
              testID="cat-form-delete-button"
              style={styles.deleteRecipeBtn}
              onPress={() => { setCatModal(false); setTimeout(() => handleDeleteCat(editingCat), 300); }}
            >
              <Text style={styles.deleteCatBtnText}>정보 삭제</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </BottomSheet>

      {/* ── Add/Edit Recipe Modal ── */}
      <BottomSheet
        visible={recipeModal}
        onClose={() => setRecipeModal(false)}
        title={editingRecipe ? '루틴 수정' : '루틴 항목 등록'}
      >
        <Input
          testID="recipe-form-name-input"
          label="항목명 *"
          value={recipeName}
          onChangeText={setRecipeName}
          placeholder="예: 아침 사료, 약 급여, 화장실 청소"
          maxLength={30}
        />
        <Text style={styles.fieldLabel}>시간대 (복수 선택 가능)</Text>
        <View style={styles.optionRow}>
          {TIME_OPTIONS.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.optionChip, recipeTimes.includes(t.value) && styles.optionChipSel]}
              onPress={() => toggleRecipeTime(t.value)}
            >
              <Text style={[styles.optionText, recipeTimes.includes(t.value) && styles.optionTextSel]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 요일 선택 */}
        <View style={styles.dayLabelRow}>
          <Text style={styles.fieldLabel}>반복 요일</Text>
          <Text style={styles.dayResultText}>{daysLabel(recipeDays)}</Text>
        </View>
        <TouchableOpacity
          testID="recipe-form-everyday"
          style={[styles.everyDayBtn, recipeDays.length === 0 && styles.everyDayBtnSel]}
          onPress={setEveryDay}
          activeOpacity={0.75}
        >
          <Text style={[styles.everyDayText, recipeDays.length === 0 && styles.everyDayTextSel]}>
            매일
          </Text>
        </TouchableOpacity>
        <View style={styles.dayRow}>
          {DAY_NAMES.map((name, idx) => {
            const isEveryDay = recipeDays.length === 0;
            const isPicked = recipeDays.includes(idx);
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dayBtn,
                  isEveryDay && styles.dayBtnAllOn,
                  !isEveryDay && isPicked && styles.dayBtnSel,
                ]}
                onPress={() => toggleRecipeDay(idx)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.dayBtnText,
                    isEveryDay && styles.dayBtnTextAllOn,
                    !isEveryDay && isPicked && styles.dayBtnTextSel,
                  ]}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.fieldLabel}>적용 고양이 * (복수 선택 가능)</Text>
        <View style={styles.optionRow}>
          {cats.map((c) => {
            const selected = recipeSharedCatIds.includes(c.id);
            const color = c.tagColor ?? colors.caramel;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.checkRow,
                  selected && { borderColor: color, backgroundColor: color + '15' },
                ]}
                onPress={() => toggleSharedCat(c.id)}
              >
                <View style={[styles.checkBox, selected && { borderColor: color, backgroundColor: color }]}>
                  {selected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                </View>
                <Text style={[styles.optionText, selected && { color, fontWeight: '600' }]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Button label="취소" variant="secondary" onPress={() => setRecipeModal(false)} style={{ flex: 1 }} />
          <Button testID="recipe-form-save-button" label={editingRecipe ? '수정' : '등록'} onPress={handleSaveRecipe} style={{ flex: 1 }} />
        </View>
        {editingRecipe && (
          <TouchableOpacity
            testID="recipe-form-delete-button"
            style={styles.deleteRecipeBtn}
            onPress={() => {
              setRecipeModal(false);
              setTimeout(() => handleDeleteRecipe(editingRecipe), 300);
            }}
          >
            <Text style={styles.deleteRecipeBtnText}>루틴 삭제</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, height: 56,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  content: { padding: spacing.lg, paddingBottom: 80 },

  // Cat card
  catCard: {
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#fff', marginBottom: 10, overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md,
  },
  catAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, overflow: 'hidden', flexShrink: 0,
  },
  catAvatarImg: { width: 44, height: 44 },
  catAvatarInitial: { fontSize: 18, fontWeight: '700' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontWeight: '600', color: colors.charcoal },
  catMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  completionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full,
  },
  completionDot: { width: 6, height: 6, borderRadius: 3 },
  completionText: { fontSize: 11, fontWeight: '700' },
  expandArrow: { fontSize: 10, color: colors.muted, width: 16, textAlign: 'center' },
  catActions: { flexDirection: 'row', gap: 5 },
  iconBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 11, fontWeight: '600', color: colors.brownMid },

  // Expand panel
  expandPanel: {
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  expandSectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  routineItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border + '60',
    borderLeftWidth: 3, backgroundColor: '#fff',
  },
  routineAddBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: '#fff',
  },
  routineAddText: { fontSize: 13, fontWeight: '600', color: colors.caramel },

  // Recipe card (kept for modal compatibility)
  recipeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#fff', marginBottom: 6,
  },
  recipeInfo: { flex: 1 },
  recipeName: { fontSize: 14, color: colors.charcoal, marginBottom: 4 },
  recipeNameInactive: { textDecorationLine: 'line-through', color: colors.muted },
  recipeTimeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  timeTag: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.full, borderWidth: 1,
  },
  timeTagText: { fontSize: 11 },
  recipeMeta: { fontSize: 11, color: colors.muted },

  // Modal fields
  photoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  photoBox: { width: 90, height: 90 },
  photoPreview: { width: 90, height: 90, borderRadius: radius.md },
  photoPlaceholder: {
    width: 90, height: 90, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
  },
  photoHint: { fontSize: 11, marginTop: 2 },
  colorPickerWrap: { flex: 1 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  colorDot: { width: 26, height: 26, borderRadius: 13 },
  colorDotSel: { borderWidth: 3, borderColor: colors.charcoal },
  fieldLabel: { fontSize: 12, color: colors.muted, marginBottom: 8, marginTop: 4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  optionChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border,
  },
  optionChipSel: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  optionText: { fontSize: 13, color: colors.brownMid },
  optionTextSel: { color: '#fff' },

  // Scroll picker
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  pickerCol: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: 11, color: colors.muted, marginBottom: 4 },
  pickerContainer: {
    width: '100%', borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cream,
  },
  pickerDisabled: { opacity: 0.35 },

  // Recipe cat checkbox
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cream,
  },
  checkBox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 10 },

  // 요일 선택
  dayLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, marginTop: 4,
  },
  dayResultText: {
    fontSize: 13, fontWeight: '600', color: colors.caramel,
  },
  dayRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  everyDayBtn: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  everyDayBtnSel: {
    backgroundColor: colors.caramel,
    borderColor: colors.caramel,
  },
  everyDayText: {
    fontSize: 14, fontWeight: '600', color: colors.brownMid,
  },
  everyDayTextSel: {
    color: '#fff',
  },
  dayBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.cream,
  },
  dayBtnSel: {
    backgroundColor: colors.caramel,
    borderColor: colors.caramel,
  },
  dayBtnAllOn: {
    backgroundColor: colors.caramel + '22',
    borderColor: colors.caramel + '55',
  },
  dayBtnText: {
    fontSize: 13, fontWeight: '600', color: colors.muted,
  },
  dayBtnTextSel: {
    color: '#fff',
  },
  dayBtnTextAllOn: {
    color: colors.caramel,
  },

  recipeCardInactive: { opacity: 0.55 },

  // Delete recipe button (inside modal)
  deleteRecipeBtn: {
    alignSelf: 'center', marginTop: spacing.md, paddingVertical: 6,
  },
  deleteRecipeBtnText: { fontSize: 13, color: colors.border },
  deleteCatBtnText: { fontSize: 13, color: colors.border },

  // 7-day history (unused, kept for safety)
  historyWrap: {
    backgroundColor: colors.cream, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 10, marginBottom: 8,
  },
  historyTitle: { fontSize: 11, color: colors.muted, marginBottom: 6, fontWeight: '600' },
  historyHeader: { flexDirection: 'row', marginBottom: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  historyRecipeLabel: { flex: 1, fontSize: 11, color: colors.brownMid },
  historyDateCell: { width: 28, alignItems: 'center' },
  historyDateText: { fontSize: 10, color: colors.muted },
  historyCell: { width: 28, alignItems: 'center' },
  historyCellText: { fontSize: 12, fontWeight: '700' },
});
