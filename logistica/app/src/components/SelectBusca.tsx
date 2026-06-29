import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const CAPUL = '#1e7d3a';

export interface OpcaoSelect { id: string; nome: string; subtitulo?: string }

/**
 * Dropdown com busca (substitui os "chips" quando a lista pode crescer — tipo de
 * despesa, fornecedor, etc.). Uma linha que abre a lista; o campo de busca só
 * aparece quando há mais itens que `limiteBusca`. `permiteLimpar` adiciona a opção
 * "— (nenhum)" para campos opcionais.
 */
export function SelectBusca({
  valor, opcoes, onChange, placeholder = 'Selecionar…', permiteLimpar = false, limiteBusca = 8, editable = true,
}: {
  valor: string;
  opcoes: OpcaoSelect[];
  onChange: (id: string) => void;
  placeholder?: string;
  permiteLimpar?: boolean;
  limiteBusca?: number;
  editable?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const selecionado = opcoes.find((o) => o.id === valor);
  const mostrarBusca = opcoes.length > limiteBusca;
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t
      ? opcoes.filter((o) => `${o.nome} ${o.subtitulo ?? ''}`.toLowerCase().includes(t))
      : opcoes;
  }, [opcoes, busca]);

  function escolher(id: string) {
    onChange(id);
    setAberto(false);
    setBusca('');
  }

  return (
    <View>
      <TouchableOpacity
        style={[styles.campo, !editable && styles.campoOff]}
        onPress={() => editable && setAberto((a) => !a)}
        disabled={!editable}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.campoTxt, !selecionado && styles.placeholder]} numberOfLines={1}>
            {selecionado ? selecionado.nome : placeholder}
          </Text>
          {selecionado?.subtitulo ? <Text style={styles.campoSub} numberOfLines={1}>{selecionado.subtitulo}</Text> : null}
        </View>
        <Text style={styles.seta}>{aberto ? '▲' : '▾'}</Text>
      </TouchableOpacity>
      {aberto ? (
        <View style={styles.painel}>
          {mostrarBusca ? (
            <TextInput
              style={styles.busca}
              value={busca}
              onChangeText={setBusca}
              placeholder="🔎 Buscar…"
              autoCorrect={false}
              autoCapitalize="none"
            />
          ) : null}
          <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {permiteLimpar ? (
              <TouchableOpacity style={styles.item} onPress={() => escolher('')}>
                <Text style={[styles.itemTxt, styles.placeholder]}>— (nenhum)</Text>
              </TouchableOpacity>
            ) : null}
            {filtradas.length === 0 ? (
              <Text style={styles.vazio}>Nada encontrado.</Text>
            ) : filtradas.map((o) => (
              <TouchableOpacity key={o.id} style={styles.item} onPress={() => escolher(o.id)}>
                <Text style={[styles.itemTxt, o.id === valor && styles.itemSel]}>{o.nome}</Text>
                {o.subtitulo ? <Text style={styles.itemSub} numberOfLines={1}>{o.subtitulo}</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' },
  campoOff: { backgroundColor: '#f1f5f9' },
  campoTxt: { fontSize: 15, color: '#0f172a' },
  campoSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  placeholder: { color: '#94a3b8' },
  seta: { fontSize: 12, color: '#64748b', marginLeft: 8 },
  painel: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginTop: 6, overflow: 'hidden', backgroundColor: '#fff' },
  busca: { paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  lista: { maxHeight: 220 },
  item: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemTxt: { fontSize: 14, color: '#0f172a' },
  itemSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  itemSel: { color: CAPUL, fontWeight: '700' },
  vazio: { padding: 14, fontSize: 13, color: '#64748b' },
});
