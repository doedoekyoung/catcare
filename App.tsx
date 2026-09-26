// App.tsx

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { requestPermissions } from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    requestPermissions();
    // 배지(오늘 남은 할 일 수) 동기화는 AppNavigator에서 담당 — household 데이터가
    // 거기서만 구독되기 때문. 여기선 알림 권한 요청만.
  }, []);

  const inner = (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );

  if (Platform.OS === 'web') {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#D4C4B0', alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 430, flex: 1, backgroundColor: '#FFFDF9', shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 40 }}>
          {inner}
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {inner}
    </GestureHandlerRootView>
  );
}
