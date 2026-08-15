import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const CAPUL = '#1e7d3a';

/**
 * Entrada de texto em TELA PRÓPRIA — mesmo padrão da assinatura
 * (`SignaturePad`, que também é um Modal) e da foto (que abre a câmera).
 *
 * Por que existe (Clenio, testando em campo em 10/08): na Baixa de entrega o
 * campo de texto convivia com a foto (280px), a assinatura (180px) e um rodapé
 * FIXO com o "Confirmar entrega". Com o teclado aberto sobrava um vão de poucas
 * dezenas de pixels, e nenhum ajuste de rolagem dava conta — o campo ficava
 * colado no rodapé ou fora de vista. A sugestão dele foi uma telinha por etapa;
 * como duas das três já eram assim, faltava esta.
 *
 * Aqui a tela tem só o rótulo, o campo e dois botões: o teclado cabe sem
 * disputar espaço com nada.
 */
export function EntradaTextoModal({
  visible,
  titulo,
  dica,
  valorInicial,
  placeholder,
  multiline = false,
  maxLength,
  obrigatorio = false,
  onSalvar,
  onCancelar,
}: {
  visible: boolean;
  titulo: string;
  dica?: string;
  valorInicial: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  /** Sem texto, o salvar fica travado (caso do motivo da não-entrega). */
  obrigatorio?: boolean;
  onSalvar: (texto: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(valorInicial);

  // Reabrir a tela parte do valor já gravado — editar não recomeça do zero.
  useEffect(() => {
    if (visible) setTexto(valorInicial);
  }, [visible, valorInicial]);

  const podeSalvar = !obrigatorio || texto.trim().length > 0;

  // ⭐ Fechado = NADA montado. `<Modal visible={false}>` não desmonta os filhos,
  // e a tela de Baixa carrega DOIS destes (quem recebeu + motivo) o tempo todo,
  // cada um com um `TextInput` de `autoFocus`. Mesmo tratamento dado ao
  // SignaturePad em 14/08 — Modal montado sobre tela que vai ser desmontada é
  // fonte conhecida de janela nativa órfã no Android, que engole os toques.
  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onCancelar}>
      <View style={styles.tela}>
        <Text style={styles.titulo}>{titulo}</Text>
        {dica ? <Text style={styles.dica}>{dica}</Text> : null}
        <TextInput
          style={[styles.input, multiline && styles.inputArea]}
          value={texto}
          onChangeText={setTexto}
          placeholder={placeholder}
          maxLength={maxLength}
          multiline={multiline}
          // A tela existe para este campo: já abre com o teclado nele.
          autoFocus
          returnKeyType={multiline ? 'default' : 'done'}
          onSubmitEditing={() => { if (podeSalvar) onSalvar(texto.trim()); }}
        />
        <View style={styles.botoes}>
          <TouchableOpacity style={styles.cancelar} onPress={onCancelar}>
            <Text style={styles.cancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.salvar, !podeSalvar && styles.salvarOff]}
            onPress={() => onSalvar(texto.trim())}
            disabled={!podeSalvar}
          >
            <Text style={styles.salvarTxt}>Salvar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff', padding: 20, gap: 12 },
  titulo: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  dica: { fontSize: 13, color: '#64748b' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: '#fff',
  },
  inputArea: { minHeight: 120, textAlignVertical: 'top' },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelar: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  cancelarTxt: { color: '#475569', fontWeight: '700', fontSize: 15 },
  salvar: { flex: 2, backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  salvarOff: { opacity: 0.45 },
  salvarTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
