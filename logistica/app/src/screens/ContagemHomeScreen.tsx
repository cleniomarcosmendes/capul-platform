import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { listarMinhasListas, type MinhaListaContagem } from '../api/inventario';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'ContagemHome'>;

/**
 * Entrada da CONTAGEM no app: as listas em que o usuário é o contador do ciclo
 * atual.
 *
 * A regra de "UMA LISTA POR VEZ" é o que dimensiona o aparelho — o teto de
 * 3.000 itens por lista sozinho não protege nada, porque o contador pode ter
 * várias listas atribuídas. Por isso aqui ele ESCOLHE uma; baixar/contar/
 * sincronizar acontecem sobre ela até o fim.
 */
export function ContagemHomeScreen({ navigation }: Props) {
  const [listas, setListas] = useState<MinhaListaContagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setListas(await listarMinhasListas());
    } catch (e) {
      // Extraído UMA vez e já tipado: antes o mesmo caminho era reescrito três
      // vezes com `as any`, que apaga justamente a checagem que evita ler
      // `.mensagem` de algo que não é objeto.
      const detalhe = (e as { response?: { data?: { detail?: { mensagem?: string } | string } } })
        ?.response?.data?.detail;
      setErro(
        detalhe
          ? String(typeof detalhe === 'string' ? detalhe : detalhe.mensagem)
          : 'Não foi possível carregar suas listas.',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  // Recarrega ao voltar para a tela — o supervisor pode ter liberado/devolvido
  // uma lista enquanto o contador estava em outra parte do app.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={CAPUL} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={listas}
      keyExtractor={(l) => l.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void carregar()} />}
      ListHeaderComponent={
        erro ? (
          <View style={styles.erroBox}>
            <Text style={styles.erroTxt}>{erro}</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        !erro ? (
          <View style={styles.vazio}>
            <Text style={styles.vazioEmoji}>📋</Text>
            <Text style={styles.vazioTitulo}>Nenhuma lista para contar</Text>
            <Text style={styles.vazioTxt}>
              Você aparece aqui quando o supervisor liberar uma lista com você como contador do
              ciclo atual.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <CardLista
          lista={item}
          onPress={() =>
            navigation.navigate('ContagemLista', { listId: item.id, listName: item.list_name })
          }
        />
      )}
    />
  );
}

function CardLista({ lista, onPress }: { lista: MinhaListaContagem; onPress: () => void }) {
  const pct = Math.round(lista.progress_percentage || 0);
  const hora = lista.lease_at
    ? new Date(lista.lease_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={styles.card} onTouchEnd={onPress}>
      <View style={styles.cardTopo}>
        <Text style={styles.cardNome}>{lista.list_name}</Text>
        <Text style={styles.ciclo}>{lista.current_cycle}º ciclo</Text>
      </View>
      <Text style={styles.cardSub}>
        {lista.inventory_name} · armazém {lista.warehouse}
      </Text>

      <View style={styles.barraFundo}>
        <View style={[styles.barra, { width: `${Math.min(100, pct)}%` }]} />
      </View>
      <Text style={styles.progresso}>
        {lista.counted_items} de {lista.total_items} itens ({pct}%)
      </Text>

      {/* O lease avisa ANTES de o contador começar. Se estiver em OUTRO
          aparelho, retirar aqui vai ser recusado pelo backend — melhor ele
          saber agora do que depois de baixar. */}
      {lista.lease_ativo && (
        <Text style={styles.lease}>
          📱 Em contagem em um aparelho{hora ? ` desde as ${hora}` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0', gap: 6,
  },
  cardTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardNome: { fontSize: 17, fontWeight: '700', color: CAPUL, flex: 1 },
  ciclo: {
    fontSize: 12, fontWeight: '700', color: '#1d4ed8',
    backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  cardSub: { fontSize: 13, color: '#64748b' },
  barraFundo: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 999, marginTop: 4 },
  barra: { height: 8, backgroundColor: CAPUL, borderRadius: 999 },
  progresso: { fontSize: 12, color: '#475569' },
  lease: { fontSize: 12, color: '#3730a3', backgroundColor: '#e0e7ff', padding: 6, borderRadius: 8 },
  erroBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12 },
  erroTxt: { color: '#991b1b', fontSize: 14 },
  vazio: { alignItems: 'center', gap: 8, paddingTop: 48, paddingHorizontal: 24 },
  vazioEmoji: { fontSize: 44 },
  vazioTitulo: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  vazioTxt: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
