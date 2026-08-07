import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { getDeviceId } from '../auth/deviceId';
import { baixarItensDaLista, retirarLista, devolverLista } from '../api/inventario';
import {
  salvarPacote, lerPacote, descartarPacote, salvarLease, lerLease,
  registrarContagemLocal, contagensPendentes, sincronizarContagens,
  type PacoteContagem, type ContagemLocal,
} from '../offline/contagemOffline';

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
  const [pacote, setPacote] = useState<PacoteContagem | null>(null);
  const [valores, setValores] = useState<Record<string, ContagemLocal>>({});
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca] = useState('');

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

  async function encerrar() {
    const pend = await contagensPendentes(listId);
    if (pend.length > 0) {
      // Guarda que só o cliente pode fazer: o servidor não tem como saber que
      // existe trabalho preso neste aparelho.
      Alert.alert(
        'Ainda há contagens não sincronizadas',
        `${pend.length} contagem(ns) só existem neste aparelho. Sincronize antes de encerrar, ` +
          `senão elas se perdem.`,
      );
      return;
    }
    const token = await lerLease(listId);
    try {
      if (token) await devolverLista(listId, token);
    } catch {
      /* devolver é best-effort: o supervisor consegue liberar do desktop */
    }
    await descartarPacote(listId);
    navigation.goBack();
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
  const itens = termo
    ? pacote.itens.filter(
        (i) => i.product_code.toLowerCase().includes(termo) ||
               i.product_description.toLowerCase().includes(termo),
      )
    : pacote.itens;

  const contados = pacote.itens.filter(
    (i) => valores[i.id] !== undefined || i.contadoNoServidor !== null,
  ).length;
  const pendentesEnvio = Object.keys(valores).length;

  return (
    <View style={styles.container}>
      <View style={styles.barraTopo}>
        <Text style={styles.progresso}>
          {contados} de {pacote.itens.length} contados
        </Text>
        {pendentesEnvio > 0 && (
          <Text style={styles.pend}>{pendentesEnvio} a sincronizar</Text>
        )}
      </View>

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
        renderItem={({ item }) => {
          const local = valores[item.id];
          const valor = local ? String(local.quantidade)
            : item.contadoNoServidor !== null ? String(item.contadoNoServidor) : '';
          return (
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.codigo}>{item.product_code}</Text>
                <Text style={styles.desc} numberOfLines={2}>{item.product_description}</Text>
                {item.location ? <Text style={styles.local}>📍 {item.location}</Text> : null}
              </View>
              <TextInput
                style={[styles.qtd, local && styles.qtdPendente]}
                keyboardType="decimal-pad"
                placeholder="—"
                defaultValue={valor}
                onEndEditing={(e) => {
                  const txt = e.nativeEvent.text.replace(',', '.').trim();
                  if (!txt) return;
                  const n = Number(txt);
                  if (Number.isNaN(n) || n < 0) {
                    Alert.alert('Quantidade inválida', 'Informe um número maior ou igual a zero.');
                    return;
                  }
                  void registrarContagemLocal(listId, item.id, n).then(recarregarLocal);
                }}
              />
            </View>
          );
        }}
      />

      <View style={styles.rodape}>
        <TouchableOpacity
          style={[styles.btnPrimario, { flex: 1 }]}
          onPress={() => void sincronizar()}
          disabled={sincronizando || pendentesEnvio === 0}
        >
          <Text style={styles.btnPrimarioTxt}>
            {sincronizando ? 'Sincronizando…' : `Sincronizar${pendentesEnvio ? ` (${pendentesEnvio})` : ''}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSec} onPress={() => void encerrar()}>
          <Text style={styles.btnSecTxt}>Encerrar</Text>
        </TouchableOpacity>
      </View>
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
  codigo: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  desc: { fontSize: 13, color: '#475569', marginTop: 1 },
  local: { fontSize: 12, color: '#64748b', marginTop: 2 },
  qtd: {
    width: 92, textAlign: 'right', fontSize: 18, fontWeight: '700', color: '#0f172a',
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#fff',
  },
  qtdPendente: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  rodape: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff',
  },
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
