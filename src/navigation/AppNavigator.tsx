// src/navigation/AppNavigator.tsx

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View } from 'react-native';

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

const TAB_ICONS: Record<string, { default: string; active: string }> = {
  Home:     { default: '🏠', active: '🏡' },
  Cats:     { default: '🐱', active: '🐈' },
  Records:  { default: '📓', active: '📗' },
  Settings: { default: '⚙️', active: '⚙️' },
};

const TAB_LABELS: Record<string, string> = {
  Home: '홈', Cats: '고양이', Records: '기록', Settings: '설정',
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
          height: 64,
        },
        tabBarActiveTintColor: colors.caramel,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: TAB_LABELS[route.name],
        tabBarIcon: ({ focused, size }) => (
          <Text style={{ fontSize: 22 }}>
            {focused
              ? TAB_ICONS[route.name]?.active
              : TAB_ICONS[route.name]?.default}
          </Text>
        ),
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
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

  useEffect(() => {
    // 환경변수 누락 등으로 auth 콜백이 영원히 안 올 경우 폴백
    const fallback = setTimeout(() => setAuthLoaded(true), 6000);

    const unsubAuth = subscribeToAuthState(async (u) => {
      clearTimeout(fallback);
      setUser(u);
      setAuthLoaded(true);

      if (u?.householdId) {
        setIsLoading(true);
        try {
          const hh = await getHouseholdById(u.householdId);
          if (hh) setHousehold(hh);

          const today = toDateKey();
          // Subscribe to real-time collections
          const unsub1 = subscribeToCats(u.householdId, setCats);
          const unsub2 = subscribeToRecipes(u.householdId, setRecipes);
          const unsub3 = subscribeToChecks(u.householdId, today, (checks) => {
            const map: Record<string, any> = {};
            checks.forEach((c) => { map[c.id] = c; });
            setChecks(map);
          });
          const unsub4 = subscribeToLogs(u.householdId, setLogs);

          return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
        } finally {
          setIsLoading(false);
        }
      }
    });
    return () => { clearTimeout(fallback); unsubAuth(); };
  }, []);

  if (!authLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
        <Text style={{ fontSize: 36 }}>🐱</Text>
        <Text style={{ color: colors.muted, marginTop: 12 }}>로딩 중...</Text>
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
