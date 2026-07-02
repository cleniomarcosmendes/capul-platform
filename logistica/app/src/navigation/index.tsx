import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MinhasViagensScreen } from '../screens/MinhasViagensScreen';
import { ViagemDetalheScreen } from '../screens/ViagemDetalheScreen';
import { BaixaScreen } from '../screens/BaixaScreen';
import { FrotaHomeScreen } from '../screens/FrotaHomeScreen';
import { SaidaFrotaScreen } from '../screens/SaidaFrotaScreen';
import { ViagemFrotaScreen } from '../screens/ViagemFrotaScreen';
import { SupervisorHomeScreen } from '../screens/SupervisorHomeScreen';
import { SupervisorViagemScreen } from '../screens/SupervisorViagemScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  MinhasViagens: undefined;
  ViagemDetalhe: { viagemId: string; numero: number };
  Baixa: { entregaId: string; entregaNumero: number; destinatario: string };
  FrotaHome: undefined;
  SaidaFrota: undefined;
  ViagemFrota: { viagemId: string; numero: number };
  SupervisorHome: undefined;
  SupervisorViagem: { viagemId: string; numero: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const CAPUL = '#1e7d3a';

export function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={CAPUL} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: CAPUL },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        {status === 'authenticated' ? (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'CAPUL Logística' }}
            />
            {/* Entregas */}
            <Stack.Screen
              name="MinhasViagens"
              component={MinhasViagensScreen}
              options={{ title: 'Minhas viagens' }}
            />
            <Stack.Screen
              name="ViagemDetalhe"
              component={ViagemDetalheScreen}
              options={({ route }) => ({ title: `Viagem #${route.params.numero}` })}
            />
            <Stack.Screen
              name="Baixa"
              component={BaixaScreen}
              options={{ title: 'Baixa de entrega' }}
            />
            {/* Frota */}
            <Stack.Screen
              name="FrotaHome"
              component={FrotaHomeScreen}
              options={{ title: 'Frota' }}
            />
            <Stack.Screen
              name="SaidaFrota"
              component={SaidaFrotaScreen}
              options={{ title: 'Registrar saída' }}
            />
            <Stack.Screen
              name="ViagemFrota"
              component={ViagemFrotaScreen}
              options={({ route }) => ({ title: `Viagem #${route.params.numero}` })}
            />
            {/* Supervisores / RDV */}
            <Stack.Screen
              name="SupervisorHome"
              component={SupervisorHomeScreen}
              options={{ title: 'Supervisores' }}
            />
            <Stack.Screen
              name="SupervisorViagem"
              component={SupervisorViagemScreen}
              options={({ route }) => ({ title: `Viagem #${route.params.numero}` })}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
