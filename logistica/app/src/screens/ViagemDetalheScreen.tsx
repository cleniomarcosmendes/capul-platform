import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { isAxiosError } from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { obterViagem, iniciarEntrega, encerrarEntrega } from '../api/viagens';
import { abrirGoogleMaps, abrirWaze, enderecoTexto, ligar } from '../lib/navegar';
import { useRastreamento } from '../lib/useRastreamento';
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
  // "Iniciar/Encerrar entrega" — captura do KM (hodômetro) no painel do veículo.
  const [acaoKm, setAcaoKm] = useState<null | 'iniciar' | 'encerrar'>(null);
  const [kmInput, setKmInput] = useState('');
  const [salvandoKm, setSalvandoKm] = useState(false);

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

  // Rastreamento foreground enquanto a viagem está em curso (Fase A).
  const { rastreando } = useRastreamento(viagemId, viagem?.situacao === 'EM_CURSO');

  function abrirAcaoKm(acao: 'iniciar' | 'encerrar') {
    // Sugere o KM com base no odômetro do veículo (mantido por todas as viagens);
    // no encerrar, parte do KM de saída desta rota.
    const base = acao === 'iniciar'
      ? (viagem?.veiculo?.kmAtual ?? viagem?.kmInicial)
      : (viagem?.kmInicial ?? viagem?.veiculo?.kmAtual);
    setKmInput(base != null ? String(base) : '');
    setAcaoKm(acao);
  }

  async function confirmarKm() {
    if (!viagem || kmInput === '') return;
    const km = Number(kmInput);
    if (!Number.isFinite(km) || km < 0) { Alert.alert('KM', 'Informe um KM válido.'); return; }
    if (acaoKm === 'encerrar' && viagem.kmInicial != null && km < viagem.kmInicial) {
      Alert.alert('KM de retorno', `O KM de retorno (${km}) é menor que o KM de saída (${viagem.kmInicial}).`);
      return;
    }
    setSalvandoKm(true);
    try {
      if (acaoKm === 'iniciar') {
        await iniciarEntrega(viagem.id, km);
        setAcaoKm(null);
        await carregar();
      } else {
        await encerrarEntrega(viagem.id, km);
        Alert.alert('Entrega encerrada', 'Rota concluída e veículo liberado.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
      Alert.alert('Não foi possível', String(msg || 'Tente novamente.'));
    } finally {
      setSalvandoKm(false);
    }
  }

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
          {rastreando && (
            <View style={styles.rastreioBanner}>
              <Text style={styles.rastreioTxt}>📍 Localização ativa durante a viagem</Text>
            </View>
          )}
          <Text style={styles.cabecalho}>
            {viagem.veiculo?.placa ?? 'sem veículo'} · {paradas.length} parada
            {paradas.length === 1 ? '' : 's'}
          </Text>

          {viagem.situacao === 'EM_CURSO' && (
            <View style={styles.kmBox}>
              {acaoKm ? (
                <>
                  <Text style={styles.kmTitulo}>{acaoKm === 'iniciar' ? '🚚 KM de saída' : '🏁 KM de retorno'}</Text>
                  <Text style={styles.kmDica}>
                    {acaoKm === 'iniciar'
                      ? 'Leia o hodômetro do painel ao sair.'
                      : `Leia o hodômetro ao chegar (≥ ${viagem.kmInicial ?? 0}).`}
                  </Text>
                  <TextInput style={styles.kmInput} value={kmInput} onChangeText={setKmInput} keyboardType="numeric" placeholder="KM no painel" editable={!salvandoKm} />
                  <View style={styles.kmBtns}>
                    <TouchableOpacity style={[styles.kmConfirmar, salvandoKm && { opacity: 0.5 }]} onPress={() => void confirmarKm()} disabled={salvandoKm}>
                      {salvandoKm ? <ActivityIndicator color="#fff" /> : <Text style={styles.kmConfirmarTxt}>{acaoKm === 'iniciar' ? 'Iniciar entrega' : 'Encerrar entrega'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.kmCancelar} onPress={() => setAcaoKm(null)} disabled={salvandoKm}><Text style={styles.kmCancelarTxt}>Cancelar</Text></TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.kmAcoes}>
                  {viagem.kmInicial == null ? (
                    <TouchableOpacity style={styles.kmBtnIniciar} onPress={() => abrirAcaoKm('iniciar')}>
                      <Text style={styles.kmBtnIniciarTxt}>🚚 Iniciar entrega (KM)</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.kmInfo}>🚚 KM de saída: {viagem.kmInicial}</Text>
                  )}
                  <TouchableOpacity style={styles.kmBtnEncerrar} onPress={() => abrirAcaoKm('encerrar')}>
                    <Text style={styles.kmBtnEncerrarTxt}>🏁 Encerrar entrega (KM)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
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
  kmBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10, gap: 8 },
  kmAcoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  kmInfo: { fontSize: 13, fontWeight: '600', color: '#475569' },
  kmBtnIniciar: { backgroundColor: CAPUL, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  kmBtnIniciarTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  kmBtnEncerrar: { borderWidth: 1, borderColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  kmBtnEncerrarTxt: { color: '#1d4ed8', fontWeight: '700', fontSize: 13 },
  kmTitulo: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  kmDica: { fontSize: 12, color: '#64748b' },
  kmInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
  kmBtns: { flexDirection: 'row', gap: 8 },
  kmConfirmar: { flex: 1, backgroundColor: CAPUL, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  kmConfirmarTxt: { color: '#fff', fontWeight: '700' },
  kmCancelar: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  kmCancelarTxt: { color: '#475569', fontWeight: '600' },
  rastreioBanner: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
  rastreioTxt: { color: '#047857', fontSize: 12, fontWeight: '600' },
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
