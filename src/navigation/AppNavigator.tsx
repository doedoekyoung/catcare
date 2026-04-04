// src/navigation/AppNavigator.tsx

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, TouchableOpacity } from 'react-native';
import { clearLocalSession } from '../services/authService';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import CatsScreen from '../screens/CatsScreen';
import RecordsScreen from '../screens/RecordsScreen';
import SettingsScreen from '../screens/SettingsScreen';

import { subscribeToAuthState } from '../services/authService';
import {
  subscribeToCats, subscribeToRecipes,
  subscribeToChecks, subscribeToLogs,
  getHouseholdById,
} from '../services/dbService';
import { useStore } from '../store/useStore';
import { colors, spacing, radius } from '../utils/theme';
import { toDateKey } from '../utils/date';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_LABELS: Record<string, string> = {
  Home: '홈', Cats: '고양이', Records: '기록', Settings: '관리',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.warmWhite,
          borderTopWidth: 1.5,
          borderTopColor: colors.border,
          paddingBottom: 8,
          height: 48,
        },
        tabBarActiveTintColor: colors.caramel,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: TAB_LABELS[route.name],
        tabBarIcon: () => null,
        tabBarLabelStyle: { fontSize: 13, marginBottom: 2 },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cats" component={CatsScreen} />
      <Tab.Screen name="Records" component={RecordsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const {
    user, setUser, setHousehold, setCats, setRecipes,
    setChecks, setLogs, setIsLoading,
  } = useStore();

  const [authLoaded, setAuthLoaded] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const dataUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // 3초 후 초기화 버튼 노출, 5초 후 로컬 세션 자동 초기화 후 로그인 화면
    const resetTimer = setTimeout(() => setShowReset(true), 3000);
    const fallback = setTimeout(async () => {
      await clearLocalSession();
      setAuthLoaded(true);
    }, 5000);

    const unsubAuth = subscribeToAuthState(async (u) => {
      clearTimeout(resetTimer);
      clearTimeout(fallback);

      // 이전 Realtime 구독 정리 (중복 채널 방지)
      if (dataUnsubRef.current) {
        dataUnsubRef.current();
        dataUnsubRef.current = null;
      }

      // 세션 없음 → 로그인 화면 (authService에서 이미 캐시/토큰 정리 완료)
      if (!u) {
        setUser(null);
        setAuthLoaded(true);
        return;
      }

      setUser(u);
      setAuthLoaded(true);

      if (u?.householdId) {
        setIsLoading(true);
        try {
          const hh = await getHouseholdById(u.householdId);
          if (hh) setHousehold(hh);

          const today = toDateKey();
          const unsub1 = subscribeToCats(u.householdId, setCats);
          const unsub2 = subscribeToRecipes(u.householdId, setRecipes);
          const unsub3 = subscribeToChecks(u.householdId, today, (checks) => {
            const map: Record<string, any> = {};
            checks.forEach((c) => { map[c.id] = c; });
            setChecks(map);
          });
          const unsub4 = subscribeToLogs(u.householdId, setLogs);

          dataUnsubRef.current = () => { unsub1(); unsub2(); unsub3(); unsub4(); };
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => {
      clearTimeout(resetTimer);
      clearTimeout(fallback);
      unsubAuth();
      if (dataUnsubRef.current) {
        dataUnsubRef.current();
        dataUnsubRef.current = null;
      }
    };
  }, []);

  if (!authLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
        <Text style={{ fontSize: 36 }}>🐱</Text>
        <Text style={{ color: colors.muted, marginTop: 12 }}>로딩 중...</Text>
        {showReset && (
          <TouchableOpacity
            style={{
              marginTop: 32, paddingVertical: 10, paddingHorizontal: 24,
              borderRadius: 20, borderWidth: 1.5, borderColor: colors.caramel,
            }}
            onPress={async () => {
              await clearLocalSession();
              if (typeof window !== 'undefined') window.location.reload();
            }}
          >
            <Text style={{ color: colors.caramel, fontSize: 14 }}>로그인 문제 해결</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
