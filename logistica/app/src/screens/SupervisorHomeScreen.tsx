import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { listarViagensSupervisor, type ViagemSup } from '../api/supervisor';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'SupervisorHome'>;

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const PLAN_LABEL: Record<string, string> = {
  RASCUNHO: 'Em preparação', ENVIADO: 'Enviado (aguarda coordenador)', APROVADO: 'Aprovado',
  AJUSTADO: 'Ajustado (revisar)', REJEITADO: 'Rejeitado', EM_EXECUCAO: 'Em execução', CONCLUIDO: 'Concluído',
};
const planLabel = (s?: string | null) => (s ? PLAN_LABEL[s] ?? s : '—');

/** Viagens mensais em curso do supervisor (RDV) — registrar visitas e despesas em campo. */
export function SupervisorHomeScreen({ navigation }: Props) {
  const [viagens, setViagens] = useState<ViagemSup[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try { setViagens(await listarViagensSupervisor('EM_CURSO')); }
    catch { setErro('Não foi possível carregar as viagens.'); }
  }, []);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => { setCarregando(true); await carregar(); if (ativo) setCarregando(false); })();
    return () => { ativo = false; };
  }, [carregar]));

  if (carregando) return <View style={styles.center}><ActivityIndicator size="large" color={CAPUL} /></View>;

  return (
    <FlatList
      data={viagens}
      keyExtractor={(v) => v.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={async () => { setAtualizando(true); await carregar(); setAtualizando(false); }} />}
      ListEmptyComponent={<Text style={styles.vazio}>{erro || 'Nenhuma viagem em curso.'}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SupervisorViagem', { viagemId: item.id, numero: item.numero })}>
          <Text style={styles.cardTitle}>Planejamento #{item.numero} · {fmtMes(item.mesReferencia)}</Text>
          <Text style={styles.cardSub}>{item.condutorNome ?? '—'} · {planLabel(item.statusPlanejamento)}</Text>
          <Text style={styles.cardSub}>Adiantamento: {brl(item.adiantamento)} · {item._count?.paradas ?? 0} visita(s) · {item._count?.despesas ?? 0} despesa(s)</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  vazio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: CAPUL },
  cardSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
