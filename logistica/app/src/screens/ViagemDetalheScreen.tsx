import React, { useCallback, useEffect, useState } from 'react';
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
import { processarFila as processarFilaBaixas } from '../offline/filaBaixas';
import { ehErroDeRede } from '../offline/filaFrota';
import { contarPendentesDespesaEntrega, onFilaDespesaEntregaChange, processarFilaDespesaEntrega } from '../offline/filaDespesaEntrega';
import { contarPendentesKmEntrega, onFilaKmEntregaChange, processarFilaKmEntrega, enfileirarKmEntrega } from '../offline/filaKmEntrega';
import { abrirGoogleMaps, abrirWaze, abrirRotaGoogleMaps, enderecoTexto, ligar, MAX_PARADAS_MAPS } from '../lib/navegar';
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
  // Filas offline da rota (banner + reenvio): despesa + KM de saída/retorno.
  const [pendDespesa, setPendDespesa] = useState(0);
  const [pendKm, setPendKm] = useState(0);
  const [reenviandoDespesa, setReenviandoDespesa] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setViagem(await obterViagem(viagemId));
    } catch {
      setErro('Não foi possível carregar a viagem.');
    } finally {
      setCarregando(false);
    }
  }, [viagemId]);

  // Esvazia as filas offline da rota NA ORDEM CORRETA: baixas → despesas → KM.
  // O KM (que inclui o "encerrar", terminal) vai por ÚLTIMO — senão o encerrar
  // concluiria a rota antes de uma baixa/despesa ainda pendente.
  const reenviarPendencias = useCallback(async () => {
    const total = (await contarPendentesDespesaEntrega()) + (await contarPendentesKmEntrega());
    if (total === 0) return;
    setReenviandoDespesa(true);
    try {
      await processarFilaBaixas(); // baixas primeiro (prova antes do encerrar)
      const rd = await processarFilaDespesaEntrega();
      const rk = await processarFilaKmEntrega();
      const descartadas = [...rd.descartadas, ...rk.descartadas];
      if (descartadas.length) Alert.alert('Rejeitado pelo servidor', descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n'));
      if (rk.enviadas > 0) await carregar(); // o encerrar pode ter concluído a rota
    } finally { setReenviandoDespesa(false); }
  }, [carregar]);

  // Contadores das filas ao vivo (banner).
  useEffect(() => {
    void contarPendentesDespesaEntrega().then(setPendDespesa);
    return onFilaDespesaEntregaChange(setPendDespesa);
  }, []);
  useEffect(() => {
    void contarPendentesKmEntrega().then(setPendKm);
    return onFilaKmEntregaChange(setPendKm);
  }, []);

  // Ao focar (inclusive voltando da Baixa/Despesa) recarrega e tenta reenviar as filas.
  useFocusEffect(
    useCallback(() => {
      void carregar();
      void reenviarPendencias();
    }, [carregar, reenviarPendencias]),
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
      if (ehErroDeRede(e)) {
        if (acaoKm === 'iniciar') {
          await enfileirarKmEntrega({ tipo: 'iniciar', viagemId: viagem.id, kmInicial: km });
          setViagem((v) => (v ? { ...v, kmInicial: km } : v)); // otimista: reflete o KM de saída na UI
          setAcaoKm(null);
          Alert.alert('Salvo offline', 'Sem sinal — o KM de saída vai sincronizar quando a conexão voltar.');
        } else {
          await enfileirarKmEntrega({ tipo: 'encerrar', viagemId: viagem.id, kmFinal: km });
          Alert.alert('Salvo offline', 'Sem sinal — a entrega vai ENCERRAR quando a conexão voltar.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        }
      } else {
        const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
        Alert.alert('Não foi possível', String(msg || 'Tente novamente.'));
      }
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

  // Rota completa no Google Maps com as paradas PENDENTES, na ordem da rota.
  const entregasPendentes = paradas
    .filter((p) => p.entrega?.status === 'EM_VIAGEM')
    .map((p) => p.entrega!);
  function abrirRotaCompleta() {
    if (entregasPendentes.length === 0) { Alert.alert('Rota', 'Não há entregas pendentes.'); return; }
    const lista = entregasPendentes.slice(0, MAX_PARADAS_MAPS);
    if (entregasPendentes.length > MAX_PARADAS_MAPS) {
      Alert.alert(
        'Rota completa',
        `O Google Maps aceita até ${MAX_PARADAS_MAPS} paradas por vez. Vou abrir as primeiras ${MAX_PARADAS_MAPS}; depois abra de novo para o restante.`,
        [{ text: 'Abrir', onPress: () => void abrirRotaGoogleMaps(lista) }, { text: 'Cancelar', style: 'cancel' }],
      );
      return;
    }
    void abrirRotaGoogleMaps(lista);
  }

  return (
    <FlatList
      contentContainerStyle={styles.lista}
      data={paradasFiltradas}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View>
          {(pendDespesa > 0 || pendKm > 0) && (
            <TouchableOpacity style={styles.filaBanner} onPress={() => void reenviarPendencias()} disabled={reenviandoDespesa}>
              <Text style={styles.filaBannerTxt}>
                {reenviandoDespesa
                  ? 'Reenviando pendências…'
                  : `📴 ${[
                      pendDespesa > 0 ? `${pendDespesa} despesa${pendDespesa === 1 ? '' : 's'}` : null,
                      pendKm > 0 ? `${pendKm} KM` : null,
                    ].filter(Boolean).join(' + ')} aguardando sinal — toque para reenviar`}
              </Text>
            </TouchableOpacity>
          )}
          {rastreando && (
            <View style={styles.rastreioBanner}>
              <Text style={styles.rastreioTxt}>📍 Localização ativa durante a viagem</Text>
            </View>
          )}
          <Text style={styles.cabecalho}>
            {viagem.veiculo?.placa ?? 'sem veículo'} · {paradas.length} parada
            {paradas.length === 1 ? '' : 's'}
          </Text>

          {entregasPendentes.length > 1 && (
            <TouchableOpacity style={styles.rotaCompleta} onPress={abrirRotaCompleta}>
              <Text style={styles.rotaCompletaTxt}>🗺️ Rota completa no Google Maps ({entregasPendentes.length} paradas)</Text>
            </TouchableOpacity>
          )}

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
                  {/* Sem KM de saída a rota fecha sem KM rodado (Linha do KM e
                      custo por km ficam furados). A baixa fica travada até
                      registrar — é digitar o hodômetro aqui mesmo, e o valor
                      reflete otimista, então funciona sem sinal também. */}
                  {viagem.kmInicial == null && (
                    <Text style={styles.kmAviso}>
                      ⚠ Registre o KM de saída para liberar as baixas desta rota.
                    </Text>
                  )}
                  <TouchableOpacity style={styles.kmBtnEncerrar} onPress={() => abrirAcaoKm('encerrar')}>
                    <Text style={styles.kmBtnEncerrarTxt}>🏁 Encerrar entrega (KM)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          {viagem.situacao === 'EM_CURSO' && (
            <TouchableOpacity
              style={styles.despesaBtn}
              onPress={() => navigation.navigate('DespesaEntrega', { viagemId: viagem.id, placa: viagem.veiculo?.placa })}
            >
              <Text style={styles.despesaBtnTxt}>💸 Lançar despesa (ex.: abastecer)</Text>
            </TouchableOpacity>
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
          // Trava: sem KM de saída não há baixa. O despacho (no balcão) já deixa
          // a entrega EM_VIAGEM, então o backend aceitaria — quem garante que a
          // rota "começou de verdade" é esta tela.
          bloqueadoSemKm={viagem.kmInicial == null}
          onBloqueado={() => {
            Alert.alert(
              'Registre a saída primeiro',
              'Informe o KM de saída no painel do veículo para começar as entregas desta rota.',
              [{ text: 'Registrar agora', onPress: () => abrirAcaoKm('iniciar') }, { text: 'Agora não', style: 'cancel' }],
            );
          }}
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
  bloqueadoSemKm = false,
  onBloqueado,
}: {
  parada: Parada;
  onBaixar: (e: NonNullable<Parada['entrega']>) => void;
  bloqueadoSemKm?: boolean;
  onBloqueado?: () => void;
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
        <TouchableOpacity
          style={[styles.btnBaixa, bloqueadoSemKm && styles.btnBaixaOff]}
          onPress={() => (bloqueadoSemKm ? onBloqueado?.() : onBaixar(e))}
        >
          <Text style={[styles.btnBaixaTxt, bloqueadoSemKm && styles.btnBaixaTxtOff]}>
            {bloqueadoSemKm ? '🔒 Registre o KM de saída' : '✓ Dar baixa'}
          </Text>
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
  rotaCompleta: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', marginBottom: 10 },
  rotaCompletaTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
  filaBanner: { backgroundColor: '#f59e0b', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8 },
  filaBannerTxt: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  despesaBtn: { borderWidth: 1, borderColor: '#b45309', backgroundColor: '#fffbeb', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', marginBottom: 10 },
  despesaBtnTxt: { color: '#b45309', fontWeight: '700', fontSize: 13 },
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
  // Travado: cinza e "apagado", mas AINDA tocável — o toque explica o porquê e
  // oferece registrar o KM na hora. Botão morto deixaria o entregador sem saída.
  btnBaixaOff: { backgroundColor: '#e2e8f0' },
  btnBaixaTxtOff: { color: '#64748b' },
  kmAviso: { width: '100%', color: '#b45309', fontSize: 12, fontWeight: '600' },
});
