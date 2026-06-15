import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';

const CAPUL = '#1e7d3a';

export function LoginScreen() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    if (!usuario.trim() || !senha) return;
    setErro('');
    setEntrando(true);
    try {
      await login(usuario, senha);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setErro(
        status === 401 ? 'Matrícula ou senha inválidas.'
        : status === 503 ? 'Portal do RH indisponível. Tente novamente em instantes.'
        : 'Não foi possível entrar. Verifique a conexão.',
      );
    } finally {
      setEntrando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.box}>
        <Text style={styles.titulo}>CAPUL Logística</Text>
        <Text style={styles.sub}>Entregas e Frota</Text>

        <TextInput
          style={styles.input}
          placeholder="Matrícula ou usuário"
          autoCapitalize="none"
          autoCorrect={false}
          value={usuario}
          onChangeText={setUsuario}
          editable={!entrando}
        />
        <View style={styles.senhaWrap}>
          <TextInput
            style={[styles.input, styles.senhaInput]}
            placeholder="Senha"
            secureTextEntry={!mostrarSenha}
            autoCapitalize="none"
            autoCorrect={false}
            value={senha}
            onChangeText={setSenha}
            editable={!entrando}
            onSubmitEditing={entrar}
          />
          <TouchableOpacity
            style={styles.olho}
            onPress={() => setMostrarSenha((v) => !v)}
            hitSlop={10}
            accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Text style={styles.olhoTxt}>{mostrarSenha ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.botao, (entrando || !usuario.trim() || !senha) && styles.botaoOff]}
          onPress={entrar}
          disabled={entrando || !usuario.trim() || !senha}
        >
          {entrando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoTxt}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CAPUL, justifyContent: 'center', padding: 24 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 24, gap: 12 },
  titulo: { fontSize: 24, fontWeight: '700', color: CAPUL, textAlign: 'center' },
  sub: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  senhaWrap: { justifyContent: 'center' },
  senhaInput: { paddingRight: 48 },
  olho: { position: 'absolute', right: 8, padding: 6 },
  olhoTxt: { fontSize: 20 },
  erro: { color: '#dc2626', fontSize: 13 },
  botao: {
    backgroundColor: CAPUL,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botaoOff: { opacity: 0.5 },
  botaoTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
