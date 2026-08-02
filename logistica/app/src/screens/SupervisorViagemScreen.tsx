import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { SelectBusca } from '../components/SelectBusca';
import {
  obterViagemSupervisor, adicionarVisitaApp, lancarDespesaApp, apontarVisitaApp,
  removerDespesaApp, editarDespesaApp,
  iniciarExecucaoApp, concluirPlanejamentoApp, listarViagensSupervisor, papelLabel, listarVeiculosSup, decidirDespesaApp,
  listarAtividadesSup, listarTiposDespesaSup,
  meuCadastroSup, listarAdiantamentosSup,
  type ViagemSupDetalhe, type AtividadeSup, type TipoDespesaSup, type VeiculoSup, type NovaVisita, type NovaDespesa,
  type MeuCadastroSup, type AdiantamentoSup, type VisitaSup, type ViagemSup,
} from '../api/supervisor';
import { uuid } from '../lib/uuid';
import { maskMoeda, parseMoeda } from '../lib/moeda';
import { useScrollToFocusedInput } from '../lib/useScrollToFocusedInput';
import { useAuth } from '../auth/AuthContext';
import {
  enfileirarSupervisor, processarFilaSupervisor, contarPendentesSupervisor, onFilaSupervisorChange, ehErroDeRede,
} from '../offline/filaSupervisor';

const CAPUL = '#1e7d3a';
const MAX_FOTOS_DESPESA = 5;

/** GPS opcional (igual às paradas da frota): se negar permissão/falhar, segue sem
 *  coordenada — não trava a visita/apontamento. Retorna também a PRECISÃO (m), que
 *  alimenta a consolidação da localização do local (marcação imprecisa é descartada). */
async function capturarCoordenadas(): Promise<{ latitude?: number; longitude?: number; precisaoM?: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      precisaoM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : undefined,
    };
  } catch { return {}; }
}
/** Pergunta se o usuário está NO local do cliente — só "sim" alimenta a consolidação
 *  (evita gravar marcação da estrada/cidade como se fosse a propriedade). */
