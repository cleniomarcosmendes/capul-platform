import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import {
  listarViagensFrota, registrarRetorno, tiposDespesa, lancarDespesaViagem,
  fornecedoresDespesa, adicionarParadaFrota, listarParadasFrota, autenticarCondutor,
  checkinParadaFrota, pularParadaFrota, type FornecedorDespesa, type ParadaFrotaItem,
} from '../api/frota';
import { setCondutorToken, getCondutorToken } from '../api/client';
import { SelectBusca } from '../components/SelectBusca';
import {
  enfileirarFrota, processarFilaFrota, contarPendentesFrota, onFilaFrotaChange, ehErroDeRede,
} from '../offline/filaFrota';
import { uuid } from '../lib/uuid';
import { maskMoeda, parseMoeda } from '../lib/moeda';
import { useRastreamento } from '../lib/useRastreamento';
import { useAuth } from '../auth/AuthContext';
import type { TipoDespesa, ViagemFrota } from '../types/api';

const CAPUL = '#1e7d3a';
const MAX_FOTOS_DESPESA = 5;
type Props = NativeStackScreenProps<RootStackParamList, 'ViagemFrota'>;
type Aba = null | 'parada' | 'retorno' | 'despesa';

/** GPS opcional com captura automática: se negar permissão/falhar, segue sem
 *  coordenada (não trava a operação). Usado na parada ad-hoc e no check-in. */
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

/** Detalhe de uma viagem de frota EM CURSO: registrar retorno OU lançar despesa. */
export function ViagemFrotaScreen({ route, navigation }: Props) {
  const { viagemId } = route.params;
  const { tipo } = useAuth();
  // PADRÃO (login compartilhado): exige identificar o condutor UMA vez ao abrir a
  // viagem (gate) → token cobre parada/despesa/retorno. INDIVIDUAL já é a pessoa.
  const ehIndividual = tipo === 'INDIVIDUAL';
  const [condutorOk, setCondutorOk] = useState(ehIndividual);
  const [viagem, setViagem] = useState<ViagemFrota | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>(null);
  const [pendentes, setPendentes] = useState(0);

  // Limpa o token de condutor ao sair da viagem (não vaza p/ outra viagem/sessão).
  useEffect(() => () => setCondutorToken(null), []);

  const carregar = useCallback(async () => {
    try {
      const lista = await listarViagensFrota('EM_CURSO');
      setViagem(lista.find((v) => v.id === viagemId) ?? null);
    } catch { /* mantém */ } finally { setCarregando(false); }
  }, [viagemId]);

  // Ao focar: tenta sincronizar a fila offline e recarrega.
  useFocusEffect(useCallback(() => {
    void processarFilaFrota().finally(() => void carregar());
    void contarPendentesFrota().then(setPendentes);
    const off = onFilaFrotaChange(setPendentes);
    return off;
  }, [carregar]));

  const sincronizar = async () => {
    const r = await processarFilaFrota();
    await carregar();
    if (r.enviadas > 0) Alert.alert('Sincronizado', `${r.enviadas} registro(s) enviado(s).`);
    else if (r.restantes > 0) Alert.alert('Sem conexão', `${r.restantes} registro(s) ainda na fila.`);
    if (r.descartadas.length) Alert.alert('Recusado pelo servidor', r.descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n'));
  };

  // Rastreamento foreground enquanto a viagem está em curso (Fase A).
  const { rastreando } = useRastreamento(viagemId, viagem?.situacao === 'EM_CURSO');

  if (carregando) return <View style={styles.centro}><ActivityIndicator size="large" color={CAPUL} /></View>;
  if (!viagem) return <View style={styles.centro}><Text style={styles.vazio}>Viagem não está mais em curso.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      {rastreando && (
        <View style={styles.rastreioBanner}>
          <Text style={styles.rastreioTxt}>📍 Localização ativa durante a viagem</Text>
        </View>
      )}
      {pendentes > 0 && (
        <TouchableOpacity style={styles.banner} onPress={() => void sincronizar()}>
          <Text style={styles.bannerTxt}>📴 {pendentes} registro(s) aguardando sinal — toque para reenviar</Text>
        </TouchableOpacity>
      )}
      <View style={styles.cab}>
        <Text style={styles.placa}>{viagem.placa}{viagem.modelo ? ` · ${viagem.modelo}` : ''}</Text>
        <Text style={styles.linhaInfo}>Viagem #{viagem.numero} · {viagem.paradas} parada{viagem.paradas === 1 ? '' : 's'}</Text>
        <Text style={styles.linhaInfo}>Condutor: {viagem.condutorNome ?? '—'}</Text>
        {viagem.kmInicial != null ? <Text style={styles.linhaInfo}>KM saída: {viagem.kmInicial.toLocaleString('pt-BR')}</Text> : null}
        {viagem.finalidade ? <Text style={styles.linhaInfo}>Finalidade: {viagem.finalidade}</Text> : null}
      </View>

      {!condutorOk ? (
        <GateCondutor viagem={viagem} onOk={() => setCondutorOk(true)} />
      ) : (
        <>
          <View style={styles.acoes}>
            <TouchableOpacity style={[styles.acao, aba === 'parada' && styles.acaoOn]} onPress={() => setAba(aba === 'parada' ? null : 'parada')}>
              <Text style={[styles.acaoTxt, aba === 'parada' && styles.acaoTxtOn]}>📍 Parada</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acao, aba === 'retorno' && styles.acaoOn]} onPress={() => setAba(aba === 'retorno' ? null : 'retorno')}>
              <Text style={[styles.acaoTxt, aba === 'retorno' && styles.acaoTxtOn]}>🏁 Retorno</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acao, aba === 'despesa' && styles.acaoOn]} onPress={() => setAba(aba === 'despesa' ? null : 'despesa')}>
              <Text style={[styles.acaoTxt, aba === 'despesa' && styles.acaoTxtOn]}>💸 Despesa</Text>
            </TouchableOpacity>
          </View>

          {aba === 'parada' && <ParadaForm viagem={viagem} onRegistrada={() => void carregar()} />}
          {aba === 'retorno' && <RetornoForm viagem={viagem} ehIndividual={ehIndividual} onPronto={() => navigation.goBack()} />}
          {aba === 'despesa' && <DespesaForm viagem={viagem} onPronto={() => { setAba(null); void carregar(); }} />}
        </>
      )}
    </ScrollView>
  );
}

