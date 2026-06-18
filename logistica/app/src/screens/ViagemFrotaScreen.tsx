import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import {
  listarViagensFrota, registrarRetorno, tiposDespesa, lancarDespesaViagem,
  fornecedoresDespesa, adicionarParadaFrota, type FornecedorDespesa,
} from '../api/frota';
import type { TipoDespesa, ViagemFrota } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'ViagemFrota'>;
type Aba = null | 'parada' | 'retorno' | 'despesa';

/** Detalhe de uma viagem de frota EM CURSO: registrar retorno OU lançar despesa. */
export function ViagemFrotaScreen({ route, navigation }: Props) {
  const { viagemId } = route.params;
  const [viagem, setViagem] = useState<ViagemFrota | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = await listarViagensFrota('EM_CURSO');
      setViagem(lista.find((v) => v.id === viagemId) ?? null);
    } catch { /* mantém */ } finally { setCarregando(false); }
  }, [viagemId]);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  if (carregando) return <View style={styles.centro}><ActivityIndicator size="large" color={CAPUL} /></View>;
  if (!viagem) return <View style={styles.centro}><Text style={styles.vazio}>Viagem não está mais em curso.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <View style={styles.cab}>
        <Text style={styles.placa}>{viagem.placa}{viagem.modelo ? ` · ${viagem.modelo}` : ''}</Text>
        <Text style={styles.linhaInfo}>Viagem #{viagem.numero} · {viagem.paradas} parada{viagem.paradas === 1 ? '' : 's'}</Text>
        <Text style={styles.linhaInfo}>Condutor: {viagem.condutorNome ?? '—'}</Text>
        {viagem.kmInicial != null ? <Text style={styles.linhaInfo}>KM saída: {viagem.kmInicial.toLocaleString('pt-BR')}</Text> : null}
        {viagem.finalidade ? <Text style={styles.linhaInfo}>Finalidade: {viagem.finalidade}</Text> : null}
      </View>

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
      {aba === 'retorno' && <RetornoForm viagem={viagem} onPronto={() => navigation.goBack()} />}
      {aba === 'despesa' && <DespesaForm viagem={viagem} onPronto={() => { setAba(null); void carregar(); }} />}
    </ScrollView>
  );
}

function ParadaForm({ viagem, onRegistrada }: { viagem: ViagemFrota; onRegistrada: () => void }) {
  const [local, setLocal] = useState('');
  const [km, setKm] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const podeRegistrar = !!local.trim() && !salvando;

  async function registrar() {
    if (!podeRegistrar) return;
    setSalvando(true);
    try {
      await adicionarParadaFrota(viagem.id, {
        local: local.trim(),
        km: km !== '' ? Number(km) : undefined,
        observacao: obs.trim() || undefined,
      });
      // Limpa pra registrar a próxima parada sem sair (o "caderno" da rota).
      setLocal(''); setKm(''); setObs('');
      onRegistrada();
      Alert.alert('Parada registrada', 'Pode registrar a próxima quando chegar.');
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
      Alert.alert('Não foi possível registrar', String(msg || 'Tente novamente.'));
    } finally { setSalvando(false); }
  }

  return (
    <View style={styles.painel}>
      <Text style={styles.dica}>Registre os pontos de parada durante a viagem (o caderno da rota). O retorno é o que fecha a viagem.</Text>
      <Text style={styles.label}>Local da parada</Text>
      <TextInput style={styles.input} value={local} onChangeText={setLocal} maxLength={120} placeholder="Ex.: Posto BR, Cliente X, Oficina…" editable={!salvando} />
      <Text style={styles.label}>KM atual (opcional)</Text>
      <TextInput style={styles.input} value={km} onChangeText={setKm} keyboardType="numeric" editable={!salvando} />
      <Text style={styles.label}>Observação (opcional)</Text>
      <TextInput style={styles.input} value={obs} onChangeText={setObs} maxLength={255} editable={!salvando} />
      <TouchableOpacity style={[styles.registrar, !podeRegistrar && styles.registrarOff]} onPress={registrar} disabled={!podeRegistrar}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.registrarTxt}>Registrar parada</Text>}
      </TouchableOpacity>
    </View>
  );
}

