import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { SelectBusca } from '../components/SelectBusca';
import {
  obterViagemSupervisor, adicionarVisitaApp, lancarDespesaApp,
  listarAtividadesSup, listarRegioesSup, listarTiposDespesaSup,
  type ViagemSupDetalhe, type AtividadeSup, type RegiaoSup, type TipoDespesaSup,
} from '../api/supervisor';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'SupervisorViagem'>;

const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
function msg(e: unknown, fb: string) {
  if (isAxiosError(e)) return (e.response?.data as { message?: string } | undefined)?.message || fb;
  return fb;
}

/** Detalhe da viagem mensal do supervisor: registrar visita e despesa em campo. */
export function SupervisorViagemScreen({ route }: Props) {
  const { viagemId } = route.params;
  const [v, setV] = useState<ViagemSupDetalhe | null>(null);
  const [ativs, setAtivs] = useState<AtividadeSup[]>([]);
  const [regs, setRegs] = useState<RegiaoSup[]>([]);
  const [tipos, setTipos] = useState<TipoDespesaSup[]>([]);
  const [carregando, setCarregando] = useState(true);
  // form visita
  const [cliNome, setCliNome] = useState(''); const [muni, setMuni] = useState(''); const [ativId, setAtivId] = useState('');
  const [regId, setRegId] = useState(''); const [prop, setProp] = useState(''); const [vObs, setVObs] = useState('');
  const [salvV, setSalvV] = useState(false);
  // form despesa
  const [tipoId, setTipoId] = useState(''); const [valor, setValor] = useState(''); const [dForn, setDForn] = useState(''); const [dObs, setDObs] = useState('');
  const [salvD, setSalvD] = useState(false);

  const carregar = useCallback(async () => {
    const [d, a, r, t] = await Promise.all([
      obterViagemSupervisor(viagemId), listarAtividadesSup(), listarRegioesSup(), listarTiposDespesaSup(),
    ]);
    setV(d); setAtivs(a); setRegs(r); setTipos(t);
  }, [viagemId]);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      try { await carregar(); } catch { Alert.alert('Erro', 'Falha ao carregar a viagem.'); }
      if (ativo) setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [carregar]));

  const concluida = v?.situacao === 'CONCLUIDA';

  const salvarVisita = async () => {
    if (!cliNome.trim()) { Alert.alert('Visita', 'Informe o cliente (ou prospect).'); return; }
    setSalvV(true);
    try {
      await adicionarVisitaApp(viagemId, {
        clienteNome: cliNome.trim(), municipio: muni.trim() || undefined,
        atividadeId: ativId || undefined, regiaoId: regId || undefined,
        propriedade: prop.trim() || undefined, observacao: vObs.trim() || undefined,
      });
      setCliNome(''); setMuni(''); setAtivId(''); setProp(''); setVObs('');
      await carregar();
      Alert.alert('Pronto', 'Visita registrada.');
    } catch (e) { Alert.alert('Erro', msg(e, 'Falha ao registrar visita.')); } finally { setSalvV(false); }
  };

  const salvarDespesa = async () => {
    if (!tipoId || !valor) { Alert.alert('Despesa', 'Escolha o tipo e informe o valor.'); return; }
    setSalvD(true);
    try {
      await lancarDespesaApp(viagemId, {
        tipoDespesaId: tipoId, valor: Number(valor),
        fornecedor: dForn.trim() || undefined, observacao: dObs.trim() || undefined,
      });
      setTipoId(''); setValor(''); setDForn(''); setDObs('');
      await carregar();
      Alert.alert('Pronto', 'Despesa lançada.');
    } catch (e) { Alert.alert('Erro', msg(e, 'Falha ao lançar despesa.')); } finally { setSalvD(false); }
  };

  if (carregando) return <View style={styles.center}><ActivityIndicator size="large" color={CAPUL} /></View>;
  if (!v) return <View style={styles.center}><Text>Viagem não encontrada.</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.hTitle}>{v.regiao?.nome ?? 'Sem região'}</Text>
        <Text style={styles.hSub}>Supervisor: {v.condutorNome ?? '—'} · Adiant.: {brl(v.adiantamento)}</Text>
        {concluida && <Text style={styles.concl}>Viagem concluída (somente leitura)</Text>}
      </View>

      {!concluida && (
        <View style={styles.card}>
          <Text style={styles.sTitle}>Nova visita</Text>
          <TextInput style={styles.input} placeholder="Cliente / prospect" value={cliNome} onChangeText={setCliNome} />
          <TextInput style={styles.input} placeholder="Município" value={muni} onChangeText={setMuni} />
          <SelectBusca valor={ativId} opcoes={ativs.map((a) => ({ id: a.id, nome: a.nome }))} onChange={setAtivId} placeholder="Atividade" permiteLimpar />
          <View style={styles.gap} />
          <SelectBusca valor={regId} opcoes={regs.map((r) => ({ id: r.id, nome: r.nome }))} onChange={setRegId} placeholder="Região" permiteLimpar />
          <TextInput style={styles.input} placeholder="Propriedade / fazenda" value={prop} onChangeText={setProp} />
          <TextInput style={styles.input} placeholder="Observação" value={vObs} onChangeText={setVObs} />
          <TouchableOpacity style={[styles.btn, salvV && styles.btnOff]} onPress={() => void salvarVisita()} disabled={salvV}>
            <Text style={styles.btnTxt}>{salvV ? 'Salvando…' : 'Registrar visita'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.listTitle}>Visitas ({v.paradas.length})</Text>
      {v.paradas.length === 0 && <Text style={styles.vazio}>Nenhuma visita ainda.</Text>}
      {v.paradas.map((p) => (
        <View key={p.id} style={styles.item}>
          <Text style={styles.itemTitle}>{p.clienteNome ?? '—'}{p.municipio ? ` · ${p.municipio}` : ''}</Text>
          <Text style={styles.itemSub}>{p.atividade?.nome ?? '—'}{p.propriedade ? ` · ${p.propriedade}` : ''}</Text>
        </View>
      ))}

      {!concluida && (
        <View style={styles.card}>
          <Text style={styles.sTitle}>Nova despesa</Text>
          <SelectBusca valor={tipoId} opcoes={tipos.map((t) => ({ id: t.id, nome: t.nome, subtitulo: t.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo' }))} onChange={setTipoId} placeholder="Tipo de despesa" />
          <TextInput style={styles.input} placeholder="Valor (R$)" keyboardType="decimal-pad" value={valor} onChangeText={setValor} />
          <TextInput style={styles.input} placeholder="Fornecedor" value={dForn} onChangeText={setDForn} />
          <TextInput style={styles.input} placeholder="Observação" value={dObs} onChangeText={setDObs} />
          <TouchableOpacity style={[styles.btn, salvD && styles.btnOff]} onPress={() => void salvarDespesa()} disabled={salvD}>
            <Text style={styles.btnTxt}>{salvD ? 'Salvando…' : 'Lançar despesa'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.listTitle}>Despesas ({v.despesas.length})</Text>
      {v.despesas.length === 0 && <Text style={styles.vazio}>Nenhuma despesa ainda.</Text>}
      {v.despesas.map((d) => (
        <View key={d.id} style={styles.item}>
          <Text style={styles.itemTitle}>{d.tipoDespesa?.nome ?? '—'} · {brl(d.valor)}</Text>
          <Text style={styles.itemSub}>{d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  hTitle: { fontSize: 16, fontWeight: '700', color: CAPUL },
  hSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  concl: { marginTop: 6, fontSize: 12, fontWeight: '600', color: '#b45309' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 8 },
  gap: { height: 8 },
  btn: { backgroundColor: CAPUL, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnOff: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 8 },
  vazio: { color: '#94a3b8', fontSize: 13 },
  item: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
