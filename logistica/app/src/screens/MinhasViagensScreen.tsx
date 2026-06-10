import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useAuth } from '../auth/AuthContext';
import { minhasViagens } from '../api/viagens';
import type { Viagem } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'MinhasViagens'>;

export function MinhasViagensScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setViagens(await minhasViagens());
    } catch {
      setErro('Não foi possível carregar as viagens.');
    }
  }, []);

  // Recarrega ao focar a tela (volta do detalhe, etc.).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        setCarregando(true);
        await carregar();
        if (ativo) setCarregando(false);
      })();
      return () => {
        ativo = false;
      };
    }, [carregar]),
  );

  const onRefresh = useCallback(async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }, [carregar]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => void logout()}>
          <Text style={styles.sair}>Sair</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={CAPUL} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={viagens.length === 0 ? styles.vazioWrap : styles.lista}
      data={viagens}
      keyExtractor={(v) => v.id}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={onRefresh} tintColor={CAPUL} />}
      ListEmptyComponent={
        <Text style={styles.vazio}>
          {erro || 'Nenhuma viagem em curso no momento.\nArraste para baixo para atualizar.'}
        </Text>
      }
      renderItem={({ item }) => {
        const paradas = item.paradas?.length ?? 0;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('ViagemDetalhe', { viagemId: item.id, numero: item.numero })}
          >
            <View style={styles.cardTopo}>
              <Text style={styles.cardNum}>Viagem #{item.numero}</Text>
              <Text style={styles.badge}>{item.situacao}</Text>
            </View>
            <Text style={styles.cardInfo}>
              {item.veiculo?.placa ?? 'sem veículo'} · {paradas} parada{paradas === 1 ? '' : 's'} ·{' '}
              {item.totalVolumes ?? 0} volume{(item.totalVolumes ?? 0) === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista: { padding: 12, gap: 10 },
  vazioWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  vazio: { textAlign: 'center', color: '#64748b', fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNum: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  badge: {
    backgroundColor: '#dcfce7',
    color: CAPUL,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardInfo: { color: '#475569', fontSize: 14, marginTop: 6 },
  sair: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
