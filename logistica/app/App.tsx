import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation';
import { UpdateBanner } from './src/updates/UpdateBanner';
// Registra o task de rastreamento em background no boot (Fase B). Sem efeito no
// Expo Go — só passa a valer no build standalone.
import './src/tracking/backgroundLocation';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <UpdateBanner />
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}
