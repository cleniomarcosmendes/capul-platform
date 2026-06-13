import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';

const CAPUL = '#1e7d3a';

// Quadro de assinatura na tela do celular (Fase 1b — prova de entrega).
// Usa react-native-signature-canvas (webview). onOK devolve a assinatura como
// data URL base64 ("data:image/png;base64,..."), que o BaixaScreen salva em
// file:// e envia no mesmo fluxo da foto, marcada como ASSINATURA.
export function SignaturePad({
  visible,
  onOK,
  onCancel,
}: {
  visible: boolean;
  onOK: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<SignatureViewRef>(null);

  // Esconde o rodapé padrão da lib — usamos nossos próprios botões.
  const webStyle = `
    .m-signature-pad--footer { display: none; margin: 0; }
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    body, html { width: 100%; height: 100%; margin: 0; }
  `;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <Text style={styles.titulo}>Assinatura de quem recebeu</Text>
        <Text style={styles.dica}>Assine no quadro abaixo com o dedo.</Text>
        <View style={styles.canvas}>
          <SignatureScreen
            ref={ref}
            onOK={onOK}
            webStyle={webStyle}
            backgroundColor="#ffffff"
            penColor="#0f172a"
          />
        </View>
        <View style={styles.botoes}>
          <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={onCancel}>
            <Text style={styles.ghostTxt}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={() => ref.current?.clearSignature()}>
            <Text style={styles.ghostTxt}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.ok]} onPress={() => ref.current?.readSignature()}>
            <Text style={styles.okTxt}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f8fafc', padding: 16, gap: 10 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  dica: { fontSize: 13, color: '#64748b' },
  canvas: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  botoes: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  ghost: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  ghostTxt: { color: '#334155', fontWeight: '600', fontSize: 15 },
  ok: { backgroundColor: CAPUL },
  okTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
