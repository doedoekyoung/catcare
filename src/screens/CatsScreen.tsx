// src/screens/CatsScreen.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, Platform,
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
} from '../services/dbService';
import { Button, Input, BottomSheet, EmptyState } from '../components/ui';
import { colors, spacing, radius, shadow, CAT_TAG_COLORS } from '../utils/theme';
import type { Cat, Recipe, TimeSlot } from '../types';

const GENDER_OPTIONS = [
  { value: 'male' as const, label: '남아' },
  { value: 'female' as const, label: '여아' },
  { value: 'neutered' as const, label: '중성화' },
];

const TIME_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'morning', label: '🌅 아침' },
  { value: 'lunch', label: '☀️ 점심' },
  { value: 'evening', label: '🌙 저녁' },
];

const TIME_ICONS: Record<TimeSlot, string> = {
  morning: '🌅',
  lunch: '☀️',
  evening: '🌙',
};

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

export default function CatsScreen() {
  const { cats, recipes, household, user, setCats, setRecipes } = useStore();

  // ── Cat modal state ───────────────────────────────────────────────────────────
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  const [catName, setCatName] = useState('');
  const [catPhotoUri, setCatPhotoUri] = useState('');
  const [catGender, setCatGender] = useState<'male' | 'female' | 'neutered' | ''>('');
  const [catTagColor, setCatTagColor] = useState(CAT_TAG_COLORS[0]);
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
    setCatGender((cat.gender as 'male' | 'female' | 'neutered' | '') ?? '');
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
      gender: catGender || undefined,
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
    setRecipeSharedCatIds([catId]);
    setRecipeModal(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setTargetCatId(recipe.catIds[0]);
    setRecipeName(recipe.name);
    setRecipeTimes(recipe.times);
    setRecipeSharedCatIds(recipe.catIds);
    setRecipeModal(true);
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim() || !household || recipeTimes.length === 0) return;
    const catIds = recipeSharedCatIds.length > 0 ? recipeSharedCatIds : [targetCatId];
    try {
      if (editingRecipe) {
        await updateRecipe(household.id, editingRecipe.id, {
          name: recipeName.trim(), times: recipeTimes, catIds,
        });
        setRecipes(recipes.map((r) =>
          r.id === editingRecipe.id
            ? { ...r, name: recipeName.trim(), times: recipeTimes, catIds }
            : r
        ));
      } else {
        const recipe = await fsAddRecipe(household.id, {
          name: recipeName.trim(), times: recipeTimes, catIds,
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
        <View>
          <Text style={styles.headerTitle}>고양이 관리</Text>
          <Text style={styles.headerSub}>등록된 고양이 & 루틴</Text>
        </View>
        <Button label="+ 고양이" size="sm" onPress={openAddCat} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cats.length === 0 && (
          <EmptyState
            emoji="🐱"
            title="등록된 고양이가 없어요"
            desc="상단 버튼으로 첫 고양이를 등록해보세요"
            action={{ label: '+ 고양이 등록', onPress: openAddCat }}
          />
        )}

        {cats.map((cat) => {
          const catRecipes = recipes.filter((r) => r.catIds.includes(cat.id));
          const tagColor = cat.tagColor ?? colors.caramel;
          return (
            <View key={cat.id}>
              {/* Cat Card */}
              <View style={[styles.catCard, shadow.sm]}>
                <TouchableOpacity onPress={() => openEditCat(cat)}>
                  <View style={[styles.catAvatar, { backgroundColor: tagColor + '30', borderColor: tagColor }]}>
                    {cat.photoUri ? (
                      <Image source={{ uri: cat.photoUri }} style={styles.catAvatarImg} />
                    ) : (
                      <Text style={[styles.catAvatarInitial, { color: tagColor }]}>
                        {cat.name.charAt(0)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <View style={[styles.tagDot, { backgroundColor: tagColor }]} />
                  </View>
                  <Text style={styles.catMeta}>
                    {cat.gender === 'male' ? '남아' : cat.gender === 'female' ? '여아' : cat.gender === 'neutered' ? '중성화' : ''}
                    {cat.gender && cat.birthYear ? ' · ' : ''}
                    {cat.birthYear ? `${cat.birthYear}년생` : ''}
                    {!cat.gender && !cat.birthYear ? `루틴 ${catRecipes.length}개` : ''}
                  </Text>
                </View>
                <View style={styles.catActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => openEditCat(cat)}>
                    <Text style={{ fontSize: 15 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.dangerBg }]}
                    onPress={() => handleDeleteCat(cat)}
                  >
                    <Text style={{ fontSize: 15 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Recipes */}
              <View style={styles.recipeList}>
                {catRecipes.map((r) => (
                  <View key={r.id} style={[styles.recipeCard, { borderLeftColor: tagColor, borderLeftWidth: 3 }]}>
                    <View style={styles.recipeInfo}>
                      <Text style={[styles.recipeName, !r.active && styles.recipeNameInactive]}>
                        {r.name}
                      </Text>
                      <View style={styles.recipeTimeTags}>
                        {r.times.map((t) => (
                          <View key={t} style={[styles.timeTag, { backgroundColor: tagColor + '20', borderColor: tagColor + '60' }]}>
                            <Text style={[styles.timeTagText, { color: tagColor }]}>
                              {TIME_ICONS[t]} {t === 'morning' ? '아침' : t === 'lunch' ? '점심' : '저녁'}
                            </Text>
                          </View>
                        ))}
                        {r.catIds.length > 1 && (
                          <Text style={styles.recipeMeta}>
                            공유: {r.catIds.map((id) => cats.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.recipeActions}>
                      <TouchableOpacity onPress={() => openEditRecipe(r)} style={styles.smallBtn}>
                        <Text style={{ fontSize: 14 }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleToggleActive(r)} style={styles.smallBtn}>
                        <Text style={{ fontSize: 16 }}>{r.active ? '✅' : '⏸️'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteRecipe(r)} style={styles.smallBtn}>
                        <Text style={{ fontSize: 14, color: colors.muted }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <Button
                  label="+ 루틴 항목 추가"
                  variant="secondary"
                  size="sm"
                  onPress={() => openAddRecipe(cat.id)}
                  style={{ marginTop: 6, marginBottom: spacing.lg, alignSelf: 'flex-start' }}
                />
              </View>
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
                  <Text style={{ fontSize: 32 }}>📷</Text>
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
            label="이름 *"
            value={catName}
            onChangeText={setCatName}
            placeholder="예: 루나, 모카, 호두"
            maxLength={20}
          />

          {/* 성별 */}
          <Text style={styles.fieldLabel}>성별</Text>
          <View style={styles.optionRow}>
            {GENDER_OPTIONS.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[styles.optionChip, catGender === g.value && styles.optionChipSel]}
                onPress={() => setCatGender(g.value)}
              >
                <Text style={[styles.optionText, catGender === g.value && styles.optionTextSel]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 생년월일 — 드롭다운 (웹) / 스크롤 피커 (네이티브) */}
          <Text style={styles.fieldLabel}>생년월일/만난 날</Text>
          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>년</Text>
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
              <Text style={styles.pickerLabel}>월</Text>
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
              <Text style={styles.pickerLabel}>일</Text>
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
            <Button label={editingCat ? '수정' : '등록'} onPress={handleSaveCat} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </BottomSheet>

      {/* ── Add/Edit Recipe Modal ── */}
      <BottomSheet
        visible={recipeModal}
        onClose={() => setRecipeModal(false)}
        title={editingRecipe ? '루틴 수정' : '루틴 항목 등록'}
      >
        <Input
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
          <Button label={editingRecipe ? '수정' : '등록'} onPress={handleSaveRecipe} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.warmWhite },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: 80 },

  // Cat card
  catCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#fff', marginBottom: 10,
  },
  catAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, overflow: 'hidden',
  },
  catAvatarImg: { width: 48, height: 48 },
  catAvatarInitial: { fontSize: 20, fontWeight: '700' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catInfo: { flex: 1 },
  catName: { fontSize: 16, color: colors.charcoal },
  catMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  catActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },

  // Recipe list
  recipeList: { paddingLeft: 16, marginBottom: 6 },
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
  recipeActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  smallBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

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
});
