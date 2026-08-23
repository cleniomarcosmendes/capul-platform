import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { MfaNaoSuportadoError } from '../api/client';
import { API_URL } from '../api/config';
import { VERSAO_LABEL } from '../lib/versao';

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
        e instanceof MfaNaoSuportadoError
          ? 'Esta conta usa verificação em duas etapas (MFA), que o app ainda não faz. Peça à TI para desativar o MFA desta conta ou use o sistema no computador.'
        : status === 401 ? 'Matrícula ou senha inválidas.'
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
      {/* Card ANCORADO no topo (não centralizado): os campos ficam sempre acima
          do teclado, independente do modo de teclado do Android (adjustResize/pan).
          O ScrollView é rede de segurança — em tela baixa, rola até a senha. */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.box}>
        {/* O app começou em Entregas e Frota e hoje também faz RDV do supervisor e
            contagem de Inventário — o subtítulo antigo ("Entregas e Frota") já estava
            menor que o produto. O nome fica no da plataforma e o subtítulo diz o que o
            app É, não a lista de módulos: assim não envelhece no quinto módulo. */}
        <Text style={styles.titulo}>CAPUL Platform</Text>
        <Text style={styles.sub}>Aplicativo de campo</Text>

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

        {/* ⭐ A QUAL SERVIDOR este app está falando. Sem isto, errar de ambiente
            não dá erro de ambiente: dá "credenciais inválidas" ou "meu dado
            sumiu", e a pessoa vai caçar defeito onde não há. Aconteceu em 15/08:
            um bundle de produção caiu no fallback de homologação e o login
            deixou de funcionar sem nenhuma pista do porquê. Também é o que o
            suporte precisa ouvir quando o entregador liga. */}
        <Text style={styles.ambiente}>{API_URL.replace(/^https?:\/\//, '')}</Text>
        <Text style={styles.ambiente}>{VERSAO_LABEL}</Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ambiente: { marginTop: 10, fontSize: 11, color: '#94a3b8', textAlign: 'center' },
  container: { flex: 1, backgroundColor: CAPUL },
  // Ancora o card no topo (paddingTop) em vez de centralizar — garante que a
  // senha fique acima do teclado sem depender do windowSoftInputMode do Android.
  scroll: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 96, paddingHorizontal: 24, paddingBottom: 24 },
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
