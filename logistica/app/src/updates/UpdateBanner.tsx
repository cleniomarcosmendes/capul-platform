import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppUpdate } from './useAppUpdate';

/** Banner "Nova versão disponível" — [Atualizar agora] / [Adiar]. */
export function UpdateBanner() {
  const { updateReady, aplicar, adiar } = useAppUpdate();
  const insets = useSafeAreaInsets();
  if (!updateReady) return null;
  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.texto}>Nova versão disponível</Text>
      <View style={styles.acoes}>
        <Pressable onPress={aplicar} style={[styles.botao, styles.primario]}>
          <Text style={styles.botaoTextoPrimario}>Atualizar agora</Text>
        </Pressable>
        <Pressable onPress={adiar} style={styles.botao}>
          <Text style={styles.botaoTexto}>Adiar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  texto: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  acoes: { flexDirection: 'row', gap: 8 },
  botao: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  primario: { backgroundColor: '#4caf50' },
  botaoTexto: { color: '#cfe0f0', fontSize: 13 },
  botaoTextoPrimario: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
