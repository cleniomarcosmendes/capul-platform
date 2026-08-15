import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { isAxiosError } from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { baixarEntrega, type BaixaPayload } from '../api/baixa';
import { enfileirar } from '../offline/filaBaixas';
import { SignaturePad } from '../components/SignaturePad';
import { EntradaTextoModal } from '../components/EntradaTextoModal';
import { uuid } from '../lib/uuid';
import { temPermissaoLocalizacao } from '../lib/permissaoLocalizacao';
import { reduzirFoto } from '../lib/foto';
import { publicarAviso } from '../lib/avisoTela';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'Baixa'>;

/**
 * Prazo da tentativa COM O ENTREGADOR ESPERANDO. Uma foto em rede fraca leva
 * ~10s; passando disso, a rede não está boa e insistir só prende a pessoa na
 * tela. A fila reenvia depois com prazo longo, e a baixa não se perde.
 */
const TIMEOUT_INTERATIVO = 15_000;

/**
 * GPS por evento, best-effort: 6s de prazo; sem sinal/permissão → segue sem geo.
 *
 * Aqui a permissão é só CONSULTADA. Pedir a cada baixa era o que incomodava em
 * campo: o diálogo do sistema aparecia em toda entrega, com o cliente na porta.
 * Quem pede é a tela da rota, uma vez, ao registrar o KM de saída.
 */
