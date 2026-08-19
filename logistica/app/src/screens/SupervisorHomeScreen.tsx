import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { listarViagensSupervisor, type ViagemSup } from '../api/supervisor';
import { comCache } from '../offline/cacheLeitura';
import { mostrarAvisosPendentes } from '../offline/mostrarAvisos';
import { FaixaOffline } from '../components/FaixaOffline';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'SupervisorHome'>;

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const PLAN_LABEL: Record<string, string> = {
  RASCUNHO: 'Em preparação', ENVIADO: 'Enviado (aguarda aprovação)', APROVADO: 'Aprovado',
  AJUSTADO: 'Ajustado (revisar)', REJEITADO: 'Rejeitado', EM_EXECUCAO: 'Em execução', CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};
const planLabel = (s?: string | null) => (s ? PLAN_LABEL[s] ?? s : '—');

/** Viagens mensais em curso do supervisor (RDV) — registrar visitas e despesas em campo. */
export function SupervisorHomeScreen({ navigation }: Props) {
  const [viagens, setViagens] = useState<ViagemSup[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [offlineEm, setOfflineEm] = useState<number | null>(null);

  // O RDV é executado em campo, na estrada — o mesmo sinal ruim da entrega.
  const carregar = useCallback(async () => {
    setErro('');
    try {
      const r = await comCache<ViagemSup[]>(
        'supervisor:viagens:EM_CURSO',
        () => listarViagensSupervisor('EM_CURSO'),
        { aoCache: (c) => { setViagens(c.dado); setCarregando(false); } },
      );
      setViagens(r.dado);
      setOfflineEm(r.deCache ? r.atualizadoEm : null);
    }
    catch { setErro('Não foi possível carregar as viagens.'); }
  }, []);

  // Spinner de tela cheia só na 1ª carga (ver MinhasViagensScreen).
  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => { await carregar(); if (ativo) setCarregando(false); })();
    void mostrarAvisosPendentes();
    return () => { ativo = false; };
  }, [carregar]));

  if (carregando) return <View style={styles.center}><ActivityIndicator size="large" color={CAPUL} /></View>;

  return (
    <>
    {offlineEm !== null && <FaixaOffline atualizadoEm={offlineEm} />}
    <FlatList
      // Android desanexa view fora da tela e ela para de receber toque (ver ViagemDetalheScreen).
      removeClippedSubviews={false}
      data={viagens}
      keyExtractor={(v) => v.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={async () => { setAtualizando(true); await carregar(); setAtualizando(false); }} />}
      ListHeaderComponent={
        <View style={styles.dica}>
          <Text style={styles.dicaTxt}>📋 O planejamento é feito no computador. Aqui você <Text style={styles.dicaB}>executa em campo</Text>: aponta as visitas, registra oportunidades e lança despesas.</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vazio}>{erro || 'Nenhum planejamento em curso. Crie no computador para executar aqui.'}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SupervisorViagem', { viagemId: item.id, numero: item.numero })}>
          <Text style={styles.cardTitle}>Planejamento #{item.numero} · {fmtMes(item.mesReferencia)}</Text>
          <Text style={styles.cardSub}>{item.condutorNome ?? '—'} · {planLabel(item.statusPlanejamento)}</Text>
          <Text style={styles.cardSub}>Adiantamento: {brl(item.adiantamento)} · {item._count?.paradas ?? 0} visita(s) · {item._count?.despesas ?? 0} despesa(s)</Text>
        </TouchableOpacity>
      )}
    />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  vazio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  dica: { backgroundColor: '#e0f2fe', borderRadius: 12, padding: 12, marginBottom: 4 },
  dicaTxt: { color: '#075985', fontSize: 13, lineHeight: 18 },
  dicaB: { fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: CAPUL },
  cardSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
