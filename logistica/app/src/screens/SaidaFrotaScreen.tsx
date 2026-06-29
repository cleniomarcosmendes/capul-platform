import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useAuth } from '../auth/AuthContext';
import {
  buscarCondutor, validarCondutor, veiculosDisponiveis, registrarSaida, registrarSaidaIndividual,
  listarLocaisParada, type LocalParada,
} from '../api/frota';
import type { VeiculoFrota } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'SaidaFrota'>;

/**
 * Saída de veículo (self-service). Dois fluxos pelo TIPO do usuário:
 *  - INDIVIDUAL: já autenticado é o próprio condutor → NÃO pede matrícula/senha.
 *  - PADRAO (login genérico/compartilhado): pede matrícula + senha do portal RH.
 * A senha PADRAO é revalidada no backend ao registrar.
 */
export function SaidaFrotaScreen({ navigation }: Props) {
  const { tipo, departamentoId, filialId } = useAuth();
  const ehIndividual = tipo === 'INDIVIDUAL';

  // --- Identificação (só PADRAO) ---
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState<string | null>(null);
  const [buscandoNome, setBuscandoNome] = useState(false);
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [credOk, setCredOk] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  // --- Veículo e saída ---
  const [veiculos, setVeiculos] = useState<VeiculoFrota[]>([]);
  const [carregandoVeiculos, setCarregandoVeiculos] = useState(true);
  const [busca, setBusca] = useState('');
  // Filtro "Filial · Departamento" (nasce no setor do usuário; ele troca se quiser).
  const [filtroFD, setFiltroFD] = useState('');
  const [fdAberto, setFdAberto] = useState(false);
  const [fdTocado, setFdTocado] = useState(false);
  const [veiculoId, setVeiculoId] = useState('');
  const [km, setKm] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [planejadasTxt, setPlanejadasTxt] = useState(''); // rota planejada (um local por linha)
  const [locais, setLocais] = useState<LocalParada[]>([]);
  const [buscaLocal, setBuscaLocal] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Locais cadastrados (atalho do planejamento — pode-se digitar avulso também).
  useEffect(() => { void (async () => { try { setLocais(await listarLocaisParada()); } catch { /* vazio */ } })(); }, []);

  const addLocal = (n: string) => setPlanejadasTxt((t) => (t.trim() ? `${t}\n${n}` : n));
  // Sugeridos: globais (sem veículo/depto) + os do veículo selecionado. Curto.
  const sugeridos = locais
    .filter((l) => (!l.veiculoId && !l.departamentoId) || l.veiculoId === veiculoId)
    .slice(0, 8);
  // Busca: filtra TODO o cadastro pelo texto (typeahead) — escala p/ muitos locais.
  const resultadosBusca = buscaLocal.trim()
    ? locais.filter((l) => l.nome.toLowerCase().includes(buscaLocal.trim().toLowerCase())).slice(0, 10)
    : [];

  // Frota é compartilhável: carrega DISPONÍVEIS de qualquer filial/departamento.
  // A busca (placa) também procura na empresa toda. O recorte por setor é local.
  useEffect(() => {
    let ativo = true;
    const t = setTimeout(async () => {
      setCarregandoVeiculos(true);
      try {
        const termo = busca.trim();
        const lista = await veiculosDisponiveis(termo ? { busca: termo } : {});
        if (ativo) setVeiculos(lista);
      } catch {
        if (ativo) setVeiculos([]);
      } finally {
        if (ativo) setCarregandoVeiculos(false);
      }
    }, 300);
    return () => { ativo = false; clearTimeout(t); };
  }, [busca]);

  // --- Filtro Filial · Departamento (chave por IDs; rótulo por nomes) ---
  const chaveFD = (v: VeiculoFrota) => `${v.filialId ?? ''}|${v.departamentoLotacaoId ?? ''}`;
  const rotuloFD = (v: VeiculoFrota) => `${v.filialNome ?? '—'} · ${v.departamentoNome ?? '—'}`;
  const opcoesFD = useMemo(() => {
    const m = new Map<string, { rotulo: string; n: number }>();
    veiculos.forEach((v) => {
      const k = chaveFD(v);
      m.set(k, { rotulo: rotuloFD(v), n: (m.get(k)?.n ?? 0) + 1 });
    });
    return Array.from(m.entries())
      .map(([key, val]) => ({ key, rotulo: val.rotulo, n: val.n }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  }, [veiculos]);

  // Default = setor do usuário (filial+depto do login), enquanto ele não mexer no filtro.
  const comboUsuario = filialId && departamentoId ? `${filialId}|${departamentoId}` : '';
  useEffect(() => {
    if (fdTocado) return;
    if (comboUsuario && opcoesFD.some((o) => o.key === comboUsuario)) setFiltroFD(comboUsuario);
  }, [opcoesFD, comboUsuario, fdTocado]);

  const escolherFD = (key: string) => { setFiltroFD(key); setFdTocado(true); setFdAberto(false); };
  const filtroValido = !!filtroFD && opcoesFD.some((o) => o.key === filtroFD);
  const rotuloAtual = filtroValido
    ? opcoesFD.find((o) => o.key === filtroFD)!.rotulo
    : 'Todas as filiais / departamentos';
  const veiculosFiltrados = filtroValido ? veiculos.filter((v) => chaveFD(v) === filtroFD) : veiculos;

  const veiculo = veiculos.find((v) => v.id === veiculoId);

  async function acharNome() {
    if (!matricula.trim()) return;
    setBuscandoNome(true); setNome(null); setCredOk(false); setErroSenha('');
    try {
      const r = await buscarCondutor(matricula.trim());
      setNome(r.nome);
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
      Alert.alert('Condutor', String(msg || 'Matrícula não encontrada no Protheus.'));
    } finally {
      setBuscandoNome(false);
    }
  }

  async function validarSenha() {
    if (!senha || !matricula.trim()) return;
    setValidando(true); setErroSenha('');
    try {
      const r = await validarCondutor(matricula.trim(), senha);
      if (r.valida) {
        setCredOk(true);
        if (!nome) setNome(r.nome);
      } else {
        setCredOk(false);
        setErroSenha(r.motivo === 'INDISPONIVEL'
          ? 'Portal indisponível. Tente novamente em instantes.'
          : 'Senha inválida.');
      }
    } catch {
      setErroSenha('Falha ao validar. Verifique a conexão.');
    } finally {
      setValidando(false);
    }
  }

  // INDIVIDUAL não precisa de credOk; PADRAO sim.
  const identificado = ehIndividual || credOk;
  const podeRegistrar = identificado && !!veiculoId && km !== '' && Number(km) >= 0 && !salvando;

  async function registrar() {
    if (!podeRegistrar) return;
    if (veiculo && Number(km) < veiculo.kmAtual) {
      Alert.alert('KM inicial', `O KM informado (${km}) é menor que o KM atual do veículo (${veiculo.kmAtual}).`);
      return;
    }
    const paradasPlanejadas = planejadasTxt.split('\n').map((l) => l.trim()).filter(Boolean);
    const rota = paradasPlanejadas.length ? paradasPlanejadas : undefined;
    setSalvando(true);
    try {
      const v = ehIndividual
        ? await registrarSaidaIndividual({
            veiculoId, kmInicial: Number(km), finalidade: finalidade.trim() || undefined, paradasPlanejadas: rota,
          })
        : await registrarSaida({
            matricula: matricula.trim(), senha, veiculoId,
            kmInicial: Number(km), finalidade: finalidade.trim() || undefined, paradasPlanejadas: rota,
          });
      Alert.alert('Saída registrada', `${v.placa} · viagem #${v.numero}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
      Alert.alert('Não foi possível registrar', String(msg || 'Tente novamente.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      {/* Passo 1 — Condutor (só PADRAO; INDIVIDUAL já está identificado pelo login) */}
      {!ehIndividual ? (
        <>
          <Text style={styles.passo}>1. Condutor</Text>
          <Text style={styles.label}>Matrícula</Text>
          <View style={styles.linha}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="ex.: E01047 ou 001047"
              value={matricula}
              onChangeText={(t) => { setMatricula(t.toUpperCase()); setNome(null); setCredOk(false); }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!salvando}
              onBlur={acharNome}
            />
            <TouchableOpacity style={styles.btnBuscar} onPress={acharNome} disabled={buscandoNome || !matricula.trim()}>
              {buscandoNome ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnBuscarTxt}>Buscar</Text>}
            </TouchableOpacity>
          </View>
          {nome ? <Text style={styles.nome}>👤 {nome}</Text> : null}

          {nome ? (
            <>
              <Text style={styles.label}>Senha do portal RH</Text>
              <View style={styles.senhaWrap}>
                <TextInput
                  style={[styles.input, styles.senhaInput, credOk && styles.inputOk, !!erroSenha && styles.inputErr]}
                  placeholder="Senha"
                  value={senha}
                  onChangeText={(t) => { setSenha(t); setCredOk(false); setErroSenha(''); }}
                  secureTextEntry={!mostrarSenha}
                  editable={!salvando}
                  onBlur={validarSenha}
                />
                <TouchableOpacity style={styles.olho} onPress={() => setMostrarSenha((v) => !v)} hitSlop={10}>
                  <Text style={styles.olhoTxt}>{mostrarSenha ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {validando ? <Text style={styles.dica}>Validando…</Text> : null}
              {credOk ? <Text style={styles.ok}>✓ Condutor confirmado</Text> : null}
              {erroSenha ? <Text style={styles.err}>{erroSenha}</Text> : null}
              {!credOk && !validando && senha ? (
                <TouchableOpacity style={styles.btnValidar} onPress={validarSenha}><Text style={styles.btnValidarTxt}>Validar senha</Text></TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* Passo 2 — Veículo e saída */}
      {identificado ? (
        <>
          <Text style={[styles.passo, !ehIndividual && { marginTop: 18 }]}>
            {ehIndividual ? 'Veículo e saída' : '2. Veículo e saída'}
          </Text>

          <Text style={styles.label}>Buscar veículo (placa / modelo)</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a placa para procurar outro veículo"
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!salvando}
          />

          {opcoesFD.length > 1 ? (
            <>
              <Text style={styles.label}>Filial · Departamento</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setFdAberto((o) => !o)} disabled={salvando}>
                <Text style={styles.dropdownTxt} numberOfLines={1}>{rotuloAtual}</Text>
                <Text style={styles.dropdownSeta}>{fdAberto ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {fdAberto ? (
                <View style={styles.dropdownLista}>
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => escolherFD('')}>
                    <Text style={styles.dropdownItemTxt}>Todas as filiais / departamentos</Text>
                  </TouchableOpacity>
                  {opcoesFD.map((o) => (
                    <TouchableOpacity key={o.key} style={styles.dropdownItem} onPress={() => escolherFD(o.key)}>
                      <Text style={styles.dropdownItemTxt}>{o.rotulo} ({o.n})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          <Text style={styles.label}>Veículo disponível</Text>
          {carregandoVeiculos ? (
            <View style={styles.veicVazio}><ActivityIndicator color={CAPUL} /></View>
          ) : veiculosFiltrados.length === 0 ? (
            <View style={styles.veicVazio}>
              <Text style={styles.veicVazioTit}>Nenhum veículo disponível</Text>
              <Text style={styles.veicVazioSub}>
                {busca.trim()
                  ? `Nada encontrado para "${busca.trim()}". Limpe a busca para ver os demais.`
                  : filtroValido
                    ? 'Nenhum veículo livre nesta filial/departamento. Toque no filtro acima para ver outros.'
                    : 'Não há veículo livre no momento (todos em uso ou nenhum cadastrado).'}
              </Text>
            </View>
          ) : (
            <View style={styles.chips}>
              {veiculosFiltrados.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, veiculoId === v.id && styles.chipOn]}
                  onPress={() => { setVeiculoId(v.id); setKm(String(v.kmAtual)); }}
                >
                  <Text style={[styles.chipTxt, veiculoId === v.id && styles.chipTxtOn]}>{v.placa}{v.modelo ? ` · ${v.modelo}` : ''}</Text>
                  {(v.filialNome || v.departamentoNome) ? (
                    <Text style={[styles.chipSub, veiculoId === v.id && styles.chipTxtOn]} numberOfLines={1}>
                      {[v.filialNome, v.departamentoNome].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>KM inicial (odômetro)</Text>
          <TextInput style={styles.input} placeholder="KM no painel" value={km} onChangeText={setKm} keyboardType="numeric" editable={!salvando} />
          {veiculo ? <Text style={styles.dica}>KM atual do veículo: {veiculo.kmAtual.toLocaleString('pt-BR')}</Text> : null}

          <Text style={styles.label}>Finalidade / destino (opcional)</Text>
          <TextInput style={styles.input} placeholder="Ex.: entrega no fornecedor X" value={finalidade} onChangeText={setFinalidade} maxLength={255} editable={!salvando} />

          <Text style={styles.label}>Rota planejada (opcional)</Text>
          {locais.length > 0 && (
            <>
              <TextInput style={styles.input} value={buscaLocal} onChangeText={setBuscaLocal}
                placeholder="🔎 Buscar local do cadastro…" editable={!salvando} />
              {buscaLocal.trim() ? (
                resultadosBusca.length > 0 ? (
                  <View style={styles.buscaLista}>
                    {resultadosBusca.map((l) => (
                      <TouchableOpacity key={l.id} style={styles.buscaItem} disabled={salvando}
                        onPress={() => { addLocal(l.nome); setBuscaLocal(''); }}>
                        <Text style={styles.buscaItemTxt}>📍 {l.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : <Text style={styles.dicaMini}>Nenhum local encontrado — digite avulso abaixo.</Text>
              ) : sugeridos.length > 0 ? (
                <View style={styles.chipsLocais}>
                  {sugeridos.map((l) => (
                    <TouchableOpacity key={l.id} style={styles.chipLocal} disabled={salvando} onPress={() => addLocal(l.nome)}>
                      <Text style={styles.chipLocalTxt}>+ {l.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </>
          )}
          <TextInput
            style={[styles.input, { minHeight: 84, textAlignVertical: 'top' }]}
            placeholder={'Uma visita por linha:\nCliente A\nFornecedor B'}
            value={planejadasTxt} onChangeText={setPlanejadasTxt} multiline editable={!salvando}
          />
          <Text style={styles.dica}>Toque nos atalhos do cadastro ou digite um por linha. Entram como planejadas; você dá baixa ("Cheguei") durante a viagem.</Text>

          <TouchableOpacity style={[styles.registrar, !podeRegistrar && styles.registrarOff]} onPress={registrar} disabled={!podeRegistrar}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.registrarTxt}>Registrar saída</Text>}
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  conteudo: { padding: 16, gap: 8 },
  passo: { fontSize: 15, fontWeight: '800', color: CAPUL },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 8 },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff' },
  inputOk: { borderColor: CAPUL },
  inputErr: { borderColor: '#b91c1c' },
  senhaWrap: { justifyContent: 'center' },
  senhaInput: { paddingRight: 48 },
  olho: { position: 'absolute', right: 8, padding: 6 },
  olhoTxt: { fontSize: 20 },
  btnBuscar: { backgroundColor: CAPUL, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  btnBuscarTxt: { color: '#fff', fontWeight: '700' },
  nome: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginTop: 6 },
  dica: { fontSize: 12, color: '#64748b' },
  ok: { fontSize: 13, fontWeight: '700', color: CAPUL, marginTop: 4 },
  err: { fontSize: 13, fontWeight: '600', color: '#b91c1c', marginTop: 4 },
  btnValidar: { alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: CAPUL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btnValidarTxt: { color: CAPUL, fontWeight: '700' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', marginTop: 4 },
  dropdownTxt: { fontSize: 15, color: '#0f172a', flex: 1 },
  dropdownSeta: { fontSize: 12, color: '#64748b', marginLeft: 8 },
  dropdownLista: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 6, overflow: 'hidden', backgroundColor: '#fff' },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemTxt: { fontSize: 14, color: '#0f172a' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: CAPUL, borderColor: CAPUL },
  chipTxt: { color: '#334155', fontWeight: '600' },
  chipSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  chipTxtOn: { color: '#fff' },
  veicVazio: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  veicVazioTit: { fontSize: 15, fontWeight: '700', color: '#b45309' },
  veicVazioSub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 19 },
  registrar: { backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  registrarOff: { opacity: 0.45 },
  registrarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chipsLocais: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 2 },
  chipLocal: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipLocalTxt: { color: '#334155', fontWeight: '600', fontSize: 13 },
  dicaMini: { fontSize: 12, color: '#64748b', marginTop: 6 },
  buscaLista: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 6, overflow: 'hidden' },
  buscaItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  buscaItemTxt: { color: '#0f172a', fontSize: 14 },
});
