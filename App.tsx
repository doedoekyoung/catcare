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
