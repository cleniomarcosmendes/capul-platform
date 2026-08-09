import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { getDeviceId } from '../auth/deviceId';
import {
  baixarItensDaLista, retirarLista, devolverLista, liberarParaSupervisor,
} from '../api/inventario';
import {
  salvarPacote, lerPacote, descartarPacote, salvarLease, lerLease,
  registrarContagemLocal, registrarContagemPorLote, removerContagemLocal,
  contagensPendentes, sincronizarContagens,
  type PacoteContagem, type ContagemLocal, type ItemContagem,
} from '../offline/contagemOffline';
import { ContagemLoteModal } from '../components/ContagemLoteModal';
import { useAuth } from '../auth/AuthContext';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'ContagemLista'>;

/**
 * Contagem de UMA lista, offline.
 *
 * Fluxo: retirar (lease) → baixar os itens → contar sem sinal → sincronizar.
 *
 * O lease é retirado ANTES do download de propósito: se a lista já estiver em
 * outro aparelho, o operador descobre antes de gastar tempo baixando.
 */
export function ContagemListaScreen({ route, navigation }: Props) {
  const { listId, listName } = route.params;
  const { nome } = useAuth();
  const [pacote, setPacote] = useState<PacoteContagem | null>(null);
  const [valores, setValores] = useState<Record<string, ContagemLocal>>({});
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca] = useState('');
  /** Produto rastreado aberto para contagem lote a lote. */
  const [itemEmLote, setItemEmLote] = useState<ItemContagem | null>(null);
  const [liberando, setLiberando] = useState(false);
  /**
   * ⌨️ Texto CRU do campo enquanto se digita, por item.
   *
   * O campo é controlado (senão o valor some ao sincronizar). Só que ligá-lo
   * direto ao valor PERSISTIDO impedia apagar: limpar o campo mandava texto
   * vazio, o handler ignorava, e o re-render devolvia o número antigo — dava
   * para apagar o "2" de "12" mas nunca o "1".
   *
   * O rascunho segura o que está sendo digitado, inclusive vazio e estados
   * intermediários ("1." antes de "1.5"). Sai ao terminar a edição.
   */
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  /**
   * ⌨️ Com o teclado aberto sobrava UMA LINHA de lista: o item sendo digitado
   * ficava espremido entre a busca e o rodapé, e não dava para rolar até ele.
   *
   * O padrão de casa (`useScrollToFocusedInput`) não serve — é para formulário
   * com ScrollView, e aqui é FlatList com milhares de itens. A saída é devolver
   * o espaço: enquanto se digita, o rodapé e os avisos não têm função.
   */
  const [tecladoAberto, setTecladoAberto] = useState(false);

  useEffect(() => {
    const abriu = Keyboard.addListener('keyboardDidShow', () => setTecladoAberto(true));
    const fechou = Keyboard.addListener('keyboardDidHide', () => setTecladoAberto(false));
    return () => { abriu.remove(); fechou.remove(); };
  }, []);

  const recarregarLocal = useCallback(async () => {
    const p = await lerPacote(listId);
    setPacote(p);
    const pend = await contagensPendentes(listId);
    setValores(Object.fromEntries(pend.map((c) => [c.itemId, c])));
    setCarregando(false);
  }, [listId]);

  useEffect(() => {
    void recarregarLocal();
  }, [recarregarLocal]);

  async function baixar() {
    setBaixando(true);
    try {
      const deviceId = await getDeviceId();
      // 1) Lease PRIMEIRO — falhar aqui é barato; falhar depois de baixar não.
      const { lease_token } = await retirarLista(listId, deviceId);
      await salvarLease(listId, lease_token);

      // 2) Itens
      const { ciclo, itens } = await baixarItensDaLista(listId);
      await salvarPacote({
        listId, listName, cicloEsperado: ciclo,
        // Armazém do primeiro item: a lista é sempre de um armazém só (o
        // inventário é criado por armazém), então serve de rótulo.
        warehouse: itens.find((i) => i.warehouse)?.warehouse ?? undefined,
        baixadoEm: new Date().toISOString(), itens,
      });
      await recarregarLocal();
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: { erro?: string; mensagem?: string } | string } } })
        ?.response?.data?.detail;
      const msg = d && typeof d === 'object' ? d.mensagem ?? 'Não foi possível baixar a lista.'
        : typeof d === 'string' ? d : 'Sem conexão para baixar a lista.';
      Alert.alert('Não deu para baixar', String(msg));
    } finally {
      setBaixando(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      const r = await sincronizarContagens(listId);
      await recarregarLocal();

      if (r.recusadas.length) {
        // Recusa de regra NÃO some em silêncio: o operador precisa saber que
        // aquele trabalho não entrou, e por quê.
        Alert.alert(
          `${r.enviadas} enviada(s), ${r.recusadas.length} recusada(s)`,
          r.recusadas.map((x) => `• ${x.mensagem}`).join('\n\n') +
            '\n\nFale com o supervisor antes de recontar.',
        );
      } else if (r.restantes > 0) {
        Alert.alert('Sincronização parcial', `${r.enviadas} enviada(s). ${r.restantes} aguardando sinal.`);
      } else {
        Alert.alert('Tudo sincronizado', `${r.enviadas} contagem(ns) enviada(s).`);
      }
    } finally {
      setSincronizando(false);
    }
  }

  /**
   * Sai da lista NESTE aparelho, sem entregá-la.
   *
   * A lista continua EM_CONTAGEM e volta a ficar disponível — para este ou para
   * outro aparelho. Antes se chamava "Encerrar", o que se lia como "terminei a
   * contagem"; quem termina de verdade é o `liberar()`.
   */
  async function sairDaLista() {
    const pend = await contagensPendentes(listId);
    if (pend.length > 0) {
      // Guarda que só o cliente pode fazer: o servidor não tem como saber que
      // existe trabalho preso neste aparelho.
      Alert.alert(
        'Ainda há contagens não sincronizadas',
        `${pend.length} contagem(ns) só existem neste aparelho. Sincronize antes de sair, ` +
          `senão elas se perdem.`,
      );
      return;
    }
    Alert.alert(
      'Sair da lista?',
      'A lista continua em contagem e volta a ficar disponível. Isto NÃO avisa o supervisor — ' +
        'para entregar, use "Liberar para supervisor".',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void devolverESair() },
      ],
    );
  }

  async function devolverESair() {
    const token = await lerLease(listId);
    try {
      if (token) await devolverLista(listId, token);
    } catch {
      /* devolver é best-effort: o supervisor consegue liberar do desktop */
    }
    await descartarPacote(listId);
    navigation.goBack();
  }

  /**
   * Entrega a lista ao supervisor (`EM_CONTAGEM → AGUARDANDO_REVISAO`).
   *
   * O botão fica SEMPRE disponível, por decisão do módulo (03/05): o contador
   * bipa o que tem em mãos e libera quando termina — não precisa percorrer a
   * lista inteira. O que sobrou vira zero, que é como se diz "não achei".
   */
  async function liberar() {
    // 1) Nada pode estar preso no aparelho. O handoff zera os não contados e
    //    tira a lista de EM_CONTAGEM — uma pendência aqui seria perdida DUAS
    //    vezes: zerada no servidor e recusada no envio seguinte.
    let pend = await contagensPendentes(listId);
    if (pend.length > 0) {
      const r = await sincronizarContagens(listId);
      await recarregarLocal();
      pend = await contagensPendentes(listId);
      if (pend.length > 0 || r.recusadas.length > 0) {
        Alert.alert(
          'Sincronize antes de liberar',
          `${pend.length} contagem(ns) ainda não subiram` +
            (r.recusadas.length ? ` e ${r.recusadas.length} foram recusadas` : '') +
            '. Liberar agora perderia esse trabalho.',
        );
        return;
      }
    }

    const naoContados = (pacote?.itens ?? []).filter(
      (i) => valores[i.id] === undefined && i.contadoNoServidor === null,
    ).length;

    Alert.alert(
      'Liberar para o supervisor?',
      (naoContados > 0
        ? `${naoContados} item(ns) sem contagem serão gravados como ZERO — é assim que se marca ` +
          '"não encontrei o produto".\n\n'
        : '') +
        'Depois de liberar você não altera mais as contagens. O supervisor revisa e pode devolver ' +
        'a lista para revisão.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Liberar', onPress: () => void confirmarLiberacao() },
      ],
    );
  }

  async function confirmarLiberacao() {
    setLiberando(true);
    try {
      const r = await liberarParaSupervisor(listId);

      // A lista saiu de EM_CONTAGEM: o lease não tem mais função e o pacote
      // local não pode continuar contável no aparelho.
      const token = await lerLease(listId);
      try {
        if (token) await devolverLista(listId, token);
      } catch {
        /* best-effort: o supervisor libera do desktop */
      }
      await descartarPacote(listId);

      Alert.alert(
        'Lista entregue',
        r.zerados > 0
          ? `Entregue ao supervisor. ${r.zerados} item(ns) sem contagem foram gravados como zero.`
          : 'Entregue ao supervisor.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: { mensagem?: string } | string } } })
        ?.response?.data?.detail;
      const msg = d && typeof d === 'object' ? d.mensagem ?? 'Não foi possível liberar a lista.'
        : typeof d === 'string' ? d : 'Sem conexão para liberar a lista.';
      Alert.alert('Não deu para liberar', String(msg));
    } finally {
      setLiberando(false);
    }
  }

  if (carregando) {
    return <View style={styles.centro}><ActivityIndicator size="large" color={CAPUL} /></View>;
  }

  if (!pacote) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vazioEmoji}>⬇️</Text>
        <Text style={styles.vazioTitulo}>{listName}</Text>
        <Text style={styles.vazioTxt}>
          Baixe a lista para contar sem depender de sinal. Enquanto ela estiver aqui, fica reservada
          para este aparelho.
        </Text>
        <TouchableOpacity style={styles.btnPrimario} onPress={() => void baixar()} disabled={baixando}>
          <Text style={styles.btnPrimarioTxt}>{baixando ? 'Baixando…' : 'Baixar para contar'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const termo = busca.trim().toLowerCase();
  /**
   * ⭐ MODO REVISÃO PARCIAL — mesma regra do desktop (`useCountingData`).
   *
   * O supervisor devolveu a lista marcando ALGUNS itens. Nesse caso o contador
   * vê **só os marcados**: os outros ele já contou e o supervisor já aprovou, e
   * deixá-los editáveis convida a mexer por engano no que estava fechado.
   *
   * "Alguns, mas não todos" é o que distingue devolução PARCIAL da TOTAL — na
   * total todos vêm marcados, e aí a lista inteira é para revisar mesmo.
   */
  const marcados = pacote.itens.filter((i) => i.revisarNoCiclo).length;
  const modoRevisaoParcial = marcados > 0 && marcados < pacote.itens.length;

  const visiveis = modoRevisaoParcial
    ? pacote.itens.filter((i) => i.revisarNoCiclo)
    : pacote.itens;

  const itens = termo
    ? visiveis.filter(
        (i) => i.product_code.toLowerCase().includes(termo) ||
               i.product_description.toLowerCase().includes(termo),
      )
    : visiveis;

  const contados = pacote.itens.filter(
    (i) => valores[i.id] !== undefined || i.contadoNoServidor !== null,
  ).length;
  const pendentesEnvio = Object.keys(valores).length;
  // ⭐ O que o Clenio não via: depois que a fila zera, nada dizia que subiu.
  const sincronizados = pacote.itens.filter(
    (i) => valores[i.id] === undefined && i.contadoNoServidor !== null,
  ).length;
  const revisar = pacote.itens.filter((i) => i.revisarNoCiclo).length;
  const horaSync = pacote.sincronizadoEm
    ? new Date(pacote.sincronizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={styles.container}>
      {/* Cabeçalho: o contador precisa saber ONDE está contando e em que
          CICLO — o mobile-web já mostrava isso, o app não. */}
      <View style={styles.cabecalho}>
        <Text style={styles.cabLista} numberOfLines={1}>{pacote.listName}</Text>
        <View style={styles.cabLinha}>
          {pacote.warehouse ? (
            <Text style={styles.cabChip}>Armazém {pacote.warehouse}</Text>
          ) : null}
          <Text style={styles.cabChip}>{pacote.cicloEsperado}º ciclo</Text>
          {/* Quem está contando. Vai no fim da MESMA linha de chips para não
              empurrar nada — o contador precisa saber com que conta está,
              sobretudo em aparelho compartilhado. */}
          {nome ? (
            <Text style={[styles.cabChip, styles.cabChipUser]} numberOfLines={1}>
              {nome}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.barraTopo}>
        <Text style={styles.progresso}>
          {modoRevisaoParcial
            ? `${revisar} item(ns) a revisar`
            : `${contados} de ${pacote.itens.length} contados`}
        </Text>
        <View style={styles.selos}>
          {sincronizados > 0 && (
            <Text style={styles.selOk}>{sincronizados} sincronizado{sincronizados === 1 ? '' : 's'}</Text>
          )}
          {pendentesEnvio > 0 && (
            <Text style={styles.pend}>{pendentesEnvio} a sincronizar</Text>
          )}
        </View>
      </View>

      {!tecladoAberto && horaSync && pendentesEnvio === 0 ? (
        <Text style={styles.rodapeSync}>Última sincronização às {horaSync}</Text>
      ) : null}

      {!tecladoAberto && revisar > 0 ? (
        <Text style={styles.avisoRevisar}>
          {modoRevisaoParcial
            ? `Modo revisão: mostrando só os ${revisar} item(ns) que o supervisor marcou. ` +
              'Os demais já foram aprovados e não aparecem.'
            : `O supervisor devolveu ${revisar} item(ns) para revisão.`}
        </Text>
      ) : null}

      <TextInput
        style={styles.busca}
        placeholder="Buscar por código ou descrição"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
      />

      <FlatList
        data={itens}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
        // A lista pode ter milhares de itens — sem isto o Android engasga.
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        // Tocar noutro item enquanto o teclado está aberto TROCA de campo, em
        // vez de só fechar o teclado e exigir um segundo toque.
        keyboardShouldPersistTaps="handled"
        // Rolar a lista fecha o teclado — é o gesto natural de "terminei aqui".
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => {
          const local = valores[item.id];
          // Três estados, e é isto que o operador precisa enxergar de relance:
          //   local          → contado NESTE aparelho, ainda não subiu (âmbar)
          //   contadoNoServidor → confirmado pelo servidor (verde, com ✓)
          //   nenhum dos dois   → não contado
          const pendente = local !== undefined;
          const sincronizado = !pendente && item.contadoNoServidor !== null;
          const valor = pendente ? String(local.quantidade)
            : item.contadoNoServidor !== null ? String(item.contadoNoServidor) : '';

          return (
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                {/* Código e localização juntos: são os dois campos de navegação
                    física na prateleira. A descrição é conferência — mesmo
                    agrupamento que o desktop faz em colunas. */}
                <View style={styles.linhaCodigo}>
                  <Text style={styles.codigo}>{item.product_code}</Text>
                  {item.location ? <Text style={styles.local}>📍 {item.location}</Text> : null}
                  {item.exigeLote ? <Text style={styles.chipLote}>LOTE</Text> : null}
                  {item.revisarNoCiclo ? <Text style={styles.chipRevisar}>REVISAR</Text> : null}
                </View>
                <Text style={styles.desc} numberOfLines={2}>{item.product_description}</Text>
                {item.revisarNoCiclo && item.motivoRevisao ? (
                  <Text style={styles.motivo}>Motivo: {item.motivoRevisao}</Text>
                ) : null}
                {sincronizado ? (
                  <Text style={styles.subOk}>
                    contado no C{pacote.cicloEsperado}
                    {item.zeradoNoFecho ? ' · zero do fecho' : ''}
                  </Text>
                ) : null}
                {item.exigeLote && (pendente || sincronizado) ? (
                  <Text style={styles.subLote}>
                    {(local?.lotes?.length ?? 0) > 0
                      ? `${local!.lotes!.length} lote(s) contado(s)`
                      : 'contagem por lote'}
                  </Text>
                ) : null}
              </View>

              {item.exigeLote ? (
                // Produto rastreado não aceita quantidade única — o servidor
                // recusa (CONTAGEM_EXIGE_LOTE). Abre a tela de lotes.
                <TouchableOpacity
                  style={[styles.qtdBotao, pendente && styles.qtdPendente, sincronizado && styles.qtdOk]}
                  onPress={() => setItemEmLote(item)}
                >
                  <Text style={styles.qtdBotaoTxt}>
                    {valor === '' ? 'Lotes' : `${valor}${sincronizado ? ' ✓' : ''}`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.caixaQtd}>
                  {sincronizado ? <Text style={styles.tick}>✓</Text> : null}
                <TextInput
                  style={[styles.qtd, pendente && styles.qtdPendente, sincronizado && styles.qtdOk]}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  // Controlado: com `defaultValue` o valor só entrava na
                  // montagem, e o item reciclado pelo FlatList às vezes ficava
                  // com o número velho na tela, às vezes limpava.
                  value={rascunho[item.id] ?? valor}
                  onChangeText={(t) => {
                    // O que o operador digitou vale na tela SEMPRE — inclusive
                    // vazio. Sem isto não dá para apagar o último dígito.
                    setRascunho((r) => ({ ...r, [item.id]: t }));

                    const txt = t.replace(',', '.').trim();
                    if (txt === '') {
                      // Vazio = "ainda não contei", não zero.
                      void removerContagemLocal(listId, item.id).then(recarregarLocal);
                      return;
                    }
                    const n = Number(txt);
                    if (Number.isNaN(n) || n < 0) return;  // "1." a caminho de "1.5"
                    void registrarContagemLocal(listId, item.id, n).then(recarregarLocal);
                  }}
                  onEndEditing={() =>
                    setRascunho((r) => {
                      const { [item.id]: _fora, ...resto } = r;
                      return resto;
                    })
                  }
                />
                </View>
              )}
            </View>
          );
        }}
      />

      {itemEmLote ? (
        <ContagemLoteModal
          item={itemEmLote}
          contagemAtual={valores[itemEmLote.id]?.lotes}
          onFechar={() => setItemEmLote(null)}
          onSalvar={(lotes) => {
            void registrarContagemPorLote(listId, itemEmLote.id, lotes)
              .then(recarregarLocal)
              .then(() => setItemEmLote(null));
          }}
        />
      ) : null}

      {tecladoAberto ? null : (
      <View style={styles.rodape}>
        <View style={styles.rodapeLinha}>
          <TouchableOpacity
            style={[styles.btnPrimario, { flex: 1 }]}
            onPress={() => void sincronizar()}
            disabled={sincronizando || pendentesEnvio === 0}
          >
            <Text style={styles.btnPrimarioTxt}>
              {sincronizando ? 'Sincronizando…' : `Sincronizar${pendentesEnvio ? ` (${pendentesEnvio})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSec} onPress={() => void sairDaLista()}>
            <Text style={styles.btnSecTxt}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* SEMPRE visível, e nunca desabilitado (decisão do módulo, 03/05): o
            contador bipa o que tem em mãos e libera quando termina — não
            precisa percorrer a lista inteira. */}
        <TouchableOpacity
          style={[styles.btnEntregar, liberando && styles.btnOff]}
          onPress={() => void liberar()}
          disabled={liberando}
        >
          <Text style={styles.btnEntregarTxt}>
            {liberando ? 'Liberando…' : 'Liberar para supervisor'}
          </Text>
        </TouchableOpacity>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 24, gap: 10 },
  barraTopo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  progresso: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  pend: {
    fontSize: 12, fontWeight: '700', color: '#92400e',
    backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  busca: {
    margin: 12, marginBottom: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  cabecalho: {
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, backgroundColor: CAPUL, gap: 6,
  },
  cabLista: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cabLinha: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  cabChipUser: { backgroundColor: 'rgba(0,0,0,0.18)', maxWidth: 170 },
  cabChip: {
    fontSize: 11, fontWeight: '700', color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  linhaCodigo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  codigo: { fontSize: 13, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] },
  desc: { fontSize: 13, color: '#475569', marginTop: 2 },
  local: { fontSize: 12, fontWeight: '600', color: '#334155', fontVariant: ['tabular-nums'] },
  selos: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  selOk: {
    fontSize: 12, fontWeight: '700', color: '#166534',
    backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    overflow: 'hidden',
  },
  rodapeSync: {
    fontSize: 11, color: '#166534', backgroundColor: '#f0fdf4',
    paddingHorizontal: 14, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: '#dcfce7',
  },
  avisoRevisar: {
    fontSize: 12, color: '#9a3412', backgroundColor: '#fff7ed',
    paddingHorizontal: 14, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#fed7aa',
  },
  chipRevisar: {
    fontSize: 9, fontWeight: '800', color: '#9a3412', backgroundColor: '#ffedd5',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  motivo: { fontSize: 11, color: '#9a3412', marginTop: 3, fontStyle: 'italic' },
  subOk: { fontSize: 11, color: '#16a34a', marginTop: 3, fontWeight: '600' },
  caixaQtd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tick: { fontSize: 16, fontWeight: '900', color: '#16a34a' },
  chipLote: {
    fontSize: 9, fontWeight: '800', color: '#6d28d9', backgroundColor: '#ede9fe',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  subLote: { fontSize: 11, color: '#7c3aed', marginTop: 3 },
  qtd: {
    width: 92, textAlign: 'right', fontSize: 18, fontWeight: '700', color: '#0f172a',
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#fff',
  },
  qtdBotao: {
    width: 92, minHeight: 42, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  qtdBotaoTxt: { fontSize: 16, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] },
  /** Contado neste aparelho, ainda não sincronizado. */
  qtdPendente: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  /** Confirmado pelo servidor. */
  qtdOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  rodape: {
    gap: 8, padding: 12,
    borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff',
  },
  rodapeLinha: { flexDirection: 'row', gap: 10 },
  btnEntregar: {
    borderRadius: 10, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: CAPUL, backgroundColor: '#f0fdf4',
  },
  btnEntregarTxt: { color: CAPUL, fontWeight: '800', fontSize: 15 },
  btnOff: { opacity: 0.5 },
  btnPrimario: {
    backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center',
  },
  btnPrimarioTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSec: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center', backgroundColor: '#fff',
  },
  btnSecTxt: { color: '#334155', fontSize: 15, fontWeight: '700' },
  vazioEmoji: { fontSize: 44 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  vazioTxt: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