function confirmarNoLocal(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Você está no local do cliente?',
      'Confirme só se estiver na propriedade — isso ensina o mapa a localizar o cliente. Se marcou da estrada ou da cidade, escolha "Não estou".',
      [
        { text: 'Não estou', onPress: () => resolve(false) },
        { text: 'Sim, estou aqui', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

/** Ponto para o "Ver no mapa": prefere a coordenada CONSOLIDADA do local (aprendida);
 *  cai para o ponto bruto desta marcação; null se não há nada. */
function pontoDoMapa(p: VisitaSup): { lat: number; lng: number; consolidado: boolean; confianca?: string | null } | null {
  const lc = p.localCliente;
  if (lc?.latConsolidada != null && lc?.longConsolidada != null) {
    return { lat: Number(lc.latConsolidada), lng: Number(lc.longConsolidada), consolidado: true, confianca: lc.confianca };
  }
  if (p.latitude != null && p.longitude != null) {
    return { lat: Number(p.latitude), lng: Number(p.longitude), consolidado: false };
  }
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'SupervisorViagem'>;

const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const fmtData = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};
function msg(e: unknown, fb: string) {
  if (isAxiosError(e)) return (e.response?.data as { message?: string } | undefined)?.message || fb;
  return fb;
}

const PLAN_LABEL: Record<string, string> = {
  RASCUNHO: 'Em preparação', ENVIADO: 'Enviado (aguarda aprovação)', APROVADO: 'Aprovado',
  AJUSTADO: 'Ajustado (revisar)', REJEITADO: 'Rejeitado', EM_EXECUCAO: 'Em execução', CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};
const VIS: Record<string, { l: string; bg: string; fg: string }> = {
  PLANEJADA: { l: 'Planejada', bg: '#fef3c7', fg: '#b45309' },
  REALIZADA: { l: 'Realizada', bg: '#d1fae5', fg: '#047857' },
  PULADA: { l: 'Pulada', bg: '#f1f5f9', fg: '#64748b' },
};
const DESP: Record<string, { l: string; bg: string; fg: string }> = {
  PENDENTE: { l: 'Pendente', bg: '#fef3c7', fg: '#b45309' },
  APROVADA: { l: 'Aprovada', bg: '#d1fae5', fg: '#047857' },
  CONTESTADA: { l: 'Rejeitada', bg: '#ffe4e6', fg: '#be123c' },
};
const ADV: Record<string, { l: string; bg: string; fg: string }> = {
  PENDENTE: { l: 'Aguardando aprovação', bg: '#fef3c7', fg: '#b45309' },
  APROVADO: { l: 'Aprovado', bg: '#d1fae5', fg: '#047857' },
  REJEITADO: { l: 'Rejeitado', bg: '#ffe4e6', fg: '#be123c' },
};
/** Abre a coordenada capturada no app de mapas (Google Maps). */
function abrirNoMapa(lat: number, lng: number) {
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
}
function Badge({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeTxt, { color: fg }]}>{label}</Text></View>;
}

/** Detalhe do planejamento do supervisor: workflow (enviar/iniciar/concluir),
 *  visitas (apontar realizada/pulada na execução) e despesas (com comprovante). */
export function SupervisorViagemScreen({ route }: Props) {
  const { viagemId } = route.params;
  // Teclado: mantém o campo focado acima do teclado (hook compartilhado).
  const { scrollRef, aoFocar } = useScrollToFocusedInput();
  const { role, usuarioId } = useAuth();
  const [v, setV] = useState<ViagemSupDetalhe | null>(null);
  const [ativs, setAtivs] = useState<AtividadeSup[]>([]);
  const [tipos, setTipos] = useState<TipoDespesaSup[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [agindo, setAgindo] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  // form visita
  const [cliNome, setCliNome] = useState(''); const [muni, setMuni] = useState(''); const [ativId, setAtivId] = useState('');
  const [prop, setProp] = useState(''); const [vObs, setVObs] = useState('');
  const [salvV, setSalvV] = useState(false);
  const [showVisita, setShowVisita] = useState(false); // form de visita/oportunidade recolhido
  // form despesa
  const [tipoId, setTipoId] = useState(''); const [valor, setValor] = useState(''); const [dForn, setDForn] = useState(''); const [dObs, setDObs] = useState('');
  // Veículo DESTA despesa (só categoria VEÍCULO). Nasce com o do planejamento; trocar
  // cobre a viagem em que a pessoa pegou outro carro. Sem veículo o backend recusa —
  // o valor sumiria do custo da frota.
  const [dVeiculo, setDVeiculo] = useState(''); const [veiculos, setVeiculos] = useState<VeiculoSup[]>([]);
  const [dData, setDData] = useState(''); // data da despesa (opcional, AAAA-MM-DD → hoje se vazio)
  const [fotoUris, setFotoUris] = useState<string[]>([]); // comprovantes (fotos) — vários
  const [salvD, setSalvD] = useState(false);
  const [showDespesa, setShowDespesa] = useState(false); // form de despesa recolhido (botão)
  const [despViagemId, setDespViagemId] = useState(viagemId); // planejamento-alvo da despesa
  const [editDespId, setEditDespId] = useState<string | null>(null); // despesa em edição (senão: novo lançamento)
  const [planejamentos, setPlanejamentos] = useState<ViagemSup[]>([]); // do mês, p/ o seletor
  // Adiantamentos do mês do próprio representante — SÓ LEITURA no app (o lançamento
  // ficou no desktop, 27/07). Continua carregando porque é o que explica o saldo da RDV.
  const [meuSup, setMeuSup] = useState<MeuCadastroSup | null>(null);
  const [adiants, setAdiants] = useState<AdiantamentoSup[]>([]);

  const carregar = useCallback(async () => {
    const [d, a, t] = await Promise.all([
      obterViagemSupervisor(viagemId), listarAtividadesSup(), listarTiposDespesaSup(),
    ]);
    setV(d); setAtivs(a); setTipos(t);
    // Veículos p/ o seletor da despesa. Best-effort: sem eles a despesa ainda herda o
    // carro do planejamento — só não dá pra trocar.
    try { setVeiculos(await listarVeiculosSup()); } catch { /* silencioso */ }
    // Adiantamentos do mês (auto-serviço): resolve o próprio cadastro e lista o mês da
    // viagem. Falha aqui não bloqueia visitas/despesas (bloco isolado).
    try {
      const meu = await meuCadastroSup();
      setMeuSup(meu);
      setAdiants(meu && d.mesReferencia ? await listarAdiantamentosSup(meu.id, d.mesReferencia) : []);
    } catch { /* silencioso — não derruba o resto da tela */ }
    // Planejamentos em curso do supervisor → seletor opcional de "a qual planejamento
    // pertence" a despesa (default = este). Best-effort.
    try { setPlanejamentos(await listarViagensSupervisor('EM_CURSO')); } catch { /* silencioso */ }
  }, [viagemId]);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      await processarFilaSupervisor().catch(() => undefined); // sincroniza o que ficou offline
      try { await carregar(); } catch { Alert.alert('Erro', 'Falha ao carregar o planejamento.'); }
      if (ativo) setCarregando(false);
    })();
    void contarPendentesSupervisor().then(setPendentes);
    const off = onFilaSupervisorChange(setPendentes);
    return () => { ativo = false; off(); };
  }, [carregar]));

  const sincronizar = async () => {
    const r = await processarFilaSupervisor();
    await carregar();
    if (r.descartadas.length) Alert.alert('Alguns itens não entraram', r.descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n'));
    else if (r.enviadas) Alert.alert('Sincronizado', `${r.enviadas} registro(s) enviado(s).`);
  };

  const sp = v?.statusPlanejamento ?? null;
  // Trava os lançamentos: concluída (histórico) OU cancelada — nos dois casos o backend
  // recusa visita/despesa, então a tela não pode oferecer o que vai dar erro.
  const concluida = v?.situacao === 'CONCLUIDA' || sp === 'CANCELADO';
  const emExecucao = sp === 'EM_EXECUCAO';
  // Quem aprova (coordenador / supervisor de departamento / admin) — usado só para
  // explicar que a decisão é no desktop. O app não aprova: é ferramenta de execução.
  const podeAprovar = role === 'COORDENADOR' || role === 'SUPERVISOR_FROTA' || role === 'ADMIN';
  // Aprovado mas ainda não iniciado: há visitas planejadas esperando o "Liberar para execução".
  const temPlanejadaPendente = (v?.paradas ?? []).some((p) => (p.status ?? 'PLANEJADA') === 'PLANEJADA');

  const limparVisita = () => { setCliNome(''); setMuni(''); setAtivId(''); setProp(''); setVObs(''); };

  const salvarVisita = async () => {
    if (!cliNome.trim()) { Alert.alert('Visita', 'Informe o cliente (ou prospect).'); return; }
    setSalvV(true);
    const coords = await capturarCoordenadas();
    // Em campo a visita nasce REALIZADA — confirma se está no local (alimenta a consolidação).
    const noLocal = coords.latitude != null ? await confirmarNoLocal() : undefined;
    const payload: NovaVisita = {
      clienteNome: cliNome.trim(), municipio: muni.trim() || undefined,
      atividadeId: ativId || undefined, propriedade: prop.trim() || undefined,
      observacao: vObs.trim() || undefined, ...coords,
      ...(noLocal !== undefined ? { noLocal } : {}), idempotencyKey: uuid(),
    };
    try {
      await adicionarVisitaApp(viagemId, payload);
      limparVisita(); setShowVisita(false); await carregar();
      Alert.alert('Pronto', 'Visita registrada.');
    } catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarSupervisor({ id: payload.idempotencyKey!, rotulo: `Visita: ${payload.clienteNome}`, acao: { tipo: 'visita', viagemId, payload } });
        limparVisita();
        Alert.alert('Salvo offline', 'Sem sinal — a visita vai sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', msg(e, 'Falha ao registrar visita.')); }
    } finally { setSalvV(false); }
  };

  const apontar = async (paradaId: string, status: 'REALIZADA' | 'PULADA', motivoPulada?: string, observacao?: string) => {
    // GPS só faz sentido na visita REALIZADA (onde ele esteve); PULADA não captura.
    const coords = status === 'REALIZADA' ? await capturarCoordenadas() : {};
    // Confirmação: só marcações "no local" ensinam a localização do cliente (evita marcar
    // da estrada/cidade). Pergunta só na REALIZADA e só se houver GPS.
    const noLocal = status === 'REALIZADA' && coords.latitude != null ? await confirmarNoLocal() : undefined;
    const extra = { ...coords, ...(noLocal !== undefined ? { noLocal } : {}), ...(motivoPulada ? { motivoPulada } : {}), ...(observacao ? { observacao } : {}) };
    try { await apontarVisitaApp(viagemId, paradaId, status, extra); await carregar(); }
    catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarSupervisor({ id: uuid(), rotulo: `Apontar ${status === 'REALIZADA' ? 'realizada' : 'pulada'}`, acao: { tipo: 'apontar', viagemId, paradaId, status, ...extra } });
        Alert.alert('Salvo offline', 'Sem sinal — o apontamento vai sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', msg(e, 'Falha ao apontar a visita.')); }
    }
  };
  /**
   * Realizar abre o RELATO da visita: o que foi coletado em campo (pedido, pendência,
   * combinado com o cliente). Vai para `parada.observacao`, que já é a coluna
   * "Obs / Motivo" do relatório mensal de visitas — então o que ele escrever aqui sai
   * impresso, sem precisar voltar no computador.
   *
   * Nasce preenchido com a observação que já estiver na visita (a anotação de quando o
   * roteiro foi montado, muitas vezes escrita pelo coordenador): assim ele COMPLEMENTA
   * em vez de apagar sem ver. O campo é opcional — dá para realizar sem escrever nada.
   */
  const [relatoId, setRelatoId] = useState<string | null>(null);
  const [relato, setRelato] = useState('');
  const [relatando, setRelatando] = useState(false);
  const abrirRelato = (p: VisitaSup) => { setRelatoId(p.id); setRelato(p.observacao ?? ''); };
  const confirmarRealizada = async () => {
    if (!relatoId) return;
    setRelatando(true);
    try { await apontar(relatoId, 'REALIZADA', undefined, relato.trim() || undefined); setRelatoId(null); setRelato(''); }
    finally { setRelatando(false); }
  };

  // Pular exige justificativa → abre o modal; confirmar chama apontar(..., 'PULADA', motivo).
  const [pularId, setPularId] = useState<string | null>(null);
  const [motivoPular, setMotivoPular] = useState('');
  const [pulando, setPulando] = useState(false);
  const confirmarPular = async () => {
    if (!pularId || !motivoPular.trim()) return;
    setPulando(true);
    try { await apontar(pularId, 'PULADA', motivoPular.trim()); setPularId(null); setMotivoPular(''); }
    finally { setPulando(false); }
  };

  const acao = async (fn: (id: string) => Promise<void>, ok: string) => {
    setAgindo(true);
    try { await fn(viagemId); await carregar(); Alert.alert('Pronto', ok); }
    catch (e) { Alert.alert('Erro', msg(e, 'Falha na ação.')); } finally { setAgindo(false); }
  };

  const tirarFoto = async () => {
    if (fotoUris.length >= MAX_FOTOS_DESPESA) { Alert.alert('Comprovantes', `Máximo de ${MAX_FOTOS_DESPESA} fotos.`); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Comprovante', 'Permita o acesso à câmera para fotografar o recibo.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!r.canceled && r.assets[0]?.uri) setFotoUris((prev) => [...prev, r.assets[0].uri].slice(0, MAX_FOTOS_DESPESA));
  };
  const escolherFotos = async () => {
    const restante = MAX_FOTOS_DESPESA - fotoUris.length;
    if (restante <= 0) { Alert.alert('Comprovantes', `Máximo de ${MAX_FOTOS_DESPESA} fotos.`); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: restante, quality: 0.6 });
    if (!r.canceled) setFotoUris((prev) => [...prev, ...r.assets.map((a) => a.uri)].slice(0, MAX_FOTOS_DESPESA));
  };
  const removerFoto = (i: number) => setFotoUris((prev) => prev.filter((_, idx) => idx !== i));

  // Confere a despesa que OUTRA pessoa lançou no meu RDV (o coordenador digitou o
  // comprovante que eu mandei). Contestar exige motivo — vira a justificativa que ele lê.
  const [naoReconhecoId, setNaoReconhecoId] = useState<string | null>(null);
  const [motivoNaoRec, setMotivoNaoRec] = useState('');
  const conferirDespesa = async (despesaId: string, decisao: 'APROVADA' | 'CONTESTADA', motivo?: string) => {
    try {
      await decidirDespesaApp(viagemId, despesaId, decisao, motivo);
      setNaoReconhecoId(null); setMotivoNaoRec('');
      await carregar();
      Alert.alert('Pronto', decisao === 'APROVADA' ? 'Despesa confirmada.' : 'Despesa devolvida a quem lançou.');
    } catch (e) { Alert.alert('Erro', msg(e, 'Falha ao conferir a despesa.')); }
  };

  const limparDespesa = () => { setDVeiculo(''); setTipoId(''); setValor(''); setDData(''); setDForn(''); setDObs(''); setFotoUris([]); setEditDespId(null); setDespViagemId(viagemId); };
  // Abre o form já preenchido com a despesa (edição de tipo/valor/fornecedor/obs — os
  // comprovantes ficam como estão). Só metadados: por isso escondemos foto/planejamento.
  const abrirEdicaoDesp = (d: ViagemSupDetalhe['despesas'][number]) => {
    setEditDespId(d.id);
    setTipoId(d.tipoDespesaId ?? (d.tipoDespesa ? (tipos.find((t) => t.nome === d.tipoDespesa?.nome)?.id ?? '') : ''));
    setDVeiculo(d.veiculoId ?? v?.veiculoId ?? '');
    setValor(maskMoeda(String(Math.round(Number(d.valor) * 100))));
    setDData(d.dataDespesa ? String(d.dataDespesa).slice(0, 10) : '');
    setDForn(d.fornecedor ?? ''); setDObs(d.observacao ?? ''); setFotoUris([]);
    setShowDespesa(true);
  };

  const salvarDespesa = async () => {
    if (!tipoId || parseMoeda(valor) <= 0) { Alert.alert('Despesa', 'Escolha o tipo e informe o valor.'); return; }
    if (dData.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dData.trim())) { Alert.alert('Despesa', 'Data inválida — use o formato AAAA-MM-DD (ou deixe vazio para hoje).'); return; }
    const data = dData.trim() || undefined; // vazio → backend usa hoje
    setSalvD(true);
    // Edição: só atualiza os dados da despesa (online — não vai pra fila offline).
    if (editDespId) {
      try {
        await editarDespesaApp(viagemId, editDespId, {
          tipoDespesaId: tipoId, valor: parseMoeda(valor), data,
          fornecedor: dForn.trim() || undefined, observacao: dObs.trim() || undefined,
          veiculoId: dVeiculo || undefined,
        });
        limparDespesa(); setShowDespesa(false); await carregar();
        Alert.alert('Pronto', 'Despesa atualizada.');
      } catch (e) { Alert.alert('Erro', msg(e, 'Falha ao editar a despesa.')); } finally { setSalvD(false); }
      return;
    }
    const fotos = fotoUris;
    const payload: NovaDespesa = {
      tipoDespesaId: tipoId, valor: parseMoeda(valor), data,
      fornecedor: dForn.trim() || undefined, observacao: dObs.trim() || undefined,
      veiculoId: dVeiculo || undefined, idempotencyKey: uuid(),
    };
    try {
      const situacao = await lancarDespesaApp(despViagemId, payload, fotos);
      limparDespesa(); setShowDespesa(false); await carregar();
      Alert.alert('Pronto', situacao === 'APROVADA' ? 'Despesa lançada e já aprovada.' : 'Despesa lançada (aguarda aprovação do coordenador).');
    } catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarSupervisor({ id: payload.idempotencyKey!, rotulo: `Despesa: ${brl(payload.valor)}`, acao: { tipo: 'despesa', viagemId: despViagemId, payload, fotoUris: fotos } });
        limparDespesa(); setShowDespesa(false);
        Alert.alert('Salvo offline', 'Sem sinal — a despesa (e as fotos) vão sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', msg(e, 'Falha ao lançar despesa.')); }
    } finally { setSalvD(false); }
  };
  const removerDespesa = (id: string) => {
    Alert.alert('Remover despesa', 'Confirma remover esta despesa? Os comprovantes anexados também serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try { await removerDespesaApp(viagemId, id); await carregar(); }
        catch (e) { Alert.alert('Erro', msg(e, 'Falha ao remover a despesa.')); }
      } },
    ]);
  };

  if (carregando) return <View style={styles.center}><ActivityIndicator size="large" color={CAPUL} /></View>;
  if (!v) return <View style={styles.center}><Text>Planejamento não encontrado.</Text></View>;

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      {pendentes > 0 && (
        <TouchableOpacity style={styles.banner} onPress={() => void sincronizar()}>
          <Text style={styles.bannerTxt}>📴 {pendentes} registro(s) aguardando sinal — toque para reenviar</Text>
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <Text style={styles.hTitle}>Planejamento #{v.numero} · {fmtMes(v.mesReferencia)}</Text>
        <Text style={styles.hSub}>{papelLabel(v.papelRepresentante)}: {v.condutorNome ?? '—'} · Adiant.: {brl(v.adiantamento)}</Text>
        <View style={styles.hStatus}><Badge bg="#e2e8f0" fg="#334155" label={sp ? PLAN_LABEL[sp] ?? sp : '—'} /></View>
        {v.comentarioCoordenador && (sp === 'AJUSTADO' || sp === 'REJEITADO') && (
          <Text style={styles.coment}>Coordenador: {v.comentarioCoordenador}</Text>
        )}
        <View style={styles.wfRow}>
          {sp === 'APROVADO' && (
            <TouchableOpacity style={[styles.wfBtn, agindo && styles.btnOff]} disabled={agindo} onPress={() => void acao(iniciarExecucaoApp, 'Viagem liberada para execução.')}><Text style={styles.wfBtnTxt}>Liberar para execução</Text></TouchableOpacity>
          )}
          {emExecucao && (
            <TouchableOpacity style={[styles.wfBtn, styles.wfBtnAlt, agindo && styles.btnOff]} disabled={agindo} onPress={() => void acao(concluirPlanejamentoApp, 'Planejamento concluído.')}><Text style={[styles.wfBtnTxt, styles.wfBtnTxtAlt]}>Concluir</Text></TouchableOpacity>
          )}
        </View>
        {sp === 'CANCELADO' && (
          <Text style={styles.cancelado}>
            ⛔ Planejamento cancelado{v.motivoCancelamento ? ` — ${v.motivoCancelamento}` : ''}. Não aceita mais visitas nem despesas.
          </Text>
        )}
        {(sp === 'RASCUNHO' || sp === 'AJUSTADO' || sp === 'REJEITADO' || sp === 'ENVIADO') && (
          <Text style={styles.coment}>✎ O planejamento é montado e enviado ao coordenador no computador. Aqui você executa quando aprovado.</Text>
        )}
        {/* O app é EXECUÇÃO: aprovar/ajustar/rejeitar e cancelar ficam no desktop. Sem
            este aviso, o coordenador abria um planejamento ENVIADO e não achava o que
            fazer — a única pendência da tela era justamente a que ele não pode resolver aqui. */}
        {sp === 'ENVIADO' && podeAprovar && (
          <Text style={styles.coment}>🖥️ A aprovação é feita no computador (Entregas › Supervisores › Coordenação). O app é para a execução em campo.</Text>
        )}
      </View>

      {meuSup && (
        <View style={styles.card}>
          <Text style={styles.sTitle}>Adiantamentos do mês ({fmtMes(v.mesReferencia)})</Text>
          {adiants.length === 0 ? (
            <Text style={styles.vazio}>Nenhum adiantamento neste mês.</Text>
          ) : adiants.map((a) => {
            const st = ADV[a.situacao ?? 'APROVADO'] ?? { l: a.situacao ?? '—', bg: '#f1f5f9', fg: '#64748b' };
            return (
              <View key={a.id} style={styles.advRow}>
                <View style={styles.advInfo}>
                  <View style={styles.advTop}>
                    <Text style={styles.advVal}>{brl(a.valor)}</Text>
                    <Badge bg={st.bg} fg={st.fg} label={st.l} />
                  </View>
                  <Text style={styles.itemSub}>{fmtData(a.dataAdiantamento)}{a.observacao ? ` · ${a.observacao}` : ''}</Text>
                  {a.situacao === 'REJEITADO' && a.motivoRejeicao ? <Text style={styles.advRej}>Motivo: {a.motivoRejeicao}</Text> : null}
                </View>
              </View>
            );
          })}
          {/* Adiantamento é SÓ LEITURA no app (27/07): lançar/remover ficou no desktop.
              A lista fica porque é ela que explica o saldo da RDV para quem está em campo. */}
          <Text style={styles.coment}>💻 O lançamento do adiantamento é feito no computador (Entregas › Supervisores).</Text>
        </View>
      )}

      {emExecucao && (showVisita ? (
        <View style={styles.card}>
          <Text style={styles.sTitle}>Registrar visita / oportunidade</Text>
          <Text style={styles.hint}>Visita fora do plano: cliente atendido ou um prospect (oportunidade) que surgiu na viagem. Entra como Realizada.</Text>
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Cliente / prospect" value={cliNome} onChangeText={setCliNome} />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Município" value={muni} onChangeText={setMuni} />
          <SelectBusca valor={ativId} opcoes={ativs.map((a) => ({ id: a.id, nome: a.nome }))} onChange={setAtivId} placeholder="Atividade" permiteLimpar />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Propriedade / fazenda (se rural)" value={prop} onChangeText={setProp} />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Observação" value={vObs} onChangeText={setVObs} />
          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnFlex, salvV && styles.btnOff]} onPress={() => void salvarVisita()} disabled={salvV}>
              <Text style={styles.btnTxt}>{salvV ? 'Salvando…' : 'Registrar visita'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { limparVisita(); setShowVisita(false); }} disabled={salvV}><Text style={styles.cancelTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowVisita(true)}><Text style={styles.addBtnTxt}>＋ Registrar visita / oportunidade</Text></TouchableOpacity>
      ))}

      <Text style={styles.listTitle}>Visitas ({v.paradas.length})</Text>
      {sp === 'APROVADO' && temPlanejadaPendente && (
        <Text style={styles.hint}>Planejamento aprovado. Toque em “Liberar para execução” (no topo) para apontar as visitas como realizadas ou puladas.</Text>
      )}
      {sp === 'ENVIADO' && temPlanejadaPendente && (
        <Text style={styles.hint}>Enviado — aguardando o coordenador aprovar. Depois você inicia a execução e aponta as visitas.</Text>
      )}
      {v.paradas.length === 0 && <Text style={styles.vazio}>Nenhuma visita ainda.</Text>}
      {v.paradas.map((p) => {
        const st = VIS[p.status ?? 'REALIZADA'] ?? { l: p.status ?? '—', bg: '#f1f5f9', fg: '#64748b' };
        return (
          <View key={p.id} style={styles.item}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle}>{p.clienteNome ?? '—'}{p.municipio ? ` · ${p.municipio}` : ''}</Text>
              <Badge bg={st.bg} fg={st.fg} label={st.l} />
            </View>
            <Text style={styles.itemSub}>{p.atividade?.nome ?? '—'}{p.propriedade ? ` · ${p.propriedade}` : ''}</Text>
            {p.status === 'PULADA' && p.motivoPulada ? (
              <Text style={styles.motivoPulada}>Motivo: {p.motivoPulada}</Text>
            ) : null}
            {(() => {
              const m = pontoDoMapa(p);
              if (!m) return null;
              const rotulo = m.consolidado
                ? `📍 Ver local no mapa${m.confianca === 'PROVISORIA' ? ' (provisório)' : ''}`
                : '📍 Ver marcação desta visita';
              return (
                <TouchableOpacity onPress={() => abrirNoMapa(m.lat, m.lng)}>
                  <Text style={styles.mapLink}>{rotulo}</Text>
                </TouchableOpacity>
              );
            })()}
            {emExecucao && p.status === 'PLANEJADA' && (
              <View style={styles.apRow}>
                <TouchableOpacity style={[styles.apBtn, styles.apOk]} onPress={() => abrirRelato(p)}><Text style={styles.apOkTxt}>Realizar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.apBtn} onPress={() => { setPularId(p.id); setMotivoPular(''); }}><Text style={styles.apTxt}>Pular</Text></TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {!concluida && (showDespesa ? (
        <View style={styles.card}>
          <Text style={styles.sTitle}>{editDespId ? 'Editar despesa' : 'Lançar despesa'}</Text>
          {!editDespId && planejamentos.length > 1 && (
            <SelectBusca valor={despViagemId} opcoes={planejamentos.map((p) => ({ id: p.id, nome: `Planejamento #${p.numero}${p.id === viagemId ? ' (este)' : ''}`, subtitulo: fmtMes(p.mesReferencia) }))} onChange={setDespViagemId} placeholder="A qual planejamento pertence" />
          )}
          <SelectBusca
            valor={tipoId}
            opcoes={tipos.map((t) => ({ id: t.id, nome: t.nome, subtitulo: t.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo' }))}
            onChange={(novo) => {
              setTipoId(novo);
              // Tipo de VEÍCULO e campo ainda vazio → puxa o carro do planejamento
              // (caso normal), deixando a troca para quem pegou outro carro.
              if (tipos.find((t) => t.id === novo)?.categoria === 'VEICULO' && !dVeiculo) setDVeiculo(v?.veiculoId ?? '');
            }}
            placeholder="Tipo de despesa"
          />
          {/* Só na categoria VEÍCULO: alimentação/hospedagem é do indivíduo. Sem carro
              o backend recusa — o valor não chegaria em Custos da Frota. */}
          {tipos.find((t) => t.id === tipoId)?.categoria === 'VEICULO' && (
            <SelectBusca
              valor={dVeiculo}
              opcoes={veiculos.filter((ve) => ve.ativo !== false).map((ve) => ({ id: ve.id, nome: ve.placa, subtitulo: ve.modelo ?? undefined }))}
              onChange={setDVeiculo}
              placeholder="Veículo desta despesa"
            />
          )}
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Valor R$ 0,00" keyboardType="decimal-pad" value={valor} onChangeText={(t) => setValor(maskMoeda(t))} />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Data AAAA-MM-DD (opcional — hoje)" value={dData} onChangeText={setDData} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Fornecedor" value={dForn} onChangeText={setDForn} />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Observação" value={dObs} onChangeText={setDObs} />
          {editDespId ? (
            <Text style={styles.dica}>Os comprovantes anexados não mudam na edição.</Text>
          ) : (<>
            <Text style={styles.fLabel}>Comprovantes (opcional, até {MAX_FOTOS_DESPESA})</Text>
            {fotoUris.length > 0 && (
              <View style={styles.thumbs}>
                {fotoUris.map((uri, i) => (
                  <View key={i} style={styles.thumbBox}>
                    <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.thumbX} onPress={() => removerFoto(i)} disabled={salvD}><Text style={styles.thumbXTxt}>✕</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {fotoUris.length < MAX_FOTOS_DESPESA && (
              <View style={styles.fotoBtns}>
                <TouchableOpacity style={[styles.btnFoto, styles.btnFotoFlex]} onPress={() => void tirarFoto()} disabled={salvD}><Text style={styles.btnFotoTxt}>📷 Fotografar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnFoto, styles.btnFotoFlex]} onPress={() => void escolherFotos()} disabled={salvD}><Text style={styles.btnFotoTxt}>🖼️ Galeria</Text></TouchableOpacity>
              </View>
            )}
          </>)}
          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnFlex, salvD && styles.btnOff]} onPress={() => void salvarDespesa()} disabled={salvD}>
              <Text style={styles.btnTxt}>{salvD ? 'Salvando…' : editDespId ? 'Salvar alterações' : 'Lançar despesa'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { limparDespesa(); setShowDespesa(false); }} disabled={salvD}><Text style={styles.cancelTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => { limparDespesa(); setShowDespesa(true); }}><Text style={styles.addBtnTxt}>＋ Lançar despesa</Text></TouchableOpacity>
      ))}

      <Text style={styles.listTitle}>Despesas ({v.despesas.length})</Text>
      {v.despesas.length === 0 && <Text style={styles.vazio}>Nenhuma despesa ainda.</Text>}
      {v.despesas.map((d) => {
        const st = DESP[d.situacao ?? 'PENDENTE'] ?? { l: d.situacao ?? '—', bg: '#f1f5f9', fg: '#64748b' };
        return (
          <View key={d.id} style={styles.item}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle}>{d.tipoDespesa?.nome ?? '—'} · {brl(d.valor)}</Text>
              <Badge bg={st.bg} fg={st.fg} label={st.l} />
            </View>
            <Text style={styles.itemSub}>{d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo'}{(() => { const n = (d.anexos?.length ?? 0) + (d.comprovanteObjectKey ? 1 : 0); return n ? ` · 📎 ${n} comprovante${n > 1 ? 's' : ''}` : ''; })()}</Text>
            {/* Conferência: a despesa entra na conta do REPRESENTANTE, então quando
                OUTRA pessoa lança no RDV dele (o coordenador digitando um comprovante
                que ele mandou) é ELE quem confirma. Quem lançou não aprova o próprio. */}
            {!concluida && d.situacao === 'PENDENTE' && !!d.criadoPorId && d.criadoPorId !== usuarioId && (
              <View style={styles.itemAcoes}>
                <TouchableOpacity onPress={() => void conferirDespesa(d.id, 'APROVADA')}><Text style={styles.itemOk}>✓ Confirmar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setNaoReconhecoId(d.id)}><Text style={styles.advDel}>Não reconheço</Text></TouchableOpacity>
              </View>
            )}
            {!concluida && d.situacao === 'PENDENTE' && d.criadoPorId === usuarioId && (
              <Text style={styles.itemAguarda}>aguardando conferência</Text>
            )}
            {!concluida && d.situacao !== 'APROVADA' && (
              <View style={styles.itemAcoes}>
                <TouchableOpacity onPress={() => abrirEdicaoDesp(d)}><Text style={styles.itemEdit}>Editar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => removerDespesa(d.id)}><Text style={styles.advDel}>Remover</Text></TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* Relato da visita: o que foi coletado em campo. Vai para a coluna "Obs / Motivo"
          do relatório mensal de visitas. Opcional — dá para realizar sem escrever. */}
      <Modal visible={relatoId !== null} transparent animationType="fade" onRequestClose={() => setRelatoId(null)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Realizar visita</Text>
            <Text style={styles.modalSub}>Anote o que foi tratado/coletado — sai no relatório de visitas do mês. Pode deixar em branco.</Text>
            <TextInput
              style={[styles.input, styles.modalInput]}
              onFocus={aoFocar}
              placeholder="Ex.: cliente pediu orçamento de 20 t; retornar em 15 dias"
              value={relato}
              onChangeText={setRelato}
              maxLength={500}
              multiline
            />
            <View style={styles.formBtns}>
              <TouchableOpacity style={[styles.btn, styles.btnFlex, relatando && styles.btnOff]} disabled={relatando} onPress={() => void confirmarRealizada()}>
                <Text style={styles.btnTxt}>{relatando ? 'Salvando…' : 'Confirmar visita'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRelatoId(null); setRelato(''); }} disabled={relatando}><Text style={styles.cancelTxt}>Cancelar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Não reconheço a despesa: exige motivo — é o que quem lançou vai ler. */}
      <Modal visible={naoReconhecoId !== null} transparent animationType="fade" onRequestClose={() => setNaoReconhecoId(null)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Não reconheço esta despesa</Text>
            <Text style={styles.modalSub}>Ela foi lançada por outra pessoa na sua prestação de contas. Diga o motivo — quem lançou vai ler.</Text>
            <TextInput style={[styles.input, styles.modalInput]} onFocus={aoFocar} placeholder="Ex.: não fui eu quem gastou" value={motivoNaoRec} onChangeText={setMotivoNaoRec} multiline />
            <View style={styles.formBtns}>
              <TouchableOpacity
                style={[styles.btn, styles.btnFlex, !motivoNaoRec.trim() && styles.btnOff]}
                disabled={!motivoNaoRec.trim()}
                onPress={() => void conferirDespesa(naoReconhecoId!, 'CONTESTADA', motivoNaoRec.trim())}
              >
                <Text style={styles.btnTxt}>Devolver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setNaoReconhecoId(null); setMotivoNaoRec(''); }}><Text style={styles.cancelTxt}>Cancelar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pular visita: exige justificativa (vai pro relatório de visitas). */}
      <Modal visible={pularId !== null} transparent animationType="fade" onRequestClose={() => setPularId(null)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Pular visita</Text>
            <Text style={styles.modalSub}>Informe o motivo pelo qual esta visita não foi realizada.</Text>
            <TextInput
              style={[styles.input, styles.modalInput]}
              placeholder="Ex.: cliente ausente, propriedade fechada, tempo…"
              value={motivoPular}
              onChangeText={setMotivoPular}
              maxLength={500}
              multiline
              autoFocus
              editable={!pulando}
            />
            <View style={styles.formBtns}>
              <TouchableOpacity
                style={[styles.btn, styles.btnFlex, (!motivoPular.trim() || pulando) && styles.btnOff]}
                onPress={() => void confirmarPular()}
                disabled={!motivoPular.trim() || pulando}
              >
                <Text style={styles.btnTxt}>{pulando ? 'Salvando…' : 'Confirmar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPularId(null)} disabled={pulando}><Text style={styles.cancelTxt}>Cancelar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  hTitle: { fontSize: 16, fontWeight: '700', color: CAPUL },
  hSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  hStatus: { flexDirection: 'row', marginTop: 8 },
  coment: { marginTop: 8, fontSize: 12, color: '#075985', backgroundColor: '#e0f2fe', borderRadius: 8, padding: 8 },
  cancelado: { marginTop: 8, fontSize: 12, color: '#9f1239', backgroundColor: '#ffe4e6', borderRadius: 8, padding: 8 },
  wfRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  wfBtn: { backgroundColor: CAPUL, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  wfBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  wfBtnAlt: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' },
  wfBtnTxtAlt: { color: '#334155' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 8 },
  btn: { backgroundColor: CAPUL, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnOff: { opacity: 0.6 },
  fLabel: { fontSize: 13, color: '#334155', fontWeight: '600', marginTop: 12 },
  btnFoto: { borderWidth: 2, borderColor: CAPUL, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 24, alignItems: 'center', backgroundColor: '#fff', marginTop: 4 },
  btnFotoTxt: { color: CAPUL, fontSize: 15, fontWeight: '700' },
  fotoBtns: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btnFotoFlex: { flex: 1, paddingVertical: 16 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  thumbBox: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#e2e8f0' },
  thumbX: { position: 'absolute', top: -6, right: -6, backgroundColor: '#e11d48', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  thumbXTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  foto: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#e2e8f0', marginTop: 4 },
  refazer: { alignSelf: 'center', marginTop: 8 },
  refazerTxt: { color: CAPUL, fontWeight: '600' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 8 },
  vazio: { color: '#94a3b8', fontSize: 13 },
  item: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', flexShrink: 1 },
  itemSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  motivoPulada: { fontSize: 12, color: '#b45309', marginTop: 4, fontStyle: 'italic' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalTitulo: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  modalInput: { minHeight: 80, textAlignVertical: 'top' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  apRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  apBtn: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  apTxt: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  apOk: { borderColor: '#6ee7b7', backgroundColor: '#d1fae5' },
  apOkTxt: { color: '#047857', fontWeight: '700', fontSize: 13 },
  banner: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, padding: 12 },
  bannerTxt: { color: '#92400e', fontWeight: '700', textAlign: 'center' },
  advRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  advInfo: { flexShrink: 1 },
  advTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  advVal: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  advRej: { fontSize: 12, color: '#be123c', marginTop: 2 },
  advDel: { color: '#e11d48', fontWeight: '600', fontSize: 13 },
  itemAcoes: { flexDirection: 'row', gap: 18, marginTop: 8 },
  itemEdit: { color: CAPUL, fontWeight: '600', fontSize: 13 },
  itemOk: { color: '#047857', fontWeight: '700', fontSize: 13 },
  itemAguarda: { color: '#94a3b8', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  dica: { fontSize: 12, color: '#64748b', marginTop: 10, fontStyle: 'italic' },
  mapLink: { color: CAPUL, fontWeight: '600', fontSize: 13, marginTop: 6 },
  addBtn: { borderWidth: 1.5, borderColor: CAPUL, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  addBtnTxt: { color: CAPUL, fontWeight: '700', fontSize: 15 },
  formBtns: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  btnFlex: { flex: 1, marginTop: 0 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  cancelTxt: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  hint: { fontSize: 12, color: '#075985', backgroundColor: '#e0f2fe', borderRadius: 8, padding: 8, marginTop: 4, marginBottom: 4 },
});
