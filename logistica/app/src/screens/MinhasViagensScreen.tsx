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
import { contarPendentesDespesaEntrega, onFilaDespesaEntregaChange, processarFilaDespesaEntrega } from '../offline/filaDespesaEntrega';
import { contarPendentesKmEntrega, onFilaKmEntregaChange, processarFilaKmEntrega } from '../offline/filaKmEntrega';
import type { Viagem } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'MinhasViagens'>;

export function MinhasViagensScreen({ navigation }: Props) {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [pendentes, setPendentes] = useState(0);
  const [pendentesDespesa, setPendentesDespesa] = useState(0);
  const [pendentesKm, setPendentesKm] = useState(0);
  const [reenviando, setReenviando] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setViagens(await minhasViagens());
    } catch {
      setErro('Não foi possível carregar as viagens.');
    }
  }, []);

  // Esvazia as filas offline NA ORDEM QUE O SERVIDOR EXIGE:
  //   KM de saída → baixas → despesas → KM de retorno (encerrar).
  //
  // ⚠️ O KM de saída ABRE a rota e vai PRIMEIRO. Antes as baixas subiam na frente
  // dele: o servidor recusava cada uma ("Registre o KM de saída…"), e esta fila
  // trata 4xx como rejeição definitiva — **descartava a baixa e apagava a foto**,
  // perdendo a prova de entrega de quem trabalhou sem sinal. O 'encerrar' segue por
  // último: é terminal, e antes das baixas seria recusado por elas.
  const reenviarFila = useCallback(async () => {
    if ((await contarPendentes()) === 0 && (await contarPendentesDespesaEntrega()) === 0 && (await contarPendentesKmEntrega()) === 0) return;
    setReenviando(true);
    try {
      const rkIni = await processarFilaKmEntrega({ apenas: 'iniciar' });
      // KM de saída recusado = no servidor a rota continua sem KM. Subir as baixas
      // agora seria perdê-las com a foto — segura e devolve o motivo.
      if (rkIni.descartadas.length > 0) {
        Alert.alert(
          'KM de saída recusado',
          `${rkIni.descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n')}\n\n` +
            'As baixas continuam guardadas no aparelho. Abra a rota e registre o KM de saída de novo.',
        );
        await carregar();
        return;
      }
      const r = await processarFila();
      if (r.descartadas.length > 0) {
        Alert.alert(
          'Baixas rejeitadas pelo servidor',
          r.descartadas.map((d) => `#${d.entregaNumero}: ${d.motivo}`).join('\n'),
        );
      }
      const rd = await processarFilaDespesaEntrega();
      const rk = await processarFilaKmEntrega({ apenas: 'encerrar' });
      const descartadas = [...rd.descartadas, ...rk.descartadas];
      if (descartadas.length > 0) {
        Alert.alert(
          'Rejeitado pelo servidor',
          descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n'),
        );
      }
      if (rkIni.enviadas > 0 || r.enviadas > 0 || rk.enviadas > 0) await carregar();
    } finally {
      setReenviando(false);
    }
  }, [carregar]);

  // Contadores das filas ao vivo (banner).
  useEffect(() => {
    void contarPendentes().then(setPendentes);
    return onFilaChange(setPendentes);
  }, []);
  useEffect(() => {
    void contarPendentesDespesaEntrega().then(setPendentesDespesa);
    return onFilaDespesaEntregaChange(setPendentesDespesa);
  }, []);
  useEffect(() => {
    void contarPendentesKmEntrega().then(setPendentesKm);
    return onFilaKmEntregaChange(setPendentesKm);
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
      {(pendentes > 0 || pendentesDespesa > 0 || pendentesKm > 0) && (
        <TouchableOpacity style={styles.fila} onPress={() => void reenviarFila()} disabled={reenviando}>
          <Text style={styles.filaTxt}>
            {reenviando
              ? 'Reenviando pendências…'
              : `${[
                  pendentes > 0 ? `${pendentes} baixa${pendentes === 1 ? '' : 's'}` : null,
                  pendentesDespesa > 0 ? `${pendentesDespesa} despesa${pendentesDespesa === 1 ? '' : 's'}` : null,
                  pendentesKm > 0 ? `${pendentesKm} KM` : null,
                ].filter(Boolean).join(' + ')} aguardando sinal — toque para reenviar`}
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