/** Gate do login PADRÃO: identifica o condutor da viagem (matrícula+senha) UMA
 *  vez. Com sucesso, seta o token de condutor e libera as ações da viagem. */
function GateCondutor({ viagem, onOk }: { viagem: ViagemFrota; onOk: () => void }) {
  const [matricula, setMatricula] = useState(viagem.condutorMatricula ?? '');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState('');

  async function identificar() {
    if (!matricula.trim() || !senha) return;
    setValidando(true); setErro('');
    try {
      const r = await autenticarCondutor(viagem.id, matricula.trim(), senha);
      if (r.valida) { setCondutorToken(r.token); onOk(); }
      else setErro(
        r.motivo === 'NAO_E_O_CONDUTOR' ? 'Esta matrícula não é a do condutor que iniciou a viagem.'
        : r.motivo === 'INDISPONIVEL' ? 'Portal do RH indisponível. Tente novamente em instantes.'
        : 'Matrícula ou senha inválidas.',
      );
    } catch {
      setErro('Falha ao validar. Verifique a conexão.');
    } finally { setValidando(false); }
  }

  const pode = !!matricula.trim() && !!senha && !validando;
  return (
    <View style={styles.painel}>
      <Text style={styles.passo}>Identifique o condutor</Text>
      <Text style={styles.dica}>Login compartilhado: confirme a matrícula + senha do condutor desta viagem ({viagem.condutorNome ?? '—'}) para registrar parada, despesa ou retorno.</Text>
      <Text style={styles.label}>Matrícula</Text>
      <TextInput style={styles.input} value={matricula} onChangeText={(t) => setMatricula(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} editable={!validando} />
      <Text style={styles.label}>Senha do portal RH</Text>
      <View style={styles.senhaWrap}>
        <TextInput style={[styles.input, styles.senhaInput]} value={senha} onChangeText={setSenha} secureTextEntry={!mostrarSenha} editable={!validando} />
        <TouchableOpacity style={styles.olho} onPress={() => setMostrarSenha((v) => !v)} hitSlop={10}>
          <Text style={styles.olhoTxt}>{mostrarSenha ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
      {erro ? <Text style={styles.err}>{erro}</Text> : null}
      <TouchableOpacity style={[styles.registrar, !pode && styles.registrarOff]} onPress={identificar} disabled={!pode}>
        {validando ? <ActivityIndicator color="#fff" /> : <Text style={styles.registrarTxt}>Identificar e liberar</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ParadaForm({ viagem, onRegistrada }: { viagem: ViagemFrota; onRegistrada: () => void }) {
  const [paradas, setParadas] = useState<ParadaFrotaItem[]>([]);
  const [local, setLocal] = useState('');
  const [km, setKm] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Check-in da parada planejada selecionada.
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [ckKm, setCkKm] = useState('');
  const [ckObs, setCkObs] = useState('');
  const [ckBusy, setCkBusy] = useState(false);

  const carregar = useCallback(async () => {
    try { setParadas(await listarParadasFrota(viagem.id)); } catch { /* mantém */ }
  }, [viagem.id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const planejadas = paradas.filter((p) => p.status === 'PLANEJADA');

  async function confirmarChegada(pid: string, rotulo: string) {
    setCkBusy(true);
    const coords = await capturarCoordenadas();
    // Check-in = o condutor está NO ponto de entrega → marcação "no local" (alimenta a
    // consolidação quando a parada tiver cliente vinculado).
    const payload = { km: ckKm !== '' ? Number(ckKm) : undefined, ...coords, ...(coords.latitude != null ? { noLocal: true } : {}), observacao: ckObs.trim() || undefined };
    try {
      await checkinParadaFrota(viagem.id, pid, payload);
      setCheckinId(null); setCkKm(''); setCkObs('');
      await carregar(); onRegistrada();
    } catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarFrota({ id: uuid(), rotulo: `Check-in: ${rotulo}`, acao: { tipo: 'checkin', viagemId: viagem.id, paradaId: pid, payload, condutorToken: getCondutorToken() ?? undefined } });
        setCheckinId(null); setCkKm(''); setCkObs(''); onRegistrada();
        Alert.alert('Salvo offline', 'Sem sinal — o check-in vai sincronizar quando a conexão voltar.');
      } else {
        const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
        Alert.alert('Não foi possível dar baixa', String(msg || 'Tente novamente.'));
      }
    } finally { setCkBusy(false); }
  }

  async function pular(pid: string, rotulo: string) {
    try { await pularParadaFrota(viagem.id, pid); await carregar(); onRegistrada(); }
    catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarFrota({ id: uuid(), rotulo: `Pular: ${rotulo}`, acao: { tipo: 'pular', viagemId: viagem.id, paradaId: pid, condutorToken: getCondutorToken() ?? undefined } });
        onRegistrada();
        Alert.alert('Salvo offline', 'Sem sinal — vai sincronizar quando a conexão voltar.');
      } else { Alert.alert('Erro', 'Não foi possível pular a parada.'); }
    }
  }

  const podeRegistrar = !!local.trim() && !salvando;
  async function registrar() {
    if (!podeRegistrar) return;
    setSalvando(true);
    // GPS automático também na parada ad-hoc (mapear cliente/fazenda da visita).
    const coords = await capturarCoordenadas();
    const payload = { local: local.trim(), km: km !== '' ? Number(km) : undefined, observacao: obs.trim() || undefined, ...coords, idempotencyKey: uuid() };
    try {
      await adicionarParadaFrota(viagem.id, payload);
      setLocal(''); setKm(''); setObs('');
      await carregar(); onRegistrada();
      Alert.alert('Parada registrada', 'Pode registrar a próxima quando chegar.');
    } catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarFrota({ id: payload.idempotencyKey, rotulo: `Parada: ${payload.local}`, acao: { tipo: 'parada', viagemId: viagem.id, payload, condutorToken: getCondutorToken() ?? undefined } });
        setLocal(''); setKm(''); setObs(''); onRegistrada();
        Alert.alert('Salvo offline', 'Sem sinal — a parada vai sincronizar quando a conexão voltar.');
      } else {
        const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
        Alert.alert('Não foi possível registrar', String(msg || 'Tente novamente.'));
      }
    } finally { setSalvando(false); }
  }

  return (
    <View style={styles.painel}>
      <Text style={styles.dica}>Caderno da rota. Dê baixa nas visitas planejadas ou registre uma parada na hora. O retorno é o que fecha a viagem.</Text>

      {planejadas.length > 0 && (
        <>
          <Text style={[styles.passo, { marginTop: 4 }]}>🗓️ Visitas planejadas ({planejadas.length})</Text>
          <Text style={styles.dicaMini}>Visitas que você já sabia — toque em "Cheguei aqui" ao chegar (ou "Pular").</Text>
          {planejadas.map((p, i) => (
            <View key={p.id} style={[styles.paradaCard, i === 0 && styles.paradaCardProx]}>
              {i === 0 && <Text style={styles.proxTag}>PRÓXIMA PARADA</Text>}
              <Text style={styles.paradaLocal}>📍 {p.planejadoLocal ?? p.local}</Text>
              {checkinId === p.id ? (
                <View style={{ gap: 6, marginTop: 6 }}>
                  <TextInput style={styles.input} value={ckKm} onChangeText={setCkKm} keyboardType="numeric" placeholder="KM no local (opcional)" editable={!ckBusy} />
                  <TextInput style={styles.input} value={ckObs} onChangeText={setCkObs} maxLength={255} placeholder="Observação (opcional)" editable={!ckBusy} />
                  <Text style={styles.dicaMini}>📡 A localização (GPS) é capturada automaticamente ao confirmar.</Text>
                  <View style={styles.paradaBtns}>
                    <TouchableOpacity style={[styles.btnCheck, ckBusy && styles.registrarOff]} onPress={() => confirmarChegada(p.id, p.planejadoLocal ?? p.local ?? 'parada')} disabled={ckBusy}>
                      {ckBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnCheckTxt}>✅ Confirmar chegada</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => setCheckinId(null)} disabled={ckBusy}><Text style={styles.btnCancelTxt}>Cancelar</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.paradaBtns}>
                  <TouchableOpacity style={styles.btnCheck} onPress={() => { setCheckinId(p.id); setCkKm(''); setCkObs(''); }}><Text style={styles.btnCheckTxt}>Cheguei aqui</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnCancel} onPress={() => pular(p.id, p.planejadoLocal ?? p.local ?? 'parada')}><Text style={styles.btnCancelTxt}>Pular</Text></TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </>
      )}

      <Text style={[styles.passo, { marginTop: 16 }]}>➕ Registrar parada agora</Text>
      <Text style={styles.dicaMini}>Parada no improviso — entra como realizada na hora (com GPS).</Text>
      <Text style={styles.label}>Local</Text>
      <TextInput style={styles.input} value={local} onChangeText={setLocal} maxLength={120} placeholder="Ex.: Posto BR, Cliente X, Oficina…" editable={!salvando} />
      <Text style={styles.label}>KM atual (opcional)</Text>
      <TextInput style={styles.input} value={km} onChangeText={setKm} keyboardType="numeric" editable={!salvando} />
      <Text style={styles.label}>Observação (opcional)</Text>
      <TextInput style={styles.input} value={obs} onChangeText={setObs} maxLength={255} editable={!salvando} />
      <Text style={styles.dicaMini}>📡 A localização (GPS) é capturada automaticamente ao registrar — útil pra mapear a fazenda/cliente.</Text>
      <TouchableOpacity style={[styles.registrar, !podeRegistrar && styles.registrarOff]} onPress={registrar} disabled={!podeRegistrar}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.registrarTxt}>Registrar parada</Text>}
      </TouchableOpacity>
    </View>
  );
}

function RetornoForm({ viagem, ehIndividual, onPronto }: { viagem: ViagemFrota; ehIndividual: boolean; onPronto: () => void }) {
  const [matricula, setMatricula] = useState(viagem.condutorMatricula ?? '');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [kmFinal, setKmFinal] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  // PADRÃO já se identificou no gate (token via header) → só pede KM. INDIVIDUAL confirma matrícula+senha.
  const credOk = ehIndividual ? (!!matricula.trim() && !!senha) : true;
  const podeRegistrar = credOk && kmFinal !== '' && Number(kmFinal) >= 0 && !salvando;

  async function executar() {
    setSalvando(true);
    try {
      await registrarRetorno(viagem.id, {
        ...(ehIndividual ? { matricula: matricula.trim(), senha } : {}),
        kmFinal: Number(kmFinal), observacoes: obs.trim() || undefined,
      });
      Alert.alert('Retorno registrado', `${viagem.placa} de volta.`, [{ text: 'OK', onPress: onPronto }]);
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
      Alert.alert('Não foi possível registrar', String(msg || 'Tente novamente.'));
    } finally { setSalvando(false); }
  }

  async function registrar() {
    if (!podeRegistrar) return;
    if (viagem.kmInicial != null && Number(kmFinal) < viagem.kmInicial) {
      Alert.alert('KM final', `O KM final (${kmFinal}) é menor que o KM de saída (${viagem.kmInicial}).`);
      return;
    }
    // Aviso NÃO-bloqueante: paradas planejadas sem baixa (retorno é o obrigatório).
    try {
      const ps = await listarParadasFrota(viagem.id);
      const pend = ps.filter((p) => p.status === 'PLANEJADA').length;
      if (pend > 0) {
        Alert.alert('Paradas planejadas', `Há ${pend} parada(s) planejada(s) sem baixa. Concluir a viagem mesmo assim?`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Concluir', onPress: () => void executar() },
        ]);
        return;
      }
    } catch { /* se a checagem falhar, não bloqueia */ }
    void executar();
  }

  return (
    <View style={styles.painel}>
      {ehIndividual ? (
        <>
          <Text style={styles.dica}>Só o condutor que iniciou fecha a viagem — confirme matrícula + senha.</Text>
          <Text style={styles.label}>Matrícula</Text>
          <TextInput style={styles.input} value={matricula} onChangeText={(t) => setMatricula(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} editable={!salvando} />
          <Text style={styles.label}>Senha do portal RH</Text>
          <View style={styles.senhaWrap}>
            <TextInput style={[styles.input, styles.senhaInput]} value={senha} onChangeText={setSenha} secureTextEntry={!mostrarSenha} editable={!salvando} />
            <TouchableOpacity style={styles.olho} onPress={() => setMostrarSenha((v) => !v)} hitSlop={10}>
              <Text style={styles.olhoTxt}>{mostrarSenha ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={styles.dica}>Condutor {viagem.condutorNome ?? ''} identificado — informe o KM final para fechar a viagem.</Text>
      )}
      <Text style={styles.label}>KM final (odômetro)</Text>
      <TextInput style={styles.input} value={kmFinal} onChangeText={setKmFinal} keyboardType="numeric" editable={!salvando} />
      <Text style={styles.label}>Observações (opcional)</Text>
      <TextInput style={styles.input} value={obs} onChangeText={setObs} maxLength={255} editable={!salvando} />
      <TouchableOpacity style={[styles.registrar, !podeRegistrar && styles.registrarOff]} onPress={registrar} disabled={!podeRegistrar}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.registrarTxt}>Registrar retorno</Text>}
      </TouchableOpacity>
    </View>
  );
}

