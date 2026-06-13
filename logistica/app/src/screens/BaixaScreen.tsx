import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { isAxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { baixarEntrega, type BaixaPayload } from '../api/baixa';
import { enfileirar } from '../offline/filaBaixas';
import { SignaturePad } from '../components/SignaturePad';
import { uuid } from '../lib/uuid';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'Baixa'>;

/** GPS por evento, best-effort: 6s de prazo; sem sinal/permissão → segue sem geo. */
async function capturarGeo(): Promise<{ geoLat?: number; geoLng?: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    if (!pos) return {};
    return { geoLat: pos.coords.latitude, geoLng: pos.coords.longitude };
  } catch {
    return {};
  }
}

export function BaixaScreen({ route, navigation }: Props) {
  const { entregaId, entregaNumero, destinatario } = route.params;
  const [resultado, setResultado] = useState<'ENTREGUE' | 'NAO_ENTREGUE'>('ENTREGUE');
  const [motivo, setMotivo] = useState('');
  const [recebedor, setRecebedor] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [assinaturaUri, setAssinaturaUri] = useState<string | null>(null);
  const [mostrarAssinatura, setMostrarAssinatura] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Chave fixa da PRIMEIRA tentativa — reenvio (online ou da fila) não duplica.
  const idempotencyKey = useRef(uuid()).current;

  const entregue = resultado === 'ENTREGUE';
  // A prova binária é ÚNICA por baixa: foto OU assinatura.
  const provaUri = fotoUri ?? assinaturaUri;
  const tipoProva: 'FOTO' | 'ASSINATURA' | undefined = fotoUri
    ? 'FOTO'
    : assinaturaUri
      ? 'ASSINATURA'
      : undefined;
  // Prova flexível (meio-termo): foto/assinatura OPCIONAIS, mas a entrega
  // precisa de ao menos UMA prova — binária OU quem recebeu (lastro de cobrança).
  const temProva = !!provaUri || !!recebedor.trim();
  const podeConfirmar = !enviando && (entregue ? temProva : !!motivo.trim());

  async function tirarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Câmera', 'Permita o uso da câmera para registrar a prova de entrega.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!r.canceled && r.assets[0]?.uri) {
      setFotoUri(r.assets[0].uri);
      setAssinaturaUri(null); // prova binária única
    }
  }

  // Recebe a assinatura como data URL base64, salva como PNG em file:// e usa
  // como prova (mesmo fluxo da foto, inclusive offline). Limpa a foto.
  async function salvarAssinatura(dataUrl: string) {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const path = `${FileSystem.cacheDirectory}assinatura-${idempotencyKey}.png`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      setAssinaturaUri(path);
      setFotoUri(null);
    } catch {
      Alert.alert('Assinatura', 'Não foi possível salvar a assinatura. Tente novamente.');
    } finally {
      setMostrarAssinatura(false);
    }
  }

  async function confirmar() {
    setEnviando(true);
    const geo = await capturarGeo();
    const payload: BaixaPayload = {
      resultado,
      idempotencyKey,
      ...(entregue
        ? {
            ...(tipoProva ? { tipoProva } : {}),
            recebedorNome: recebedor.trim() || undefined,
          }
        : { motivo: motivo.trim() }),
      ...geo,
    };
    try {
      await baixarEntrega(entregaId, payload, entregue ? provaUri ?? undefined : undefined);
      Alert.alert('Baixa registrada', `Entrega #${entregaNumero} — ${destinatario}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const negocio =
        status !== undefined && status >= 400 && status < 500 &&
        status !== 401 && status !== 408 && status !== 429;
      if (negocio) {
        const msg =
          (isAxiosError(err) && (err.response?.data as { message?: string })?.message) ||
          'O servidor recusou a baixa.';
        Alert.alert('Não foi possível dar baixa', String(msg));
      } else {
        // Sem rede (ou instabilidade): guarda na fila e segue a rota.
        await enfileirar({
          entregaId,
          entregaNumero,
          destinatario,
          payload,
          fotoUri: entregue ? provaUri ?? undefined : undefined,
        });
        Alert.alert(
          'Sem conexão — baixa guardada',
          'A baixa foi salva no aparelho e será enviada automaticamente quando houver sinal.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>
        #{entregaNumero} · {destinatario}
      </Text>

      <View style={styles.toggleWrap}>
        <TouchableOpacity
          style={[styles.toggle, entregue && styles.toggleOnOk]}
          onPress={() => setResultado('ENTREGUE')}
          disabled={enviando}
        >
          <Text style={[styles.toggleTxt, entregue && styles.toggleTxtOn]}>Entregue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, !entregue && styles.toggleOnErr]}
          onPress={() => setResultado('NAO_ENTREGUE')}
          disabled={enviando}
        >
          <Text style={[styles.toggleTxt, !entregue && styles.toggleTxtOn]}>Não entregue</Text>
        </TouchableOpacity>
      </View>

      {entregue ? (
        <>
          <Text style={styles.dica}>Registre ao menos uma prova: foto, assinatura ou quem recebeu.</Text>
          <Text style={styles.label}>Prova (opcional)</Text>
          {provaUri ? (
            <View>
              <Image
                source={{ uri: provaUri }}
                style={tipoProva === 'ASSINATURA' ? styles.assinatura : styles.foto}
                resizeMode={tipoProva === 'ASSINATURA' ? 'contain' : 'cover'}
              />
              <TouchableOpacity
                style={styles.refazer}
                onPress={() => { setFotoUri(null); setAssinaturaUri(null); }}
                disabled={enviando}
              >
                <Text style={styles.refazerTxt}>Remover {tipoProva === 'ASSINATURA' ? 'assinatura' : 'foto'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.provaBotoes}>
              <TouchableOpacity style={styles.btnProva} onPress={tirarFoto} disabled={enviando}>
                <Text style={styles.btnFotoTxt}>📷 Tirar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnProva} onPress={() => setMostrarAssinatura(true)} disabled={enviando}>
                <Text style={styles.btnFotoTxt}>✍️ Assinatura</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Quem recebeu (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome de quem recebeu"
            value={recebedor}
            onChangeText={setRecebedor}
            maxLength={120}
            editable={!enviando}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Motivo da não-entrega *</Text>
          <TextInput
            style={[styles.input, styles.inputArea]}
            placeholder="Ex.: cliente ausente, endereço não localizado…"
            value={motivo}
            onChangeText={setMotivo}
            maxLength={255}
            multiline
            editable={!enviando}
          />
        </>
      )}

      <Text style={styles.gpsAviso}>A localização do aparelho é registrada na baixa.</Text>

      <TouchableOpacity
        style={[styles.confirmar, !podeConfirmar && styles.confirmarOff, !entregue && styles.confirmarErr]}
        onPress={confirmar}
        disabled={!podeConfirmar}
      >
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmarTxt}>
            {entregue ? 'Confirmar entrega' : 'Confirmar não-entrega'}
          </Text>
        )}
      </TouchableOpacity>

      <SignaturePad
        visible={mostrarAssinatura}
        onOK={salvarAssinatura}
        onCancel={() => setMostrarAssinatura(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  conteudo: { padding: 16, gap: 12 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  toggleWrap: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleOnOk: { backgroundColor: CAPUL, borderColor: CAPUL },
  toggleOnErr: { backgroundColor: '#b91c1c', borderColor: '#b91c1c' },
  toggleTxt: { fontSize: 15, fontWeight: '600', color: '#334155' },
  toggleTxtOn: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 4 },
  dica: { fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8 },
  btnFoto: {
    borderWidth: 2,
    borderColor: CAPUL,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 36,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  btnFotoTxt: { color: CAPUL, fontSize: 16, fontWeight: '700' },
  provaBotoes: { flexDirection: 'row', gap: 8 },
  btnProva: {
    flex: 1,
    borderWidth: 2,
    borderColor: CAPUL,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  foto: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#e2e8f0' },
  assinatura: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  refazer: { alignSelf: 'center', marginTop: 8 },
  refazerTxt: { color: CAPUL, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  inputArea: { minHeight: 90, textAlignVertical: 'top' },
  gpsAviso: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  confirmar: {
    backgroundColor: CAPUL,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmarErr: { backgroundColor: '#b91c1c' },
  confirmarOff: { opacity: 0.45 },
  confirmarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