async function capturarGeo(): Promise<{ geoLat?: number; geoLng?: number }> {
  try {
    if (!(await temPermissaoLocalizacao())) return {};
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
  const insets = useSafeAreaInsets(); // espaço da barra de navegação (Android) p/ o botão não sumir
  // Esta tela NÃO tem mais campo de texto: os dois (quem recebeu, motivo) abrem
  // em tela própria, como a foto (câmera) e a assinatura (modal). Por isso saíram
  // daqui o hook de rolagem e os listeners de teclado — com o rodapé FIXO do
  // "Confirmar entrega" entre o campo e o teclado, nenhuma folga resolvia: o
  // campo ficava colado no rodapé ou fora de vista (visto em campo, 10/08).
  const { entregaId, entregaNumero, destinatario } = route.params;
  const [resultado, setResultado] = useState<'ENTREGUE' | 'NAO_ENTREGUE'>('ENTREGUE');
  const [motivo, setMotivo] = useState('');
  const [recebedor, setRecebedor] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [assinaturaUri, setAssinaturaUri] = useState<string | null>(null);
  const [mostrarAssinatura, setMostrarAssinatura] = useState(false);
  // Qual campo de texto está aberto em tela própria (null = nenhum).
  const [editando, setEditando] = useState<null | 'recebedor' | 'motivo'>(null);
  const [enviando, setEnviando] = useState(false);
  /**
   * O que está acontecendo AGORA, em texto, e quanto da prova já subiu.
   *
   * Confirmar a entrega não é instantâneo e nunca foi: pega o GPS (até 6s), sobe
   * foto e assinatura, e o servidor ainda carimba a foto e grava no cofre. Isso
   * tudo acontecia atrás de um spinner mudo — e espera muda é lida como
   * travamento (Clenio, 14/08: "fica parecendo que está travado"). Cada etapa
   * agora se anuncia, e a da prova mostra o percentual REAL de bytes enviados.
   */
  const [etapa, setEtapa] = useState('');
  const [progresso, setProgresso] = useState<number | null>(null);
  // Chave fixa da PRIMEIRA tentativa — reenvio (online ou da fila) não duplica.
  const idempotencyKey = useRef(uuid()).current;

  const entregue = resultado === 'ENTREGUE';
  // Foto E assinatura são PERMITIDAS juntas (não são mais exclusivas). A entrega
  // precisa de AO MENOS UMA prova — binária (foto/assinatura) OU quem recebeu.
  const temProva = !!fotoUri || !!assinaturaUri || !!recebedor.trim();
  const podeConfirmar = !enviando && (entregue ? temProva : !!motivo.trim());

  async function tirarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Câmera', 'Permita o uso da câmera para registrar a prova de entrega.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!r.canceled && r.assets[0]?.uri) {
      // Reduz ANTES de guardar no estado: o que estiver aqui é o que sobe e o
      // que a pré-visualização segura na memória.
      setFotoUri(await reduzirFoto(r.assets[0]));
    }
  }

  // Recebe a assinatura como data URL base64, salva como PNG em file:// e usa
  // como prova (mesmo fluxo da foto, inclusive offline). Coexiste com a foto.
  async function salvarAssinatura(dataUrl: string) {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const path = `${FileSystem.cacheDirectory}assinatura-${idempotencyKey}.png`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      setAssinaturaUri(path);
    } catch {
      Alert.alert('Assinatura', 'Não foi possível salvar a assinatura. Tente novamente.');
    } finally {
      setMostrarAssinatura(false);
    }
  }

  async function confirmar() {
    setEnviando(true);
    setProgresso(null);
    // Até 6s parado aqui esperando o GPS — a etapa mais silenciosa de todas.
    setEtapa('Obtendo a localização…');
    const geo = await capturarGeo();
    const provas = entregue
      ? { fotoUri: fotoUri ?? undefined, assinaturaUri: assinaturaUri ?? undefined }
      : undefined;
    const payload: BaixaPayload = {
      resultado,
      idempotencyKey,
      ...(entregue
        ? { recebedorNome: recebedor.trim() || undefined }
        : { motivo: motivo.trim() }),
      ...geo,
    };
    try {
      // Prazo CURTO: aqui tem gente parada na porta do cliente esperando a tela
      // responder. Estourando, a baixa vai para a fila (que reenvia com o prazo
      // longo, sem ninguém olhando) e ele segue a rota. Antes eram 60s de tela
      // desabilitada antes de dizer "sem conexão" — era o "sistema travado ao
      // finalizar a operação" relatado em campo.
      const temBinario = !!provas?.fotoUri || !!provas?.assinaturaUri;
      setEtapa(temBinario ? 'Enviando a prova…' : 'Registrando a entrega…');
      await baixarEntrega(entregaId, payload, provas, {
        timeout: TIMEOUT_INTERATIVO,
        onProgresso: (pct) => {
          setProgresso(pct);
          // 100% = o último byte saiu daqui. O que resta é o servidor carimbar a
          // foto e gravar no cofre — dizer "enviando" nessa hora seria mentir, e
          // é justamente onde a espera parecia travamento.
          if (pct >= 100) setEtapa('Registrando a entrega…');
        },
      });
      // Sem diálogo: publica o aviso e volta. A tela da rota mostra a
      // confirmação. Alert aqui atropelava a transição — ver `lib/avisoTela.ts`.
      publicarAviso(`✓ Baixa registrada — #${entregaNumero} ${destinatario}`);
      navigation.goBack();
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
        setEtapa('Guardando no aparelho…');
        await enfileirar({
          entregaId,
          entregaNumero,
          destinatario,
          payload,
          fotoUri: entregue ? fotoUri ?? undefined : undefined,
          assinaturaUri: entregue ? assinaturaUri ?? undefined : undefined,
        });
        publicarAviso(
          `📴 Sem conexão — baixa #${entregaNumero} guardada no aparelho, sobe sozinha quando houver sinal`,
          'atencao',
        );
        navigation.goBack();
      }
    } finally {
      setEnviando(false);
      setEtapa('');
      setProgresso(null);
    }
  }

  return (
    <View style={styles.tela}>
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.dica}>Registre ao menos uma prova: foto, assinatura ou quem recebeu. Pode registrar as duas (foto + assinatura).</Text>
          <Text style={styles.label}>Provas (opcional)</Text>
          <View style={{ gap: 8, marginTop: 2 }}>
            {/* Foto — independente da assinatura */}
            {fotoUri ? (
              <View>
                <Image source={{ uri: fotoUri }} style={styles.foto} resizeMode="cover" />
                <TouchableOpacity style={styles.refazer} onPress={() => setFotoUri(null)} disabled={enviando}>
                  <Text style={styles.refazerTxt}>Remover foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.btnProva} onPress={tirarFoto} disabled={enviando}>
                <Text style={styles.btnFotoTxt}>📷 Tirar foto</Text>
              </TouchableOpacity>
            )}
            {/* Assinatura — independente da foto */}
            {assinaturaUri ? (
              <View>
                <Image source={{ uri: assinaturaUri }} style={styles.assinatura} resizeMode="contain" />
                <TouchableOpacity style={styles.refazer} onPress={() => setAssinaturaUri(null)} disabled={enviando}>
                  <Text style={styles.refazerTxt}>Remover assinatura</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.btnProva} onPress={() => setMostrarAssinatura(true)} disabled={enviando}>
                <Text style={styles.btnFotoTxt}>✍️ Coletar assinatura</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Abre em tela própria, como a foto (câmera) e a assinatura (modal).
              Inline, o campo disputava o vão entre o teclado e o rodapé fixo e
              acabava fora de vista — ver EntradaTextoModal. */}
          <Text style={styles.label}>Quem recebeu (opcional)</Text>
          <TouchableOpacity
            style={styles.campoBotao}
            onPress={() => setEditando('recebedor')}
            disabled={enviando}
          >
            <Text style={recebedor ? styles.campoValor : styles.campoVazio}>
              {recebedor || 'Toque para informar o nome'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Motivo da não-entrega *</Text>
          <TouchableOpacity
            style={styles.campoBotao}
            onPress={() => setEditando('motivo')}
            disabled={enviando}
          >
            <Text style={motivo ? styles.campoValor : styles.campoVazio}>
              {motivo || 'Toque para informar o motivo'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.gpsAviso}>A localização do aparelho é registrada na baixa.</Text>
    </ScrollView>

    {/* Botão FIXO no rodapé (sempre visível, acima da barra do Android) — o usuário não
        precisa rolar para confirmar. */}
    <View style={[styles.rodape, { paddingBottom: insets.bottom + 10 }]}>
      {/* Enquanto envia, o rodapé NARRA: etapa em texto e, na subida da prova, a
          barra com o percentual real de bytes. Antes era só um spinner branco
          dentro do botão — nenhuma pista de que algo estava andando, nem de
          quanto faltava, e a espera passava por travamento. */}
      {enviando && (
        <View style={styles.progressoBox}>
          <Text style={styles.progressoTxt}>
            {etapa}
            {progresso != null && progresso < 100 ? ` ${progresso}%` : ''}
          </Text>
          <View style={styles.barraFundo}>
            <View
              style={[
                styles.barraCheia,
                // Sem percentual (GPS, gravação no servidor) a barra fica cheia e
                // pálida: há trabalho em curso, só não dá para medir. Fingir
                // porcentagem numa etapa que não se mede seria pior.
                progresso != null ? { width: `${progresso}%` } : styles.barraIndefinida,
              ]}
            />
          </View>
          <Text style={styles.progressoDica}>Não feche o aplicativo.</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.confirmar, !podeConfirmar && styles.confirmarOff, !entregue && styles.confirmarErr]}
        onPress={confirmar}
        disabled={!podeConfirmar}
      >
        {enviando ? (
          <View style={styles.confirmandoLinha}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.confirmarTxt}>{etapa || 'Enviando…'}</Text>
          </View>
        ) : (
          <Text style={styles.confirmarTxt}>
            {entregue ? 'Confirmar entrega' : 'Confirmar não-entrega'}
          </Text>
        )}
      </TouchableOpacity>
    </View>

    <SignaturePad
      visible={mostrarAssinatura}
      onOK={salvarAssinatura}
      onCancel={() => setMostrarAssinatura(false)}
    />

    <EntradaTextoModal
      visible={editando === 'recebedor'}
      titulo="Quem recebeu"
      dica={`Entrega #${entregaNumero} — ${destinatario}. Opcional: vale como prova quando não há foto nem assinatura.`}
      valorInicial={recebedor}
      placeholder="Nome de quem recebeu"
      maxLength={120}
      onSalvar={(t) => { setRecebedor(t); setEditando(null); }}
      onCancelar={() => setEditando(null)}
    />
    <EntradaTextoModal
      visible={editando === 'motivo'}
      titulo="Motivo da não-entrega"
      dica="Diga o que impediu a entrega — é o que o escritório vê para decidir a nova tentativa."
      valorInicial={motivo}
      placeholder="Ex.: cliente ausente, endereço não localizado…"
      maxLength={255}
      multiline
      obrigatorio
      onSalvar={(t) => { setMotivo(t); setEditando(null); }}
      onCancelar={() => setEditando(null)}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  rodape: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingHorizontal: 16, paddingTop: 12 },
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
  // Campo que abre em tela própria: parece um input, mas é um botão.
  campoBotao: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#fff',
    minHeight: 50,
    justifyContent: 'center',
  },
  campoValor: { fontSize: 15, color: '#0f172a' },
  campoVazio: { fontSize: 15, color: '#94a3b8' },
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
  confirmandoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Narrativa do envio (etapa + barra), acima do botão.
  progressoBox: { marginBottom: 10, gap: 6 },
  progressoTxt: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  progressoDica: { fontSize: 11, color: '#64748b' },
  barraFundo: { height: 8, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  barraCheia: { height: 8, borderRadius: 999, backgroundColor: CAPUL },
  barraIndefinida: { width: '100%', opacity: 0.35 },
});
