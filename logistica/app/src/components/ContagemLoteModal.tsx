import { useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert,
} from 'react-native';

import type { ItemContagem, ContagemDeLote } from '../offline/contagemOffline';

const CAPUL = '#047942';

interface Props {
  item: ItemContagem;
  /** O que já foi contado neste aparelho, se houver. */
  contagemAtual?: ContagemDeLote[];
  onSalvar: (lotes: ContagemDeLote[]) => void;
  onFechar: () => void;
}

/**
 * Contagem POR LOTE — espelha o `LoteContagemModal` do desktop.
 *
 * Duas regras que vêm do desenho do módulo e não podem mudar aqui:
 *
 *  - **O total não é digitado.** É a soma dos lotes. Um total informado à mão
 *    que não bate com os lotes viraria uma divergência insolúvel na análise.
 *  - **Campo vazio ≠ zero.** Vazio é "ainda não contei"; zero é "procurei e não
 *    achei", que é uma afirmação do contador. Quem transforma o que sobrou em
 *    zero é o fecho (`handoff`), com o rastro do `zerado_no_fecho`.
 *
 * O saldo por lote NÃO aparece — nem chega ao aparelho. A contagem cega é do
 * módulo inteiro, e no app ela ainda ficaria persistida no celular.
 */
export function ContagemLoteModal({ item, contagemAtual, onSalvar, onFechar }: Props) {
  const iniciais = useMemo(() => {
    const jaContado = new Map((contagemAtual ?? []).map((l) => [l.numero, l.quantidade]));
    const mapa: Record<string, string> = {};
    for (const lote of item.lotes) {
      const v = jaContado.get(lote.numero);
      mapa[lote.numero] = v === undefined ? '' : String(v);
    }
    return mapa;
  }, [item, contagemAtual]);

  const [valores, setValores] = useState<Record<string, string>>(iniciais);

  const informados = useMemo(
    () =>
      item.lotes
        .map((l) => ({ numero: l.numero, texto: (valores[l.numero] ?? '').replace(',', '.').trim() }))
        .filter((l) => l.texto !== '')
        .map((l) => ({ numero: l.numero, quantidade: Number(l.texto) })),
    [item, valores],
  );

  const invalido = informados.some((l) => !Number.isFinite(l.quantidade) || l.quantidade < 0);
  const total = invalido ? 0 : informados.reduce((s, l) => s + l.quantidade, 0);

  function salvar() {
    if (invalido) {
      Alert.alert('Quantidade inválida', 'Informe números maiores ou iguais a zero.');
      return;
    }
    onSalvar(informados);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onFechar}>
      <View style={s.container}>
        <View style={s.topo}>
          <Text style={s.codigo}>{item.product_code}</Text>
          <Text style={s.desc} numberOfLines={2}>{item.product_description}</Text>
          <Text style={s.aviso}>
            Produto com controle de lote — informe a quantidade de cada lote.
          </Text>
        </View>

        <FlatList
          data={item.lotes}
          keyExtractor={(l) => l.numero}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={s.vazio}>
              Nenhum lote no recorte deste inventário. Fale com o supervisor —
              este produto precisa ser conferido no desktop.
            </Text>
          }
          renderItem={({ item: lote }) => (
            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                <Text style={s.lote}>{lote.numero}</Text>
                {lote.lotefor ? <Text style={s.lotefor}>Fornecedor: {lote.lotefor}</Text> : null}
              </View>
              <TextInput
                style={s.qtd}
                keyboardType="decimal-pad"
                placeholder="—"
                value={valores[lote.numero] ?? ''}
                onChangeText={(t) => setValores((v) => ({ ...v, [lote.numero]: t }))}
              />
            </View>
          )}
        />

        <View style={s.rodape}>
          <View style={s.totalBox}>
            <Text style={s.totalRotulo}>Total ({informados.length} de {item.lotes.length} lotes)</Text>
            <Text style={s.totalValor}>{invalido ? '—' : total.toFixed(2)}</Text>
          </View>
          <View style={s.botoes}>
            <TouchableOpacity style={s.btnSec} onPress={onFechar}>
              <Text style={s.btnSecTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPri, invalido && s.btnOff]} onPress={salvar} disabled={invalido}>
              <Text style={s.btnPriTxt}>Salvar contagem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topo: { padding: 16, backgroundColor: CAPUL, gap: 2 },
  codigo: { color: '#fff', fontWeight: '700', fontSize: 16, fontVariant: ['tabular-nums'] },
  desc: { color: '#e2f4ea', fontSize: 13 },
  aviso: { color: '#c9ead8', fontSize: 11, marginTop: 6 },
  vazio: { padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13, lineHeight: 19 },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  lote: { fontSize: 15, fontWeight: '600', color: '#0f172a', fontVariant: ['tabular-nums'] },
  lotefor: { fontSize: 12, color: '#64748b', marginTop: 2 },
  qtd: {
    width: 96, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 8, fontSize: 16, textAlign: 'right', backgroundColor: '#fff', color: '#0f172a',
  },
  rodape: { borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff', padding: 12, gap: 10 },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalRotulo: { fontSize: 13, color: '#475569' },
  totalValor: { fontSize: 20, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] },
  botoes: { flexDirection: 'row', gap: 10 },
  btnSec: {
    flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 13,
    alignItems: 'center',
  },
  btnSecTxt: { color: '#475569', fontWeight: '600' },
  btnPri: { flex: 2, backgroundColor: CAPUL, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOff: { opacity: 0.5 },
  btnPriTxt: { color: '#fff', fontWeight: '700' },
});
