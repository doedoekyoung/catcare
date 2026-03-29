// src/screens/CatsScreen.tsx

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image,
} from 'react-native';
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

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function CatsScreen() {
  const { cats, recipes, household, user, setCats, setRecipes } = useStore();

  // ── Cat modal state ───────────────────────────────────────────────────────────
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  const [catName, setCatName] = useState('');
  const [catPhotoUri, setCatPhotoUri] = useState('');
  const [catGender, setCatGender] = useState<'male' | 'female' | 'neutered' | ''>('');
  const [catTagColor, setCatTagColor] = useState(CAT_TAG_COLORS[0]);
  const [catBirthYear, setCatBirthYear] = useState('');
  const [catBirthMonth, setCatBirthMonth] = useState<number | null>(null);
  const [catBirthDay, setCatBirthDay] = useState<number | null>(null);
  const [activePicker, setActivePicker] = useState<'year' | 'month' | 'day' | null>(null);
  const [catNotes, setCatNotes] = useState('');

  // ── Recipe modal state ────────────────────────────────────────────────────────
  const [recipeModal, setRecipeModal] = useState(false);
  const [targetCatId, setTargetCatId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [recipeTimes, setRecipeTimes] = useState<TimeSlot[]>(['morning']);
  const [recipeSharedCatIds, setRecipeSharedCatIds] = useState<string[]>([]);

  // ── Image picker ──────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setCatPhotoUri(result.assets[0].uri);
  };

  // ── Cat CRUD ──────────────────────────────────────────────────────────────────

  const openAddCat = () => {
    setEditingCat(null);
    setCatName(''); setCatPhotoUri(''); setCatGender('');
    setCatTagColor(CAT_TAG_COLORS[0]);
    setCatBirthYear(''); setCatBirthMonth(null); setCatBirthDay(null);
    setActivePicker(null); setCatNotes('');
    setCatModal(true);
  };

  const openEditCat = (cat: Cat) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatPhotoUri(cat.photoUri ?? '');
    setCatGender((cat.gender as 'male' | 'female' | 'neutered' | '') ?? '');
    setCatTagColor(cat.tagColor ?? CAT_TAG_COLORS[0]);
    setCatBirthYear(cat.birthYear ? String(cat.birthYear) : '');
    setCatBirthMonth(cat.birthMonth ?? null);
    setCatBirthDay(cat.birthDay ?? null);
    setActivePicker(null);
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
      birthYear: catBirthYear ? Number(catBirthYear) : undefined,
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
      Alert.alert('오류', `고양이 저장에 실패했습니다.\n${e?.message ?? ''}`);
    }
  };

  const handleDeleteCat = (cat: Cat) => {
    Alert.alert(
      `${cat.name} 삭제`,
      '이 고양이와 연결된 루틴도 모두 삭제됩니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            if (!household) return;
            await fsDeleteCat(household.id, cat.id);
            setCats(cats.filter((c) => c.id !== cat.id));
            setRecipes(recipes.filter((r) => r.catIds.filter((id) => id !== cat.id).length > 0));
          },
        },
      ]
    );
  };

  // ── Recipe CRUD ───────────────────────────────────────────────────────────────

  const openAddRecipe = (catId: string) => {
    setTargetCatId(catId);
    setRecipeName('');
    setRecipeTimes(['morning']);
    setRecipeSharedCatIds([catId]);
    setRecipeModal(true);
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim() || !household || recipeTimes.length === 0) return;
    const catIds = recipeSharedCatIds.length > 0 ? recipeSharedCatIds : [targetCatId];
    try {
      const recipe = await fsAddRecipe(household.id, {
        name: recipeName.trim(),
        times: recipeTimes,
        catIds,
        active: true,
        householdId: household.id,
      });
      setRecipes([...recipes, recipe]);
      setRecipeModal(false);
    } catch (e: any) {
      Alert.alert('오류', `루틴 저장에 실패했습니다.\n${e?.message ?? ''}`);
    }
  };

  const handleDeleteRecipe = (recipe: Recipe) => {
    Alert.alert('루틴 삭제', `"${recipe.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          if (!household) return;
          await fsDeleteRecipe(household.id, recipe.id);
          setRecipes(recipes.filter((r) => r.id !== recipe.id));
        },
      },
    ]);
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

  const selectRecipeCat = (catId: string) => {
    setRecipeSharedCatIds([catId]);
    setTargetCatId(catId);
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
                    {cat.gender && (cat.birthYear || cat.metDate) ? ' · ' : ''}
                    {cat.birthYear ? `${cat.birthYear}년생` : ''}
                    {(!cat.birthYear && cat.metDate) ? `만난 날: ${cat.metDate}` : ''}
                    {!cat.gender && !cat.birthYear && !cat.metDate ? `루틴 ${catRecipes.length}개` : ''}
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
          {/* 사진 */}
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

            {/* 태그 컬러 */}
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

          {/* 생년월일/만난 날 */}
          <Text style={styles.fieldLabel}>생년월일/만난 날</Text>
          <View style={[styles.optionRow, { marginBottom: activePicker ? 8 : spacing.md }]}>
            {/* 년 버튼 */}
            <TouchableOpacity
              style={[styles.dateBtn, catBirthYear ? { borderColor: catTagColor } : null, activePicker === 'year' && { backgroundColor: catTagColor, borderColor: catTagColor }]}
              onPress={() => setActivePicker(activePicker === 'year' ? null : 'year')}
            >
              <Text style={[styles.dateBtnText, activePicker === 'year' && { color: '#fff' }, (catBirthYear && activePicker !== 'year') && { color: catTagColor }]}>
                {catBirthYear ? `${catBirthYear}년` : '년'}
              </Text>
            </TouchableOpacity>
            {/* 월 버튼 */}
            <TouchableOpacity
              style={[styles.dateBtn, !catBirthYear && styles.dateBtnDisabled, catBirthMonth ? { borderColor: catTagColor } : null, activePicker === 'month' && { backgroundColor: catTagColor, borderColor: catTagColor }]}
              onPress={() => { if (catBirthYear) setActivePicker(activePicker === 'month' ? null : 'month'); }}
              disabled={!catBirthYear}
            >
              <Text style={[styles.dateBtnText, !catBirthYear && { color: colors.muted }, activePicker === 'month' && { color: '#fff' }, (catBirthMonth && activePicker !== 'month') && { color: catTagColor }]}>
                {catBirthMonth ? `${catBirthMonth}월` : '월'}
              </Text>
            </TouchableOpacity>
            {/* 일 버튼 */}
            <TouchableOpacity
              style={[styles.dateBtn, !catBirthMonth && styles.dateBtnDisabled, catBirthDay ? { borderColor: catTagColor } : null, activePicker === 'day' && { backgroundColor: catTagColor, borderColor: catTagColor }]}
              onPress={() => { if (catBirthMonth) setActivePicker(activePicker === 'day' ? null : 'day'); }}
              disabled={!catBirthMonth}
            >
              <Text style={[styles.dateBtnText, !catBirthMonth && { color: colors.muted }, activePicker === 'day' && { color: '#fff' }, (catBirthDay && activePicker !== 'day') && { color: catTagColor }]}>
                {catBirthDay ? `${catBirthDay}일` : '일'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 년도 입력 */}
          {activePicker === 'year' && (
            <Input
              placeholder="출생년도 (예: 2021)"
              value={catBirthYear}
              onChangeText={(v) => { setCatBirthYear(v); if (!v) { setCatBirthMonth(null); setCatBirthDay(null); } }}
              keyboardType="number-pad"
              maxLength={4}
              containerStyle={{ marginBottom: spacing.sm }}
              autoFocus
            />
          )}
          {/* 월 선택 */}
          {activePicker === 'month' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={styles.monthRow}>
                {MONTHS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.dateChip, catBirthMonth === m && { backgroundColor: catTagColor, borderColor: catTagColor }]}
                    onPress={() => { setCatBirthMonth(catBirthMonth === m ? null : m); if (catBirthMonth === m) setCatBirthDay(null); }}
                  >
                    <Text style={[styles.dateChipText, catBirthMonth === m && { color: '#fff' }]}>{m}월</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          {/* 일 선택 */}
          {activePicker === 'day' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={styles.monthRow}>
                {DAYS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dateChip, catBirthDay === d && { backgroundColor: catTagColor, borderColor: catTagColor }]}
                    onPress={() => setCatBirthDay(catBirthDay === d ? null : d)}
                  >
                    <Text style={[styles.dateChipText, catBirthDay === d && { color: '#fff' }]}>{d}일</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

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

      {/* ── Add Recipe Modal ── */}
      <BottomSheet
        visible={recipeModal}
        onClose={() => setRecipeModal(false)}
        title="루틴 항목 등록"
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
        <Text style={styles.fieldLabel}>적용 고양이 *</Text>
        <View style={styles.optionRow}>
          {cats.map((c) => {
            const selected = recipeSharedCatIds.includes(c.id);
            const color = c.tagColor ?? colors.caramel;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.radioRow, selected && { borderColor: color }]}
                onPress={() => selectRecipeCat(c.id)}
              >
                <View style={[styles.radioCircle, selected && { borderColor: color }]}>
                  {selected && <View style={[styles.radioDot, { backgroundColor: color }]} />}
                </View>
                <Text style={[styles.optionText, selected && { color }]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Button label="취소" variant="secondary" onPress={() => setRecipeModal(false)} style={{ flex: 1 }} />
          <Button label="등록" onPress={handleSaveRecipe} style={{ flex: 1 }} />
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
  dateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  yearInput: { width: 90, marginBottom: 0 },
  monthScroll: { flex: 1 },
  monthRow: { flexDirection: 'row', gap: 6 },
  dateBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cream,
    alignItems: 'center',
  },
  dateBtnDisabled: { opacity: 0.4 },
  dateBtnText: { fontSize: 14, color: colors.brownMid, fontWeight: '500' },
  dateChip: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cream,
  },
  dateChipText: { fontSize: 12, color: colors.brownMid },
  catChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border,
  },
  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cream,
  },
  radioCircle: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  row: { flexDirection: 'row', gap: 10 },
});
