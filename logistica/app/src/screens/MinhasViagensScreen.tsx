import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { minhasViagens } from '../api/viagens';
import { contarPendentes, onFilaChange, processarFila } from '../offline/filaBaixas';
import type { Viagem } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'MinhasViagens'>;

export function MinhasViagensScreen({ navigation }: Props) {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [pendentes, setPendentes] = useState(0);
  const [reenviando, setReenviando] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setViagens(await minhasViagens());
    } catch {
      setErro('Não foi possível carregar as viagens.');
    }
  }, []);

  // Tenta esvaziar a fila offline; avisa o que o servidor rejeitou em definitivo.
  const reenviarFila = useCallback(async () => {
    if ((await contarPendentes()) === 0) return;
    setReenviando(true);
    try {
      const r = await processarFila();
      if (r.descartadas.length > 0) {
        Alert.alert(
          'Baixas rejeitadas pelo servidor',
          r.descartadas.map((d) => `#${d.entregaNumero}: ${d.motivo}`).join('\n'),
        );
      }
      if (r.enviadas > 0) await carregar();
    } finally {
      setReenviando(false);
    }
  }, [carregar]);

  // Contador da fila ao vivo (banner).
  useEffect(() => {
    void contarPendentes().then(setPendentes);
    return onFilaChange(setPendentes);
  }, []);

  // Recarrega ao focar a tela (volta do detalhe/baixa) e tenta reenviar a fila.
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        setCarregando(true);
        await carregar();
        if (ativo) setCarregando(false);
        void reenviarFila();
      })();
      return () => {
        ativo = false;
      };
    }, [carregar, reenviarFila]),
  );

  const onRefresh = useCallback(async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }, [carregar]);

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={CAPUL} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {pendentes > 0 && (
        <TouchableOpacity style={styles.fila} onPress={() => void reenviarFila()} disabled={reenviando}>
          <Text style={styles.filaTxt}>
            {reenviando
              ? 'Reenviando baixas pendentes…'
              : `${pendentes} baixa${pendentes === 1 ? '' : 's'} aguardando sinal — toque para reenviar`}
          </Text>
        </TouchableOpacity>
      )}
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
    </View>
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
  fila: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  filaTxt: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  sair: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
