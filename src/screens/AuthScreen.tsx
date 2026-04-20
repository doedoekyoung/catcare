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
import Logo from '../components/Logo';
import InAppBrowserBanner from '../components/InAppBrowserBanner';
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
      const msg = e?.message ?? '';
      if (msg.includes('already') || msg.includes('duplicate')) {
        setError('이미 사용 중인 이메일입니다.');
      } else {
        setError(`회원가입 실패: ${msg || '알 수 없는 오류'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <InAppBrowserBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <Logo height={64} withTagline />
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              testID="auth-tab-login"
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="auth-tab-signup"
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>회원가입</Text>
            </TouchableOpacity>
          </View>

          <Input
            testID="auth-email-input"
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
            testID="auth-password-input"
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
              testID="auth-name-input"
              ref={nameRef}
              label="이름 *"
              value={name}
              onChangeText={setName}
              placeholder="집사 이름"
              returnKeyType="go"
              onSubmitEditing={handleSignUp}
            />
          )}

          {error ? <Text testID="auth-error-text" style={styles.error}>{error}</Text> : null}

          <Button
            testID="auth-submit-button"
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