function DespesaForm({ viagem, onPronto }: { viagem: ViagemFrota; onPronto: () => void }) {
  // A identidade do condutor já foi resolvida ao abrir a viagem (gate PADRÃO →
  // token no header; INDIVIDUAL = próprio login). Aqui não se pede senha de novo.
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [tipoId, setTipoId] = useState('');
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [fornecedorId, setFornecedorId] = useState('');
  const [valor, setValor] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [semNota, setSemNota] = useState(false);
  const [fotoUris, setFotoUris] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void (async () => { try { setTipos(await tiposDespesa()); } catch { /* vazio */ } })();
    void (async () => { try { setFornecedores(await fornecedoresDespesa()); } catch { /* vazio */ } })();
  }, []);

  const podeLancar = !!tipoId && valor !== '' && parseMoeda(valor) > 0 && !salvando;

  async function tirarFoto() {
    if (fotoUris.length >= MAX_FOTOS_DESPESA) { Alert.alert('Cupons', `Máximo de ${MAX_FOTOS_DESPESA} fotos.`); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Câmera', 'Permita a câmera para fotografar o cupom.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!r.canceled && r.assets[0]?.uri) setFotoUris((prev) => [...prev, r.assets[0].uri].slice(0, MAX_FOTOS_DESPESA));
  }
  async function escolherFotos() {
    const restante = MAX_FOTOS_DESPESA - fotoUris.length;
    if (restante <= 0) { Alert.alert('Cupons', `Máximo de ${MAX_FOTOS_DESPESA} fotos.`); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: restante, quality: 0.6 });
    if (!r.canceled) setFotoUris((prev) => [...prev, ...r.assets.map((a) => a.uri)].slice(0, MAX_FOTOS_DESPESA));
  }
  const removerFoto = (i: number) => setFotoUris((prev) => prev.filter((_, idx) => idx !== i));

  async function lancar() {
    if (!podeLancar) return;
    setSalvando(true);
    const payload = {
      viagemId: viagem.id,
      tipoDespesaId: tipoId, valor: parseMoeda(valor),
      fornecedorId: fornecedorId || undefined, fornecedor: fornecedor.trim() || undefined,
      numeroDocumento: semNota ? undefined : (numeroDocumento.trim() || undefined),
      semNota: semNota || undefined, idempotencyKey: uuid(),
    };
    try {
      await lancarDespesaViagem(payload, fotoUris);
      Alert.alert('Despesa lançada', 'Entrou como pendente de validação do supervisor.', [{ text: 'OK', onPress: onPronto }]);
    } catch (e) {
      if (ehErroDeRede(e)) {
        await enfileirarFrota({ id: payload.idempotencyKey, rotulo: `Despesa R$ ${valor}`, acao: { tipo: 'despesa', viagemId: viagem.id, payload, fotoUris, condutorToken: getCondutorToken() ?? undefined } });
        Alert.alert('Salvo offline', 'Sem sinal — a despesa (e as fotos) vão sincronizar quando a conexão voltar.', [{ text: 'OK', onPress: onPronto }]);
      } else {
        const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
        Alert.alert('Não foi possível lançar', String(msg || 'Tente novamente.'));
      }
    } finally { setSalvando(false); }
  }

  return (
    <View style={styles.painel}>
      <Text style={styles.dica}>Despesa do condutor {viagem.condutorNome ?? ''} — entra como pendente.</Text>
      <Text style={styles.label}>Tipo de despesa</Text>
      <SelectBusca
        valor={tipoId}
        opcoes={tipos.map((t) => ({ id: t.id, nome: t.nome }))}
        onChange={setTipoId}
        placeholder="Selecione o tipo"
        editable={!salvando}
      />
      <Text style={styles.label}>Valor (R$)</Text>
      <TextInput style={styles.input} value={valor} onChangeText={(t) => setValor(maskMoeda(t))} keyboardType="decimal-pad" placeholder="0,00" editable={!salvando} />
      {fornecedores.length > 0 && (
        <>
          <Text style={styles.label}>Fornecedor (cadastrado)</Text>
          <SelectBusca
            valor={fornecedorId}
            opcoes={fornecedores.map((f) => ({ id: f.id, nome: f.nome }))}
            onChange={setFornecedorId}
            placeholder="Selecione o fornecedor (opcional)"
            permiteLimpar
            editable={!salvando}
          />
        </>
      )}
      <Text style={styles.label}>Fornecedor (livre, se não cadastrado)</Text>
      <TextInput style={styles.input} value={fornecedor} onChangeText={setFornecedor} maxLength={120} editable={!salvando} />

      <Text style={styles.label}>Nº nota / documento</Text>
      <TextInput style={styles.input} value={semNota ? 'S/N' : numeroDocumento} onChangeText={setNumeroDocumento}
        editable={!salvando && !semNota} maxLength={60} placeholder="ex.: 12345 ou nota de débito" />
      <TouchableOpacity style={[styles.chip, semNota && styles.chipOn, { alignSelf: 'flex-start', marginTop: 6 }]}
        onPress={() => { setSemNota((v) => !v); setNumeroDocumento(''); }} disabled={salvando}>
        <Text style={[styles.chipTxt, semNota && styles.chipTxtOn]}>Sem nota fiscal (S/N)</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Fotos do cupom (opcional, até {MAX_FOTOS_DESPESA})</Text>
      {fotoUris.length > 0 && (
        <View style={styles.thumbs}>
          {fotoUris.map((uri, i) => (
            <View key={i} style={styles.thumbBox}>
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
              <TouchableOpacity style={styles.thumbX} onPress={() => removerFoto(i)} disabled={salvando}><Text style={styles.thumbXTxt}>✕</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      {fotoUris.length < MAX_FOTOS_DESPESA && (
        <View style={styles.fotoBtns}>
          <TouchableOpacity style={[styles.btnFoto, styles.btnFotoFlex]} onPress={tirarFoto} disabled={salvando}><Text style={styles.btnFotoTxt}>📷 Fotografar</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btnFoto, styles.btnFotoFlex]} onPress={escolherFotos} disabled={salvando}><Text style={styles.btnFotoTxt}>🖼️ Galeria</Text></TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[styles.registrar, !podeLancar && styles.registrarOff]} onPress={lancar} disabled={!podeLancar}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.registrarTxt}>Lançar despesa</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  conteudo: { padding: 16, gap: 12 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  vazio: { textAlign: 'center', color: '#64748b', fontSize: 15 },
  cab: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  placa: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  linhaInfo: { fontSize: 14, color: '#475569', marginTop: 4 },
  acoes: { flexDirection: 'row', gap: 8 },
  acao: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  acaoOn: { backgroundColor: CAPUL, borderColor: CAPUL },
  acaoTxt: { fontSize: 15, fontWeight: '700', color: '#334155' },
  acaoTxtOn: { color: '#fff' },
  painel: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 8 },
  passo: { fontSize: 15, fontWeight: '800', color: CAPUL },
  err: { fontSize: 13, fontWeight: '600', color: '#b91c1c', marginTop: 4 },
  dica: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff' },
  senhaWrap: { justifyContent: 'center' },
  senhaInput: { paddingRight: 48 },
  olho: { position: 'absolute', right: 8, padding: 6 },
  olhoTxt: { fontSize: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: CAPUL, borderColor: CAPUL },
  chipTxt: { color: '#334155', fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
  foto: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#e2e8f0', marginTop: 4 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  thumbBox: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#e2e8f0' },
  thumbX: { position: 'absolute', top: -6, right: -6, backgroundColor: '#e11d48', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  thumbXTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  fotoBtns: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btnFotoFlex: { flex: 1, paddingVertical: 18 },
  btnFoto: { borderWidth: 2, borderColor: CAPUL, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 28, alignItems: 'center', backgroundColor: '#fff', marginTop: 4 },
  btnFotoTxt: { color: CAPUL, fontSize: 16, fontWeight: '700' },
  refazer: { alignSelf: 'center', marginTop: 8 },
  refazerTxt: { color: CAPUL, fontWeight: '600' },
  registrar: { backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
  registrarOff: { opacity: 0.45 },
  registrarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  paradaCard: { borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginTop: 8 },
  paradaCardProx: { borderColor: CAPUL, borderWidth: 2, backgroundColor: '#ecfdf5' },
  proxTag: { fontSize: 10, fontWeight: '800', color: CAPUL, letterSpacing: 0.5, marginBottom: 2 },
  paradaLocal: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  paradaBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btnCheck: { flex: 1, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnCheckTxt: { color: '#fff', fontWeight: '700' },
  btnCancel: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', backgroundColor: '#fff' },
  btnCancelTxt: { color: '#475569', fontWeight: '600' },
  dicaMini: { fontSize: 11, color: '#64748b' },
  banner: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, padding: 12 },
  bannerTxt: { color: '#92400e', fontWeight: '700', textAlign: 'center' },
  rastreioBanner: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  rastreioTxt: { color: '#047857', fontWeight: '600', fontSize: 12, textAlign: 'center' },
});
