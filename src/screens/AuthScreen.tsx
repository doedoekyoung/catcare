// src/screens/AuthScreen.tsx

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signUpWithEmail, signInWithEmail } from '../services/authService';
import { createHousehold } from '../services/dbService';
import { useStore } from '../store/useStore';
import { Button, Input } from '../components/ui';
import { colors, spacing, radius } from '../utils/theme';

export default function AuthScreen() {
  const { setUser, setHousehold, setIsOnboarded } = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요'); return; }
    setLoading(true); setError('');
    try {
      const user = await signInWithEmail(email, password);
      setUser(user);
      setIsOnboarded(true);
    } catch (e: any) {
      setError('로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name) { setError('모든 항목을 입력해주세요'); return; }
    setLoading(true); setError('');
    try {
      const user = await signUpWithEmail(email, password, name);
      const household = await createHousehold(user.uid, `${name}의 집`);
      const { upsertUser } = await import('../services/dbService');
      const updatedUser = { ...user, householdId: household.id };
      await upsertUser(updatedUser);
      setUser(updatedUser);
      setHousehold(household);
      setIsOnboarded(true);
    } catch (e: any) {
      setError('회원가입에 실패했습니다. 이미 사용 중인 이메일일 수 있습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <Text style={styles.logo}>🐱 CatCare</Text>
            <Text style={styles.logoSub}>고양이 돌봄 루틴 관리</Text>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>회원가입</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="이메일"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <Input
            ref={passwordRef}
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            placeholder="6자 이상"
            secureTextEntry
            returnKeyType={mode === 'login' ? 'go' : 'next'}
            onSubmitEditing={mode === 'login' ? handleLogin : () => nameRef.current?.focus()}
            blurOnSubmit={mode === 'login'}
          />
          {mode === 'signup' && (
            <Input
              ref={nameRef}
              label="이름 *"
              value={name}
              onChangeText={setName}
              placeholder="집사 이름"
              returnKeyType="go"
              onSubmitEditing={handleSignUp}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={mode === 'login' ? '로그인' : '회원가입'}
            onPress={mode === 'login' ? handleLogin : handleSignUp}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  kav: { flex: 1 },
  content: { padding: spacing.xl, justifyContent: 'center', minHeight: '100%' as any },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { fontSize: 36, fontWeight: '800', color: colors.caramel },
  logoSub: { fontSize: 14, color: colors.muted, marginTop: 6 },
  tabs: {
    flexDirection: 'row', marginBottom: spacing.lg,
    borderRadius: radius.md, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.cream },
  tabActive: { backgroundColor: colors.caramel },
  tabText: { fontSize: 14, color: colors.muted },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  error: { fontSize: 13, color: colors.terracotta, textAlign: 'center', marginBottom: spacing.sm },
});
