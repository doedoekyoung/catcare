// src/services/authService.ts
import { supabase } from './supabase';
import { upsertUser, getUserById } from './dbService';
import type { User } from '../types';

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('회원가입에 실패했습니다.');

  const user: User = {
    uid: data.user.id,
    email,
    displayName,
    role: 'owner',
  };
  await upsertUser(user);
  return user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('로그인에 실패했습니다.');

  const user = await getUserById(data.user.id);
  if (!user) throw new Error('사용자 정보를 찾을 수 없습니다.');
  return user;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function subscribeToAuthState(
  cb: (user: User | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (!session?.user) { cb(null); return; }
      try {
        const user = await getUserById(session.user.id);
        cb(user ?? null);
      } catch {
        cb(null);
      }
    }
  );
  return () => subscription.unsubscribe();
}

export async function signInAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