function RetornoForm({ viagem, onPronto }: { viagem: ViagemFrota; onPronto: () => void }) {
  const [matricula, setMatricula] = useState(viagem.condutorMatricula ?? '');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [kmFinal, setKmFinal] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const podeRegistrar = !!matricula.trim() && !!senha && kmFinal !== '' && Number(kmFinal) >= 0 && !salvando;

  async function registrar() {
    if (!podeRegistrar) return;
    if (viagem.kmInicial != null && Number(kmFinal) < viagem.kmInicial) {
      Alert.alert('KM final', `O KM final (${kmFinal}) é menor que o KM de saída (${viagem.kmInicial}).`);
      return;
    }
    setSalvando(true);
    try {
      await registrarRetorno(viagem.id, { matricula: matricula.trim(), senha, kmFinal: Number(kmFinal), observacoes: obs.trim() || undefined });
      Alert.alert('Retorno registrado', `${viagem.placa} de volta.`, [{ text: 'OK', onPress: onPronto }]);
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
      Alert.alert('Não foi possível registrar', String(msg || 'Tente novamente.'));
    } finally { setSalvando(false); }
  }

  return (
    <View style={styles.painel}>
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
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [tipoId, setTipoId] = useState('');
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [fornecedorId, setFornecedorId] = useState('');
  const [valor, setValor] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void (async () => { try { setTipos(await tiposDespesa()); } catch { /* vazio */ } })();
    void (async () => { try { setFornecedores(await fornecedoresDespesa()); } catch { /* vazio */ } })();
  }, []);

  const podeLancar = !!tipoId && valor !== '' && Number(valor) > 0 && !salvando;

  async function tirarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Câmera', 'Permita a câmera para fotografar o cupom.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!r.canceled && r.assets[0]?.uri) setFotoUri(r.assets[0].uri);
  }

  async function lancar() {
    if (!podeLancar) return;
    setSalvando(true);
    try {
      await lancarDespesaViagem(
        { viagemId: viagem.id, tipoDespesaId: tipoId, valor: Number(valor), fornecedorId: fornecedorId || undefined, fornecedor: fornecedor.trim() || undefined },
        fotoUri ?? undefined,
      );
      Alert.alert('Despesa lançada', 'Entrou como pendente de validação do supervisor.', [{ text: 'OK', onPress: onPronto }]);
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
      Alert.alert('Não foi possível lançar', String(msg || 'Tente novamente.'));
    } finally { setSalvando(false); }
  }

  return (
    <View style={styles.painel}>
      <Text style={styles.dica}>Despesa do condutor {viagem.condutorNome ?? ''} — entra como pendente.</Text>
      <Text style={styles.label}>Tipo de despesa</Text>
      <View style={styles.chips}>
        {tipos.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.chip, tipoId === t.id && styles.chipOn]} onPress={() => setTipoId(t.id)}>
            <Text style={[styles.chipTxt, tipoId === t.id && styles.chipTxtOn]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Valor (R$)</Text>
      <TextInput style={styles.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" editable={!salvando} />
      {fornecedores.length > 0 && (
        <>
          <Text style={styles.label}>Fornecedor (cadastrado)</Text>
          <View style={styles.chips}>
            {fornecedores.map((f) => (
              <TouchableOpacity key={f.id} style={[styles.chip, fornecedorId === f.id && styles.chipOn]} onPress={() => setFornecedorId(fornecedorId === f.id ? '' : f.id)}>
                <Text style={[styles.chipTxt, fornecedorId === f.id && styles.chipTxtOn]}>{f.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      <Text style={styles.label}>Fornecedor (livre, se não cadastrado)</Text>
      <TextInput style={styles.input} value={fornecedor} onChangeText={setFornecedor} maxLength={120} editable={!salvando} />

      <Text style={styles.label}>Foto do cupom (opcional)</Text>
      {fotoUri ? (
        <View>
          <Image source={{ uri: fotoUri }} style={styles.foto} resizeMode="cover" />
          <TouchableOpacity style={styles.refazer} onPress={() => setFotoUri(null)} disabled={salvando}><Text style={styles.refazerTxt}>Remover foto</Text></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.btnFoto} onPress={tirarFoto} disabled={salvando}><Text style={styles.btnFotoTxt}>📷 Fotografar cupom</Text></TouchableOpacity>
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
  btnFoto: { borderWidth: 2, borderColor: CAPUL, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 28, alignItems: 'center', backgroundColor: '#fff', marginTop: 4 },
  btnFotoTxt: { color: CAPUL, fontSize: 16, fontWeight: '700' },
  refazer: { alignSelf: 'center', marginTop: 8 },
  refazerTxt: { color: CAPUL, fontWeight: '600' },
  registrar: { backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
  registrarOff: { opacity: 0.45 },
  registrarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
