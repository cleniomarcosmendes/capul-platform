import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { MinhasViagensScreen } from '../screens/MinhasViagensScreen';
import { ViagemDetalheScreen } from '../screens/ViagemDetalheScreen';

export type RootStackParamList = {
  Login: undefined;
  MinhasViagens: undefined;
  ViagemDetalhe: { viagemId: string; numero: number };
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
              name="MinhasViagens"
              component={MinhasViagensScreen}
              options={{ title: 'Minhas viagens' }}
            />
            <Stack.Screen
              name="ViagemDetalhe"
              component={ViagemDetalheScreen}
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
