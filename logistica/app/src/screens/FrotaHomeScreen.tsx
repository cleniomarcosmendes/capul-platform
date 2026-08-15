import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { listarViagensFrota } from '../api/frota';
import type { ViagemFrota } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'FrotaHome'>;

/** Home do self-service da frota: registrar saída + viagens em curso (retorno/despesa). */
export function FrotaHomeScreen({ navigation }: Props) {
  const [viagens, setViagens] = useState<ViagemFrota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setViagens(await listarViagensFrota('EM_CURSO'));
    } catch {
      setErro('Não foi possível carregar as viagens em curso.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        setCarregando(true);
        await carregar();
        if (ativo) setCarregando(false);
      })();
      return () => { ativo = false; };
    }, [carregar]),
  );

  const onRefresh = useCallback(async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }, [carregar]);

  if (carregando) {
    return <View style={styles.centro}><ActivityIndicator size="large" color={CAPUL} /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('SaidaFrota')}>
        <Text style={styles.ctaTxt}>＋ Registrar saída de veículo</Text>
      </TouchableOpacity>

      <Text style={styles.secao}>Veículos na rua ({viagens.length})</Text>

      <FlatList
      // Android desanexa view fora da tela e ela para de receber toque (ver ViagemDetalheScreen).
      removeClippedSubviews={false}
        contentContainerStyle={viagens.length === 0 ? styles.vazioWrap : styles.lista}
        data={viagens}
        keyExtractor={(v, i) => v.id ?? `idx-${i}`}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={onRefresh} tintColor={CAPUL} />}
        ListEmptyComponent={
          <Text style={styles.vazio}>{erro || 'Nenhum veículo em viagem agora.\nArraste para baixo para atualizar.'}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('ViagemFrota', { viagemId: item.id, numero: item.numero })}
          >
            <View style={styles.cardTopo}>
              <Text style={styles.cardNum}>{item.placa}{item.modelo ? ` · ${item.modelo}` : ''}</Text>
              <Text style={styles.badge}>#{item.numero}</Text>
            </View>
            <Text style={styles.cardInfo}>Condutor: {item.condutorNome ?? '—'}</Text>
            {item.finalidade ? <Text style={styles.cardSub}>{item.finalidade}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cta: { backgroundColor: CAPUL, margin: 12, borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secao: { fontSize: 13, fontWeight: '700', color: '#475569', paddingHorizontal: 14, marginTop: 4 },
  lista: { padding: 12, gap: 10 },
  vazioWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  vazio: { textAlign: 'center', color: '#64748b', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNum: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  badge: { backgroundColor: '#dcfce7', color: CAPUL, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cardInfo: { color: '#475569', fontSize: 14, marginTop: 6 },
  cardSub: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  sair: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
