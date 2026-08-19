import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation';
import { UpdateBanner } from './src/updates/UpdateBanner';
import { useSincronizacaoAoVoltar } from './src/offline/useSincronizacaoAoVoltar';
// Registra o task de rastreamento em background no boot (Fase B). Sem efeito no
// Expo Go — só passa a valer no build standalone.
import './src/tracking/backgroundLocation';

/**
 * Dentro do `AuthProvider` porque só faz sentido logado — e porque sem sessão a
 * sincronização tomaria 401 e o interceptor tentaria um refresh à toa.
 */
function Conteudo() {
  const { status } = useAuth();
  useSincronizacaoAoVoltar(status === 'authenticated');
  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <UpdateBanner />
        <AuthProvider>
          <Conteudo />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}
