// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const authStorage =
  Platform.OS === 'web'
    ? undefined // 웹은 localStorage 기본 사용
    : {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const TABLES = {
  USERS: 'users',
  HOUSEHOLDS: 'households',
  CATS: 'cats',
  RECIPES: 'recipes',
  CHECKS: 'check_records',
  LOGS: 'daily_logs',
} as const;
