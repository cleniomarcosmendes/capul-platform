import React, { useCallback, useRef, useState } from 'react';
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
  iniciarExecucaoApp, concluirPlanejamentoApp, listarViagensSupervisor,
  listarAtividadesSup, listarTiposDespesaSup,
  meuCadastroSup, listarAdiantamentosSup, lancarAdiantamentoSup, removerAdiantamentoSup,
  type ViagemSupDetalhe, type AtividadeSup, type TipoDespesaSup, type NovaVisita, type NovaDespesa,
  type MeuCadastroSup, type AdiantamentoSup, type VisitaSup, type ViagemSup,
} from '../api/supervisor';
import { uuid } from '../lib/uuid';
import { maskMoeda, parseMoeda } from '../lib/moeda';
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
  RASCUNHO: 'Em preparação', ENVIADO: 'Enviado (aguarda coordenador)', APROVADO: 'Aprovado',
  AJUSTADO: 'Ajustado (revisar)', REJEITADO: 'Rejeitado', EM_EXECUCAO: 'Em execução', CONCLUIDO: 'Concluído',
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
  // Teclado: ao focar um campo, rola ele pra cima do teclado (recurso nativo do
  // ScrollView) — resolve o teclado sobrepondo os campos das visitas/despesas.
  const scrollRef = useRef<ScrollView>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aoFocar = (e: any) => {
    const resp = scrollRef.current?.getScrollResponder?.() as { scrollResponderScrollNativeHandleToKeyboard?: (n: number, off: number, prevent: boolean) => void } | undefined;
    const node: number | undefined = e?.target;
    if (resp?.scrollResponderScrollNativeHandleToKeyboard && node != null) {
      resp.scrollResponderScrollNativeHandleToKeyboard(node, 110, true);
    }
  };
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
  const [dData, setDData] = useState(''); // data da despesa (opcional, AAAA-MM-DD → hoje se vazio)
  const [fotoUris, setFotoUris] = useState<string[]>([]); // comprovantes (fotos) — vários
  const [salvD, setSalvD] = useState(false);
  const [showDespesa, setShowDespesa] = useState(false); // form de despesa recolhido (botão)
  const [despViagemId, setDespViagemId] = useState(viagemId); // planejamento-alvo da despesa
  const [editDespId, setEditDespId] = useState<string | null>(null); // despesa em edição (senão: novo lançamento)
  const [planejamentos, setPlanejamentos] = useState<ViagemSup[]>([]); // do mês, p/ o seletor
  // adiantamentos do mês (auto-serviço do supervisor de área — só o SEU cadastro)
  const [meuSup, setMeuSup] = useState<MeuCadastroSup | null>(null);
  const [adiants, setAdiants] = useState<AdiantamentoSup[]>([]);
  const [advValor, setAdvValor] = useState(''); const [advData, setAdvData] = useState(''); const [advObs, setAdvObs] = useState('');
  const [salvA, setSalvA] = useState(false);

  const carregar = useCallback(async () => {
    const [d, a, t] = await Promise.all([
      obterViagemSupervisor(viagemId), listarAtividadesSup(), listarTiposDespesaSup(),
    ]);
    setV(d); setAtivs(a); setTipos(t);
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

  const concluida = v?.situacao === 'CONCLUIDA';
  const sp = v?.statusPlanejamento ?? null;
  const emExecucao = sp === 'EM_EXECUCAO';
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

  const apontar = async (paradaId: string, status: 'REALIZADA' | 'PULADA', motivoPulada?: string) => {
    // GPS só faz sentido na visita REALIZADA (onde ele esteve); PULADA não captura.
    const coords = status === 'REALIZADA' ? await capturarCoordenadas() : {};
    // Confirmação: só marcações "no local" ensinam a localização do cliente (evita marcar
    // da estrada/cidade). Pergunta só na REALIZADA e só se houver GPS.
    const noLocal = status === 'REALIZADA' && coords.latitude != null ? await confirmarNoLocal() : undefined;
    const extra = { ...coords, ...(noLocal !== undefined ? { noLocal } : {}), ...(motivoPulada ? { motivoPulada } : {}) };
    try { await apontarVisitaApp(viagemId, paradaId, status, extra); await carregar(); }
    catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarSupervisor({ id: uuid(), rotulo: `Apontar ${status === 'REALIZADA' ? 'realizada' : 'pulada'}`, acao: { tipo: 'apontar', viagemId, paradaId, status, ...extra } });
        Alert.alert('Salvo offline', 'Sem sinal — o apontamento vai sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', msg(e, 'Falha ao apontar a visita.')); }
    }
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

  const limparDespesa = () => { setTipoId(''); setValor(''); setDData(''); setDForn(''); setDObs(''); setFotoUris([]); setEditDespId(null); setDespViagemId(viagemId); };
  // Abre o form já preenchido com a despesa (edição de tipo/valor/fornecedor/obs — os
  // comprovantes ficam como estão). Só metadados: por isso escondemos foto/planejamento.
  const abrirEdicaoDesp = (d: ViagemSupDetalhe['despesas'][number]) => {
    setEditDespId(d.id);
    setTipoId(d.tipoDespesaId ?? (d.tipoDespesa ? (tipos.find((t) => t.nome === d.tipoDespesa?.nome)?.id ?? '') : ''));
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
        });
        limparDespesa(); setShowDespesa(false); await carregar();
        Alert.alert('Pronto', 'Despesa atualizada.');
      } catch (e) { Alert.alert('Erro', msg(e, 'Falha ao editar a despesa.')); } finally { setSalvD(false); }
      return;
    }
    const fotos = fotoUris;
    const payload: NovaDespesa = {
      tipoDespesaId: tipoId, valor: parseMoeda(valor), data,
      fornecedor: dForn.trim() || undefined, observacao: dObs.trim() || undefined, idempotencyKey: uuid(),
    };
    try {
      await lancarDespesaApp(despViagemId, payload, fotos);
      limparDespesa(); setShowDespesa(false); await carregar();
      Alert.alert('Pronto', 'Despesa lançada (aguarda aprovação do coordenador).');
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

  const limparAdiant = () => { setAdvValor(''); setAdvData(''); setAdvObs(''); };
  const salvarAdiantamento = async () => {
    if (!meuSup) { Alert.alert('Adiantamento', 'Seu cadastro de supervisor ainda não foi montado no time. Peça ao coordenador para te cadastrar.'); return; }
    if (!v?.mesReferencia) { Alert.alert('Adiantamento', 'Mês da viagem indefinido.'); return; }
    if (parseMoeda(advValor) <= 0) { Alert.alert('Adiantamento', 'Informe o valor do adiantamento.'); return; }
    if (advData.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(advData.trim())) { Alert.alert('Adiantamento', 'Data inválida — use o formato AAAA-MM-DD (ou deixe vazio para hoje).'); return; }
    setSalvA(true);
    try {
      await lancarAdiantamentoSup({ supervisorId: meuSup.id, mesReferencia: v.mesReferencia, valor: parseMoeda(advValor), data: advData.trim() || undefined, observacao: advObs.trim() || undefined });
      limparAdiant(); await carregar();
      Alert.alert('Pronto', 'Adiantamento lançado — aguardando aprovação do coordenador.');
    } catch (e) { Alert.alert('Erro', msg(e, 'Falha ao lançar o adiantamento.')); } finally { setSalvA(false); }
  };
  const removerAdiant = (id: string) => {
    Alert.alert('Remover adiantamento', 'Confirma remover este adiantamento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try { await removerAdiantamentoSup(id); await carregar(); }
        catch (e) { Alert.alert('Erro', msg(e, 'Falha ao remover o adiantamento.')); }
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
        <Text style={styles.hSub}>Supervisor: {v.condutorNome ?? '—'} · Adiant.: {brl(v.adiantamento)}</Text>
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
        {(sp === 'RASCUNHO' || sp === 'AJUSTADO' || sp === 'REJEITADO' || sp === 'ENVIADO') && (
          <Text style={styles.coment}>✎ O planejamento é montado e enviado ao coordenador no computador. Aqui você executa quando aprovado.</Text>
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
                <TouchableOpacity onPress={() => removerAdiant(a.id)}><Text style={styles.advDel}>Remover</Text></TouchableOpacity>
              </View>
            );
          })}
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Valor R$ 0,00" keyboardType="decimal-pad" value={advValor} onChangeText={(t) => setAdvValor(maskMoeda(t))} />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Data AAAA-MM-DD (opcional — hoje)" value={advData} onChangeText={setAdvData} autoCapitalize="none" />
          <TextInput style={styles.input} onFocus={aoFocar} placeholder="Observação (opcional)" value={advObs} onChangeText={setAdvObs} />
          <TouchableOpacity style={[styles.btn, salvA && styles.btnOff]} onPress={() => void salvarAdiantamento()} disabled={salvA}>
            <Text style={styles.btnTxt}>{salvA ? 'Salvando…' : 'Lançar adiantamento'}</Text>
          </TouchableOpacity>
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
                <TouchableOpacity style={[styles.apBtn, styles.apOk]} onPress={() => void apontar(p.id, 'REALIZADA')}><Text style={styles.apOkTxt}>Realizar</Text></TouchableOpacity>
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
          <SelectBusca valor={tipoId} opcoes={tipos.map((t) => ({ id: t.id, nome: t.nome, subtitulo: t.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo' }))} onChange={setTipoId} placeholder="Tipo de despesa" />
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
            {!concluida && d.situacao !== 'APROVADA' && (
              <View style={styles.itemAcoes}>
                <TouchableOpacity onPress={() => abrirEdicaoDesp(d)}><Text style={styles.itemEdit}>Editar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => removerDespesa(d.id)}><Text style={styles.advDel}>Remover</Text></TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

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
