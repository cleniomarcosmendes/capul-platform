import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { obterViagem } from '../api/viagens';
import { abrirGoogleMaps, abrirWaze, enderecoTexto, ligar } from '../lib/navegar';
import type { Parada, Viagem } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'ViagemDetalhe'>;

type Filtro = 'PENDENTES' | 'ENTREGUES' | 'TODAS';

export function ViagemDetalheScreen({ route, navigation }: Props) {
  const { viagemId } = route.params;
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('PENDENTES');

  const carregar = useCallback(async () => {
    try {
      setViagem(await obterViagem(viagemId));
    } catch {
      setErro('Não foi possível carregar a viagem.');
    } finally {
      setCarregando(false);
    }
  }, [viagemId]);

  // Ao focar (inclusive voltando da Baixa) recarrega — status da parada atualiza.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={CAPUL} />
      </View>
    );
  }
  if (erro || !viagem) {
    return (
      <View style={styles.centro}>
        <Text style={styles.erro}>{erro || 'Viagem não encontrada.'}</Text>
      </View>
    );
  }

  const paradas = [...(viagem.paradas ?? [])].sort((a, b) => a.sequencia - b.sequencia);
  const nPendentes = paradas.filter((p) => p.entrega?.status === 'EM_VIAGEM').length;
  const nEntregues = paradas.filter((p) => p.entrega?.status === 'ENTREGUE').length;
  const paradasFiltradas = paradas.filter((p) => {
    if (filtro === 'TODAS') return true;
    if (filtro === 'ENTREGUES') return p.entrega?.status === 'ENTREGUE';
    return p.entrega?.status === 'EM_VIAGEM'; // PENDENTES
  });

  const chips: { id: Filtro; rotulo: string }[] = [
    { id: 'PENDENTES', rotulo: `Pendentes (${nPendentes})` },
    { id: 'ENTREGUES', rotulo: `Entregues (${nEntregues})` },
    { id: 'TODAS', rotulo: `Todas (${paradas.length})` },
  ];

  return (
    <FlatList
      contentContainerStyle={styles.lista}
      data={paradasFiltradas}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.cabecalho}>
            {viagem.veiculo?.placa ?? 'sem veículo'} · {paradas.length} parada
            {paradas.length === 1 ? '' : 's'}
          </Text>
          <View style={styles.filtros}>
            {chips.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.filtroChip, filtro === c.id && styles.filtroChipOn]}
                onPress={() => setFiltro(c.id)}
              >
                <Text style={[styles.filtroTxt, filtro === c.id && styles.filtroTxtOn]}>{c.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.vazio}>
          {paradas.length === 0
            ? 'Esta viagem não tem paradas.'
            : filtro === 'PENDENTES'
              ? 'Nenhuma entrega pendente — tudo entregue por aqui! 🎉'
              : filtro === 'ENTREGUES'
                ? 'Nenhuma entrega concluída ainda.'
                : 'Nada para mostrar.'}
        </Text>
      }
      renderItem={({ item }) => (
        <ParadaCard
          parada={item}
          onBaixar={(e) =>
            navigation.navigate('Baixa', {
              entregaId: e.id,
              entregaNumero: e.numero,
              destinatario: e.destinatarioNome,
            })
          }
        />
      )}
    />
  );
}

function ParadaCard({
  parada,
  onBaixar,
}: {
  parada: Parada;
  onBaixar: (e: NonNullable<Parada['entrega']>) => void;
}) {
  const e = parada.entrega;
  if (!e) {
    return (
      <View style={styles.card}>
        <Text style={styles.seq}>Parada {parada.sequencia}</Text>
        <Text style={styles.obs}>{parada.local ?? 'Parada sem entrega vinculada.'}</Text>
      </View>
    );
  }
  const entregue = e.status === 'ENTREGUE';
  return (
    <View style={styles.card}>
      <View style={styles.topo}>
        <Text style={styles.seq}>
          {parada.sequencia}. {e.destinatarioNome}
        </Text>
        <Text style={[styles.status, entregue && styles.statusOk]}>{e.status}</Text>
      </View>
      <Text style={styles.endereco}>{enderecoTexto(e)}</Text>
      {e.endComplemento ? <Text style={styles.linha}>Compl.: {e.endComplemento}</Text> : null}
      {e.endReferencia ? <Text style={styles.linha}>Ref.: {e.endReferencia}</Text> : null}
      <Text style={styles.linha}>
        {e.quantidadeVolumes} volume{e.quantidadeVolumes === 1 ? '' : 's'}
        {e.horario ? ` · ${e.horario}` : ''}
      </Text>
      {e.observacoes ? <Text style={styles.obs}>Obs.: {e.observacoes}</Text> : null}

      <View style={styles.acoes}>
        <TouchableOpacity style={[styles.btn, styles.btnWaze]} onPress={() => void abrirWaze(e)}>
          <Text style={styles.btnTxt}>Waze</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnMaps]} onPress={() => void abrirGoogleMaps(e)}>
          <Text style={styles.btnTxt}>Maps</Text>
        </TouchableOpacity>
        {e.telefone ? (
          <TouchableOpacity style={[styles.btn, styles.btnTel]} onPress={() => void ligar(e.telefone!)}>
            <Text style={styles.btnTxt}>Ligar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {e.status === 'EM_VIAGEM' ? (
        <TouchableOpacity style={styles.btnBaixa} onPress={() => onBaixar(e)}>
          <Text style={styles.btnBaixaTxt}>✓ Dar baixa</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  erro: { color: '#dc2626', fontSize: 15, textAlign: 'center' },
  lista: { padding: 12, gap: 10 },
  cabecalho: { color: '#475569', fontSize: 14, marginBottom: 8 },
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filtroChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  filtroChipOn: { backgroundColor: CAPUL, borderColor: CAPUL },
  filtroTxt: { color: '#334155', fontWeight: '700', fontSize: 13 },
  filtroTxtOn: { color: '#fff' },
  vazio: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seq: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, paddingRight: 8 },
  status: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  statusOk: { color: CAPUL, backgroundColor: '#dcfce7' },
  endereco: { color: '#1e293b', fontSize: 15, marginTop: 8 },
  linha: { color: '#475569', fontSize: 14, marginTop: 4 },
  obs: { color: '#64748b', fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnWaze: { backgroundColor: '#33ccff' },
  btnMaps: { backgroundColor: '#4285F4' },
  btnTel: { backgroundColor: CAPUL },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnBaixa: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  btnBaixaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
