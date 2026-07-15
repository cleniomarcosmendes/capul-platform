import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { SelectBusca } from '../components/SelectBusca';
import {
  obterViagemSupervisor, adicionarVisitaApp, lancarDespesaApp, apontarVisitaApp,
  enviarPlanejamentoApp, iniciarExecucaoApp, concluirPlanejamentoApp,
  listarAtividadesSup, listarTiposDespesaSup,
  meuCadastroSup, listarAdiantamentosSup, lancarAdiantamentoSup, removerAdiantamentoSup,
  type ViagemSupDetalhe, type AtividadeSup, type TipoDespesaSup, type NovaVisita, type NovaDespesa,
  type MeuCadastroSup, type AdiantamentoSup,
} from '../api/supervisor';
import { uuid } from '../lib/uuid';
import {
  enfileirarSupervisor, processarFilaSupervisor, contarPendentesSupervisor, onFilaSupervisorChange, ehErroDeRede,
} from '../offline/filaSupervisor';

const CAPUL = '#1e7d3a';

/** GPS opcional (igual às paradas da frota): se negar permissão/falhar, segue sem
 *  coordenada — não trava a visita/apontamento. */
async function capturarCoordenadas(): Promise<{ latitude?: number; longitude?: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch { return {}; }
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
  // form despesa
  const [tipoId, setTipoId] = useState(''); const [valor, setValor] = useState(''); const [dForn, setDForn] = useState(''); const [dObs, setDObs] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null); // comprovante (opcional)
  const [salvD, setSalvD] = useState(false);
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
  // Fase de planejamento (espelha o backend): a visita adicionada aqui nasce PLANEJADA
  // (monta o roteiro). Fora disso ela nasce REALIZADA (visita de fato, em campo).
  const emPlanejamento = sp === 'RASCUNHO' || sp === 'AJUSTADO' || sp === 'REJEITADO' || sp === null;
  // Aprovado mas ainda não iniciado: há visitas planejadas esperando o "Iniciar execução".
  const temPlanejadaPendente = (v?.paradas ?? []).some((p) => (p.status ?? 'PLANEJADA') === 'PLANEJADA');

  const limparVisita = () => { setCliNome(''); setMuni(''); setAtivId(''); setProp(''); setVObs(''); };

  const salvarVisita = async () => {
    if (!cliNome.trim()) { Alert.alert('Visita', 'Informe o cliente (ou prospect).'); return; }
    setSalvV(true);
    const coords = await capturarCoordenadas();
    const payload: NovaVisita = {
      clienteNome: cliNome.trim(), municipio: muni.trim() || undefined,
      atividadeId: ativId || undefined, propriedade: prop.trim() || undefined,
      observacao: vObs.trim() || undefined, ...coords, idempotencyKey: uuid(),
    };
    try {
      await adicionarVisitaApp(viagemId, payload);
      limparVisita(); await carregar();
      Alert.alert('Pronto', 'Visita registrada.');
    } catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarSupervisor({ id: payload.idempotencyKey!, rotulo: `Visita: ${payload.clienteNome}`, acao: { tipo: 'visita', viagemId, payload } });
        limparVisita();
        Alert.alert('Salvo offline', 'Sem sinal — a visita vai sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', msg(e, 'Falha ao registrar visita.')); }
    } finally { setSalvV(false); }
  };

  const apontar = async (paradaId: string, status: 'REALIZADA' | 'PULADA') => {
    // GPS só faz sentido na visita REALIZADA (onde ele esteve); PULADA não captura.
    const coords = status === 'REALIZADA' ? await capturarCoordenadas() : {};
    try { await apontarVisitaApp(viagemId, paradaId, status, coords); await carregar(); }
    catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarSupervisor({ id: uuid(), rotulo: `Apontar ${status === 'REALIZADA' ? 'realizada' : 'pulada'}`, acao: { tipo: 'apontar', viagemId, paradaId, status, ...coords } });
        Alert.alert('Salvo offline', 'Sem sinal — o apontamento vai sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', msg(e, 'Falha ao apontar a visita.')); }
    }
  };

  const acao = async (fn: (id: string) => Promise<void>, ok: string) => {
    setAgindo(true);
    try { await fn(viagemId); await carregar(); Alert.alert('Pronto', ok); }
    catch (e) { Alert.alert('Erro', msg(e, 'Falha na ação.')); } finally { setAgindo(false); }
  };

  const tirarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Comprovante', 'Permita o acesso à câmera para fotografar o recibo.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!r.canceled && r.assets[0]?.uri) setFotoUri(r.assets[0].uri);
  };

  const limparDespesa = () => { setTipoId(''); setValor(''); setDForn(''); setDObs(''); setFotoUri(null); };

  const salvarDespesa = async () => {
    if (!tipoId || !valor) { Alert.alert('Despesa', 'Escolha o tipo e informe o valor.'); return; }
    setSalvD(true);
    const foto = fotoUri;
    const payload: NovaDespesa = {
      tipoDespesaId: tipoId, valor: Number(valor),
      fornecedor: dForn.trim() || undefined, observacao: dObs.trim() || undefined, idempotencyKey: uuid(),
    };
    try {
      await lancarDespesaApp(viagemId, payload, foto ?? undefined);
      limparDespesa(); await carregar();
      Alert.alert('Pronto', 'Despesa lançada (aguarda aprovação do coordenador).');
    } catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarSupervisor({ id: payload.idempotencyKey!, rotulo: `Despesa: ${brl(payload.valor)}`, acao: { tipo: 'despesa', viagemId, payload, fotoUri: foto ?? null } });
        limparDespesa();
        Alert.alert('Salvo offline', 'Sem sinal — a despesa (e a foto) vão sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', msg(e, 'Falha ao lançar despesa.')); }
    } finally { setSalvD(false); }
  };

  const limparAdiant = () => { setAdvValor(''); setAdvData(''); setAdvObs(''); };
  const salvarAdiantamento = async () => {
    if (!meuSup) { Alert.alert('Adiantamento', 'Seu cadastro de supervisor ainda não foi montado no time. Peça ao coordenador para te cadastrar.'); return; }
    if (!v?.mesReferencia) { Alert.alert('Adiantamento', 'Mês da viagem indefinido.'); return; }
    if (!advValor || Number(advValor) <= 0) { Alert.alert('Adiantamento', 'Informe o valor do adiantamento.'); return; }
    if (advData.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(advData.trim())) { Alert.alert('Adiantamento', 'Data inválida — use o formato AAAA-MM-DD (ou deixe vazio para hoje).'); return; }
    setSalvA(true);
    try {
      await lancarAdiantamentoSup({ supervisorId: meuSup.id, mesReferencia: v.mesReferencia, valor: Number(advValor), data: advData.trim() || undefined, observacao: advObs.trim() || undefined });
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
    <ScrollView contentContainerStyle={styles.container}>
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
          {(sp === 'RASCUNHO' || sp === 'AJUSTADO' || sp === 'REJEITADO') && (
            <TouchableOpacity style={[styles.wfBtn, agindo && styles.btnOff]} disabled={agindo} onPress={() => void acao(enviarPlanejamentoApp, 'Enviado ao coordenador.')}><Text style={styles.wfBtnTxt}>Enviar ao coordenador</Text></TouchableOpacity>
          )}
          {sp === 'APROVADO' && (
            <TouchableOpacity style={[styles.wfBtn, agindo && styles.btnOff]} disabled={agindo} onPress={() => void acao(iniciarExecucaoApp, 'Execução iniciada.')}><Text style={styles.wfBtnTxt}>Iniciar execução</Text></TouchableOpacity>
          )}
          {emExecucao && (
            <TouchableOpacity style={[styles.wfBtn, styles.wfBtnAlt, agindo && styles.btnOff]} disabled={agindo} onPress={() => void acao(concluirPlanejamentoApp, 'Planejamento concluído.')}><Text style={[styles.wfBtnTxt, styles.wfBtnTxtAlt]}>Concluir</Text></TouchableOpacity>
          )}
        </View>
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
          <TextInput style={styles.input} placeholder="Valor (R$)" keyboardType="decimal-pad" value={advValor} onChangeText={setAdvValor} />
          <TextInput style={styles.input} placeholder="Data AAAA-MM-DD (opcional — hoje)" value={advData} onChangeText={setAdvData} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Observação (opcional)" value={advObs} onChangeText={setAdvObs} />
          <TouchableOpacity style={[styles.btn, salvA && styles.btnOff]} onPress={() => void salvarAdiantamento()} disabled={salvA}>
            <Text style={styles.btnTxt}>{salvA ? 'Salvando…' : 'Lançar adiantamento'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!concluida && (
        <View style={styles.card}>
          <Text style={styles.sTitle}>{emPlanejamento ? 'Incluir cliente no planejamento' : 'Registrar visita'}</Text>
          {emPlanejamento && <Text style={styles.hint}>Monte o roteiro: adicione os clientes que pretende visitar. Você aponta como realizada/pulada durante a execução.</Text>}
          <TextInput style={styles.input} placeholder="Cliente / prospect" value={cliNome} onChangeText={setCliNome} />
          <TextInput style={styles.input} placeholder="Município" value={muni} onChangeText={setMuni} />
          <SelectBusca valor={ativId} opcoes={ativs.map((a) => ({ id: a.id, nome: a.nome }))} onChange={setAtivId} placeholder="Atividade" permiteLimpar />
          <TextInput style={styles.input} placeholder="Propriedade / fazenda" value={prop} onChangeText={setProp} />
          <TextInput style={styles.input} placeholder="Observação" value={vObs} onChangeText={setVObs} />
          <TouchableOpacity style={[styles.btn, salvV && styles.btnOff]} onPress={() => void salvarVisita()} disabled={salvV}>
            <Text style={styles.btnTxt}>{salvV ? 'Salvando…' : (emPlanejamento ? '＋ Incluir no planejamento' : 'Registrar visita')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.listTitle}>Visitas ({v.paradas.length})</Text>
      {sp === 'APROVADO' && temPlanejadaPendente && (
        <Text style={styles.hint}>Planejamento aprovado. Toque em “Iniciar execução” (no topo) para apontar as visitas como realizadas ou puladas.</Text>
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
            {p.latitude != null && p.longitude != null && (
              <TouchableOpacity onPress={() => abrirNoMapa(p.latitude!, p.longitude!)}>
                <Text style={styles.mapLink}>📍 Ver no mapa</Text>
              </TouchableOpacity>
            )}
            {emExecucao && p.status === 'PLANEJADA' && (
              <View style={styles.apRow}>
                <TouchableOpacity style={[styles.apBtn, styles.apOk]} onPress={() => void apontar(p.id, 'REALIZADA')}><Text style={styles.apOkTxt}>Realizar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.apBtn} onPress={() => void apontar(p.id, 'PULADA')}><Text style={styles.apTxt}>Pular</Text></TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {!concluida && (
        <View style={styles.card}>
          <Text style={styles.sTitle}>Nova despesa</Text>
          <SelectBusca valor={tipoId} opcoes={tipos.map((t) => ({ id: t.id, nome: t.nome, subtitulo: t.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo' }))} onChange={setTipoId} placeholder="Tipo de despesa" />
          <TextInput style={styles.input} placeholder="Valor (R$)" keyboardType="decimal-pad" value={valor} onChangeText={setValor} />
          <TextInput style={styles.input} placeholder="Fornecedor" value={dForn} onChangeText={setDForn} />
          <TextInput style={styles.input} placeholder="Observação" value={dObs} onChangeText={setDObs} />
          <Text style={styles.fLabel}>Comprovante (opcional)</Text>
          {fotoUri ? (
            <View>
              <Image source={{ uri: fotoUri }} style={styles.foto} resizeMode="cover" />
              <TouchableOpacity style={styles.refazer} onPress={() => setFotoUri(null)} disabled={salvD}><Text style={styles.refazerTxt}>Remover foto</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.btnFoto} onPress={() => void tirarFoto()} disabled={salvD}><Text style={styles.btnFotoTxt}>📷 Fotografar recibo</Text></TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, salvD && styles.btnOff]} onPress={() => void salvarDespesa()} disabled={salvD}>
            <Text style={styles.btnTxt}>{salvD ? 'Salvando…' : 'Lançar despesa'}</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <Text style={styles.itemSub}>{d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo'}{d.comprovanteObjectKey ? ' · 📎 comprovante' : ''}</Text>
          </View>
        );
      })}
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
  mapLink: { color: CAPUL, fontWeight: '600', fontSize: 13, marginTop: 6 },
  hint: { fontSize: 12, color: '#075985', backgroundColor: '#e0f2fe', borderRadius: 8, padding: 8, marginTop: 4, marginBottom: 4 },
});
