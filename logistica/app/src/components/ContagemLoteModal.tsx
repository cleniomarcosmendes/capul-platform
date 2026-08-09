import { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert,
  Keyboard,
} from 'react-native';

import type { ItemContagem, ContagemDeLote } from '../offline/contagemOffline';

const CAPUL = '#047942';

/** `b8_dtvalid` vem do Protheus como YYYYMMDD. */
function fmtValidade(v: string): string {
  if (v.length !== 8) return v;
  return `${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)}`;
}

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

  /**
   * ⌨️ Mesmo aperto da tela de contagem: com o teclado aberto, o rodapé (total +
   * Cancelar/Salvar) comia o espaço e sobrava quase nada de lista — e aqui é
   * pior, porque digitar lote a lote é o trabalho inteiro desta tela.
   *
   * O TOTAL fica (é a conferência de quem digita); os BOTÕES saem, porque só
   * servem quando se termina.
   */
  const [tecladoAberto, setTecladoAberto] = useState(false);
  useEffect(() => {
    const abriu = Keyboard.addListener('keyboardDidShow', () => setTecladoAberto(true));
    const fechou = Keyboard.addListener('keyboardDidHide', () => setTecladoAberto(false));
    return () => { abriu.remove(); fechou.remove(); };
  }, []);

  /**
   * Lotes informados à mão pelo contador.
   *
   * A lista congelada traz o que o sistema ESPERA: lotes com saldo e não
   * vencidos. Mas o inventário existe para achar o que o sistema não sabe — um
   * lote com saldo zero (86% dos lotes) ou fora da lista pode estar
   * fisicamente na prateleira, e sem isto não haveria onde registrá-lo.
   *
   * Trazer todos os lotes na lista resolveria pelo lado errado: seriam 7,2 por
   * item em média, e até 108 num único produto.
   */
  const [extras, setExtras] = useState<Array<{ numero: string; texto: string }>>(() => {
    const doRecorte = new Set(item.lotes.map((l) => l.numero));
    return (contagemAtual ?? [])
      .filter((c) => !doRecorte.has(c.numero))
      .map((c) => ({ numero: c.numero, texto: String(c.quantidade) }));
  });

  const informados = useMemo(() => {
    const doRecorte = item.lotes
      .map((l) => ({ numero: l.numero, texto: (valores[l.numero] ?? '').replace(',', '.').trim() }))
      .filter((l) => l.texto !== '')
      .map((l) => ({ numero: l.numero, quantidade: Number(l.texto) }));

    const informadosAMao = extras
      .map((e) => ({ numero: e.numero.trim(), texto: e.texto.replace(',', '.').trim() }))
      .filter((e) => e.numero !== '' && e.texto !== '')
      .map((e) => ({ numero: e.numero, quantidade: Number(e.texto) }));

    return [...doRecorte, ...informadosAMao];
  }, [item, valores, extras]);

  const invalido = informados.some((l) => !Number.isFinite(l.quantidade) || l.quantidade < 0);
  const total = invalido ? 0 : informados.reduce((s, l) => s + l.quantidade, 0);

  /**
   * ⚠️ TODO lote da lista precisa de um valor — inclusive 0.
   *
   * Vazio não vira zero sozinho: zero é uma AFIRMAÇÃO do contador ("procurei e
   * não achei"), e inventar zeros seria pôr palavra na boca dele. Mas salvar
   * PARCIAL é pior: o total do item viraria a soma de alguns lotes, comparado na
   * análise contra o saldo cheio do produto — divergência falsa.
   *
   * Então a saída é exigir a decisão, lote a lote. Mesma regra do desktop
   * (`allFilled`), que é o que o Clenio pediu: as duas aplicações iguais.
   *
   * Linha de lote à mão sem número também barra — viraria contagem sem
   * identificação, que o servidor recusa (CONTAGEM_EXIGE_LOTE).
   */
  const faltaDecidir = item.lotes.some((l) => (valores[l.numero] ?? '').trim() === '');
  const extraSemNumero = extras.some((e) => e.texto.trim() !== '' && e.numero.trim() === '');
  const podeSalvar = !invalido && !faltaDecidir && !extraSemNumero && informados.length > 0;

  function salvar() {
    if (invalido) {
      Alert.alert('Quantidade inválida', 'Informe números maiores ou iguais a zero.');
      return;
    }
    if (extraSemNumero) {
      Alert.alert('Falta o número do lote', 'Informe o número do lote que você encontrou.');
      return;
    }
    if (faltaDecidir) {
      Alert.alert(
        'Falta contar algum lote',
        'Informe a quantidade de TODOS os lotes da lista. Se não encontrou o produto ' +
          'daquele lote, digite 0 — é assim que se registra "procurei e não achei".',
      );
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
          {tecladoAberto ? null : (
            <Text style={s.aviso}>
              Produto com controle de lote — informe a quantidade de cada lote.
            </Text>
          )}
        </View>

        <FlatList
          data={item.lotes}
          keyExtractor={(l) => l.numero}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <Text style={s.vazio}>
              Nenhum lote deste produto entrou no recorte do inventário — ou
              estavam sem saldo, ou vencidos na data de referência.{'\n\n'}
              Se você encontrou o produto na prateleira, informe o lote abaixo.
              Senão, avise o supervisor.
            </Text>
          }
          renderItem={({ item: lote }) => (
            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                <Text style={s.lote}>{lote.numero}</Text>
                <Text style={s.lotefor}>
                  {lote.lotefor ? `Fornecedor: ${lote.lotefor}` : ''}
                  {lote.lotefor && lote.validade ? '  ·  ' : ''}
                  {lote.validade ? `Val. ${fmtValidade(lote.validade)}` : ''}
                </Text>
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
          ListFooterComponent={
            <View style={s.extrasBox}>
              <Text style={s.extrasTitulo}>Lote fora da lista</Text>
              <Text style={s.extrasAjuda}>
                Achou na prateleira um lote que não aparece acima? Informe aqui —
                é assim que a divergência chega ao supervisor.
              </Text>

              {extras.map((e, i) => (
                <View key={`extra-${i}`} style={s.linha}>
                  <TextInput
                    style={s.loteInput}
                    placeholder="Número do lote"
                    autoCapitalize="characters"
                    value={e.numero}
                    onChangeText={(t) =>
                      setExtras((v) => v.map((x, j) => (j === i ? { ...x, numero: t } : x)))
                    }
                  />
                  <TextInput
                    style={s.qtd}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    value={e.texto}
                    onChangeText={(t) =>
                      setExtras((v) => v.map((x, j) => (j === i ? { ...x, texto: t } : x)))
                    }
                  />
                </View>
              ))}

              <TouchableOpacity
                style={s.btnAdd}
                onPress={() => setExtras((v) => [...v, { numero: '', texto: '' }])}
              >
                <Text style={s.btnAddTxt}>+ Informar outro lote</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <View style={s.rodape}>
          <View style={s.totalBox}>
            <Text style={s.totalRotulo}>
              {faltaDecidir
                ? `Falta contar ${item.lotes.filter((l) => (valores[l.numero] ?? '').trim() === '').length} lote(s)`
                : `Total (${informados.length} lote${informados.length === 1 ? '' : 's'})`}
            </Text>
            <Text style={s.totalValor}>{invalido ? '—' : total.toFixed(2)}</Text>
          </View>
          {tecladoAberto ? null : (
          <View style={s.botoes}>
            <TouchableOpacity style={s.btnSec} onPress={onFechar}>
              <Text style={s.btnSecTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnPri, !podeSalvar && s.btnOff]}
              onPress={salvar}
              disabled={!podeSalvar}
            >
              <Text style={s.btnPriTxt}>Salvar contagem</Text>
            </TouchableOpacity>
          </View>
          )}
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
  extrasBox: {
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8,
  },
  extrasTitulo: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  extrasAjuda: { fontSize: 12, color: '#64748b', lineHeight: 17 },
  loteInput: {
    flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#fff',
    color: '#0f172a',
  },
  btnAdd: {
    borderWidth: 1, borderColor: CAPUL, borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 11, alignItems: 'center',
  },
  btnAddTxt: { color: CAPUL, fontWeight: '700', fontSize: 13 },
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
