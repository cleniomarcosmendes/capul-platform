import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { tiposDespesa, fornecedoresDespesa, type FornecedorDespesa } from '../api/frota';
import { lancarDespesaEntrega } from '../api/viagens';
import { ehErroDeRede } from '../offline/filaFrota';
import { enfileirarDespesaEntrega } from '../offline/filaDespesaEntrega';
import { SelectBusca } from '../components/SelectBusca';
import { uuid } from '../lib/uuid';
import { maskMoeda, parseMoeda } from '../lib/moeda';
import { useScrollToFocusedInput } from '../lib/useScrollToFocusedInput';
import type { TipoDespesa } from '../types/api';

const CAPUL = '#1e7d3a';
const MAX_FOTOS_DESPESA = 5;
type Props = NativeStackScreenProps<RootStackParamList, 'DespesaEntrega'>;

/**
 * Lançar despesa na ROTA DE ENTREGA (ex.: abastecer o veículo). Vira custo do
 * veículo (frota) — sem acerto/adiantamento do entregador. Sem gate de condutor:
 * o entregador é o dono da rota. Foto do cupom opcional.
 */
export function DespesaEntregaScreen({ route, navigation }: Props) {
  const { viagemId, placa } = route.params;
  const { scrollRef, aoFocar } = useScrollToFocusedInput();
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [tipoId, setTipoId] = useState('');
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [fornecedorId, setFornecedorId] = useState('');
  const [valor, setValor] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [semNota, setSemNota] = useState(false);
  const [observacao, setObservacao] = useState('');
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
    const idem = uuid();
    const payload = {
      viagemId,
      tipoDespesaId: tipoId, valor: parseMoeda(valor),
      fornecedorId: fornecedorId || undefined, fornecedor: fornecedor.trim() || undefined,
      observacao: observacao.trim() || undefined,
      numeroDocumento: semNota ? undefined : (numeroDocumento.trim() || undefined),
      semNota: semNota || undefined, idempotencyKey: idem,
    };
    try {
      await lancarDespesaEntrega(payload, fotoUris);
      Alert.alert('Despesa lançada', 'Registrada como custo do veículo.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      if (ehErroDeRede(e)) {
        // Sem sinal (a rua): guarda a despesa + fotos e sincroniza depois.
        await enfileirarDespesaEntrega({ id: idem, rotulo: `Despesa R$ ${valor}`, viagemId, payload, fotoUris });
        Alert.alert('Salvo offline', 'Sem sinal — a despesa (e as fotos) vão sincronizar quando a conexão voltar.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
        Alert.alert('Não foi possível lançar', String(msg || 'Verifique a conexão e tente novamente.'));
      }
    } finally { setSalvando(false); }
  }

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={styles.container} contentContainerStyle={styles.conteudo}>
      <View style={styles.painel}>
        <Text style={styles.dica}>
          Despesa da rota{placa ? ` (${placa})` : ''} — ex.: abastecer o veículo. Entra como custo do veículo para a frota.
        </Text>

        <Text style={styles.label}>Tipo de despesa</Text>
        <SelectBusca
          valor={tipoId}
          opcoes={tipos.map((t) => ({ id: t.id, nome: t.nome }))}
          onChange={setTipoId}
          placeholder="Selecione o tipo (ex.: Abastecimento)"
          editable={!salvando}
        />

        <Text style={styles.label}>Valor (R$)</Text>
        <TextInput style={styles.input} onFocus={aoFocar} value={valor} onChangeText={(t) => setValor(maskMoeda(t))} keyboardType="decimal-pad" placeholder="0,00" editable={!salvando} />

        {fornecedores.length > 0 && (
          <>
            <Text style={styles.label}>Fornecedor (cadastrado)</Text>
            <SelectBusca
              valor={fornecedorId}
              opcoes={fornecedores.map((f) => ({ id: f.id, nome: f.nome }))}
              onChange={setFornecedorId}
              placeholder="Selecione o posto/fornecedor (opcional)"
              permiteLimpar
              editable={!salvando}
            />
          </>
        )}
        <Text style={styles.label}>Fornecedor (livre, se não cadastrado)</Text>
        <TextInput style={styles.input} onFocus={aoFocar} value={fornecedor} onChangeText={setFornecedor} maxLength={120} editable={!salvando} />

        <Text style={styles.label}>Nº nota / documento</Text>
        <TextInput style={styles.input} onFocus={aoFocar} value={semNota ? 'S/N' : numeroDocumento} onChangeText={setNumeroDocumento}
          editable={!salvando && !semNota} maxLength={60} placeholder="ex.: 12345 ou cupom do posto" />
        <TouchableOpacity style={[styles.chip, semNota && styles.chipOn]}
          onPress={() => { setSemNota((v) => !v); setNumeroDocumento(''); }} disabled={salvando}>
          <Text style={[styles.chipTxt, semNota && styles.chipTxtOn]}>Sem nota fiscal (S/N)</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Observação (opcional)</Text>
        <TextInput style={styles.input} onFocus={aoFocar} value={observacao} onChangeText={setObservacao} maxLength={255} editable={!salvando} />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  conteudo: { padding: 16, paddingBottom: 48 }, // folga p/ o último campo subir acima do teclado
  painel: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12 },
  dica: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff', marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', alignSelf: 'flex-start', marginTop: 6 },
  chipOn: { backgroundColor: CAPUL, borderColor: CAPUL },
  chipTxt: { color: '#334155', fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  thumbBox: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#e2e8f0' },
  thumbX: { position: 'absolute', top: -6, right: -6, backgroundColor: '#e11d48', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  thumbXTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  fotoBtns: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btnFotoFlex: { flex: 1 },
  btnFoto: { borderWidth: 2, borderColor: CAPUL, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 22, alignItems: 'center', backgroundColor: '#fff', marginTop: 4 },
  btnFotoTxt: { color: CAPUL, fontSize: 15, fontWeight: '700' },
  registrar: { backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  registrarOff: { opacity: 0.45 },
  registrarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
