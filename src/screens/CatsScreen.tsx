// src/screens/CatsScreen.tsx
// REQ-M01~M05, V1-02, V2-01~02, V5-01~02

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import {
  addCat as fsAddCat, updateCat, deleteCat as fsDeleteCat,
  addRecipe as fsAddRecipe, updateRecipe, deleteRecipe as fsDeleteRecipe,
} from '../services/dbService';
import { Button, Card, Input, BottomSheet, Tag, EmptyState } from '../components/ui';
import { colors, spacing, radius, shadow } from '../utils/theme';
import type { Cat, Recipe, TimeSlot } from '../types';

const EMOJIS = ['🐱', '🐈', '🐈‍⬛', '😺', '🦁', '🐯', '🐻', '🐼'];
const TIME_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'am', label: '☀️ 오전' },
  { value: 'pm', label: '🌙 오후' },
  { value: 'all', label: '📅 종일' },
];

export default function CatsScreen() {
  const { cats, recipes, household, user, setCats, setRecipes } = useStore();

  // Cat modal state
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('🐱');

  // Recipe modal state
  const [recipeModal, setRecipeModal] = useState(false);
  const [targetCatId, setTargetCatId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [recipeTime, setRecipeTime] = useState<TimeSlot>('am');
  const [recipeSharedCatIds, setRecipeSharedCatIds] = useState<string[]>([]);

  // ── Cat CRUD ─────────────────────────────────────────────────────────────────

  const openAddCat = () => {
    setEditingCat(null); setCatName(''); setCatEmoji('🐱'); setCatModal(true);
  };
  const openEditCat = (cat: Cat) => {
    setEditingCat(cat); setCatName(cat.name); setCatEmoji(cat.emoji); setCatModal(true);
  };

  const handleSaveCat = async () => {
    if (!catName.trim() || !household || !user) return;
    if (editingCat) {
      await updateCat(household.id, editingCat.id, { name: catName.trim(), emoji: catEmoji });
      setCats(cats.map((c) => c.id === editingCat.id ? { ...c, name: catName.trim(), emoji: catEmoji } : c));
    } else {
      const cat = await fsAddCat(household.id, {
        name: catName.trim(), emoji: catEmoji,
        ownerId: user.uid, householdId: household.id,
      });
      setCats([...cats, cat]);
    }
    setCatModal(false);
  };

  const handleDeleteCat = (cat: Cat) => {
    Alert.alert(
      `${cat.emoji} ${cat.name} 삭제`,
      '이 고양이와 연결된 루틴도 모두 삭제됩니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            if (!household) return;
            await fsDeleteCat(household.id, cat.id);
            setCats(cats.filter((c) => c.id !== cat.id));
            setRecipes(recipes.filter((r) => {
              const updated = r.catIds.filter((id) => id !== cat.id);
              return updated.length > 0;
            }));
          },
        },
      ]
    );
  };

  // ── Recipe CRUD ───────────────────────────────────────────────────────────────

  const openAddRecipe = (catId: string) => {
    setTargetCatId(catId);
    setRecipeName(''); setRecipeTime('am'); setRecipeSharedCatIds([catId]);
    setRecipeModal(true);
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim() || !household) return;
    const catIds = recipeSharedCatIds.length > 0 ? recipeSharedCatIds : [targetCatId];
    const recipe = await fsAddRecipe(household.id, {
      name: recipeName.trim(),
      time: recipeTime,
      catIds,
      active: true,
      householdId: household.id,
    });
    setRecipes([...recipes, recipe]);
    setRecipeModal(false);
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

  const toggleSharedCat = (catId: string) => {
    setRecipeSharedCatIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
          return (
            <View key={cat.id}>
              {/* Cat Card */}
              <View style={[styles.catCard, shadow.sm]}>
                <View style={styles.catAvatar}>
                  <Text style={{ fontSize: 26 }}>{cat.emoji}</Text>
                </View>
                <View style={styles.catInfo}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catMeta}>루틴 {catRecipes.length}개 등록됨</Text>
                </View>
                <View style={styles.catActions}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openEditCat(cat)}
                  >
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

              {/* Recipes for this cat */}
              <View style={styles.recipeList}>
                {catRecipes.map((r) => (
                  <View key={r.id} style={styles.recipeCard}>
                    <Text style={styles.recipeIcon}>
                      {r.time === 'am' ? '☀️' : r.time === 'pm' ? '🌙' : '📅'}
                    </Text>
                    <View style={styles.recipeInfo}>
                      <Text
                        style={[
                          styles.recipeName,
                          !r.active && styles.recipeNameInactive,
                        ]}
                      >
                        {r.name}
                      </Text>
                      {r.catIds.length > 1 && (
                        <Text style={styles.recipeMeta}>
                          공유: {r.catIds.map((id) => cats.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.recipeActions}>
                      <Tag label={r.time === 'am' ? '오전' : r.time === 'pm' ? '오후' : '종일'} type={r.time} />
                      <TouchableOpacity onPress={() => handleToggleActive(r)} style={styles.smallBtn}>
                        <Text style={{ fontSize: 16 }}>{r.active ? '✅' : '⏸️'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteRecipe(r)} style={styles.smallBtn}>
                        <Text style={{ fontSize: 14 }}>✕</Text>
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
        title={editingCat ? '🐱 고양이 수정' : '🐱 고양이 등록'}
      >
        <Input
          label="이름 *"
          value={catName}
          onChangeText={setCatName}
          placeholder="예: 루나, 모카, 호두"
          maxLength={20}
        />
        <Text style={styles.emojiLabel}>이모지 선택</Text>
        <View style={styles.emojiRow}>
          {EMOJIS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.emojiChip, catEmoji === e && styles.emojiChipSel]}
              onPress={() => setCatEmoji(e)}
            >
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <Button label="취소" variant="secondary" onPress={() => setCatModal(false)} style={{ flex: 1 }} />
          <Button label={editingCat ? '수정' : '등록'} onPress={handleSaveCat} style={{ flex: 1 }} />
        </View>
      </BottomSheet>

      {/* ── Add Recipe Modal ── */}
      <BottomSheet
        visible={recipeModal}
        onClose={() => setRecipeModal(false)}
        title="📋 루틴 항목 등록"
      >
        <Input
          label="항목명 *"
          value={recipeName}
          onChangeText={setRecipeName}
          placeholder="예: 아침 사료, 약 급여, 화장실 청소"
          maxLength={30}
        />
        <Text style={styles.emojiLabel}>시간대</Text>
        <View style={styles.timeRow}>
          {TIME_OPTIONS.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.timeChip, recipeTime === t.value && styles.timeChipSel]}
              onPress={() => setRecipeTime(t.value)}
            >
              <Text style={[styles.timeText, recipeTime === t.value && styles.timeTextSel]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {cats.length > 1 && (
          <>
            <Text style={styles.emojiLabel}>적용 고양이 *</Text>
            <View style={styles.emojiRow}>
              {cats.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, recipeSharedCatIds.includes(c.id) && styles.catChipSel]}
                  onPress={() => toggleSharedCat(c.id)}
                >
                  <Text>{c.emoji} {c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
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
  catCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#fff', marginBottom: 10,
  },
  catAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  catInfo: { flex: 1 },
  catName: { fontSize: 16, color: colors.charcoal },
  catMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  catActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  recipeList: { paddingLeft: 16, marginBottom: 6 },
  recipeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#fff', marginBottom: 6,
  },
  recipeIcon: { fontSize: 20 },
  recipeInfo: { flex: 1 },
  recipeName: { fontSize: 14, color: colors.charcoal },
  recipeNameInactive: { textDecorationLine: 'line-through', color: colors.muted },
  recipeMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  recipeActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  emojiLabel: { fontSize: 12, color: colors.muted, marginBottom: 8, marginTop: 4 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  emojiChip: {
    width: 44, height: 44, borderRadius: radius.sm,
    backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  emojiChipSel: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  timeRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  timeChip: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center',
  },
  timeChipSel: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  timeText: { fontSize: 13, color: colors.brownMid },
  timeTextSel: { color: '#fff' },
  catChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border,
  },
  catChipSel: { backgroundColor: colors.caramel, borderColor: colors.caramel },
  row: { flexDirection: 'row', gap: 10 },
});
