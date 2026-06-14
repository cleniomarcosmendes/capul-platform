import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { buscarCondutor, validarCondutor, veiculosDisponiveis, registrarSaida } from '../api/frota';
import type { VeiculoFrota } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'SaidaFrota'>;

/**
 * Saída de veículo (self-service). Passo a passo igual à web: matrícula → nome →
 * senha (valida 200, nunca desloga) → veículo + km. A senha é REVALIDADA no
 * registrar (backend), então a validação aqui é só pra liberar o resto do form.
 */
export function SaidaFrotaScreen({ navigation }: Props) {
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState<string | null>(null);
  const [buscandoNome, setBuscandoNome] = useState(false);
  const [senha, setSenha] = useState('');
  const [credOk, setCredOk] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  const [veiculos, setVeiculos] = useState<VeiculoFrota[]>([]);
  const [veiculoId, setVeiculoId] = useState('');
  const [km, setKm] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void (async () => {
      try { setVeiculos(await veiculosDisponiveis()); } catch { /* lista vazia */ }
    })();
  }, []);

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

  const podeRegistrar = credOk && !!veiculoId && km !== '' && Number(km) >= 0 && !salvando;

  async function registrar() {
    if (!podeRegistrar) return;
    if (veiculo && Number(km) < veiculo.kmAtual) {
      Alert.alert('KM inicial', `O KM informado (${km}) é menor que o KM atual do veículo (${veiculo.kmAtual}).`);
      return;
    }
    setSalvando(true);
    try {
      const v = await registrarSaida({
        matricula: matricula.trim(), senha, veiculoId,
        kmInicial: Number(km), finalidade: finalidade.trim() || undefined,
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
      <Text style={styles.passo}>1. Condutor</Text>
      <Text style={styles.label}>Matrícula</Text>
      <View style={styles.linha}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Matrícula do condutor"
          value={matricula}
          onChangeText={(t) => { setMatricula(t); setNome(null); setCredOk(false); }}
          keyboardType="numeric"
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
          <TextInput
            style={[styles.input, credOk && styles.inputOk, !!erroSenha && styles.inputErr]}
            placeholder="Senha"
            value={senha}
            onChangeText={(t) => { setSenha(t); setCredOk(false); setErroSenha(''); }}
            secureTextEntry
            editable={!salvando}
            onBlur={validarSenha}
          />
          {validando ? <Text style={styles.dica}>Validando…</Text> : null}
          {credOk ? <Text style={styles.ok}>✓ Condutor confirmado</Text> : null}
          {erroSenha ? <Text style={styles.err}>{erroSenha}</Text> : null}
          {!credOk && !validando && senha ? (
            <TouchableOpacity style={styles.btnValidar} onPress={validarSenha}><Text style={styles.btnValidarTxt}>Validar senha</Text></TouchableOpacity>
          ) : null}
        </>
      ) : null}

      {credOk ? (
        <>
          <Text style={[styles.passo, { marginTop: 18 }]}>2. Veículo e saída</Text>
          <Text style={styles.label}>Veículo disponível</Text>
          <View style={styles.chips}>
            {veiculos.length === 0 ? (
              <Text style={styles.dica}>Nenhum veículo disponível na filial.</Text>
            ) : veiculos.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.chip, veiculoId === v.id && styles.chipOn]}
                onPress={() => { setVeiculoId(v.id); if (km === '') setKm(String(v.kmAtual)); }}
              >
                <Text style={[styles.chipTxt, veiculoId === v.id && styles.chipTxtOn]}>{v.placa}{v.modelo ? ` · ${v.modelo}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>KM inicial (odômetro)</Text>
          <TextInput style={styles.input} placeholder="KM no painel" value={km} onChangeText={setKm} keyboardType="numeric" editable={!salvando} />
          {veiculo ? <Text style={styles.dica}>KM atual do veículo: {veiculo.kmAtual.toLocaleString('pt-BR')}</Text> : null}

          <Text style={styles.label}>Finalidade / destino (opcional)</Text>
          <TextInput style={styles.input} placeholder="Ex.: entrega no fornecedor X" value={finalidade} onChangeText={setFinalidade} maxLength={255} editable={!salvando} />

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
  btnBuscar: { backgroundColor: CAPUL, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  btnBuscarTxt: { color: '#fff', fontWeight: '700' },
  nome: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginTop: 6 },
  dica: { fontSize: 12, color: '#64748b' },
  ok: { fontSize: 13, fontWeight: '700', color: CAPUL, marginTop: 4 },
  err: { fontSize: 13, fontWeight: '600', color: '#b91c1c', marginTop: 4 },
  btnValidar: { alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: CAPUL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btnValidarTxt: { color: CAPUL, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: CAPUL, borderColor: CAPUL },
  chipTxt: { color: '#334155', fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
  registrar: { backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  registrarOff: { opacity: 0.45 },
  registrarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
