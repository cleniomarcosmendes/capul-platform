import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CANAL, COMMIT, EMPACOTADO_EM, ORIGEM_BUNDLE, RUNTIME_VERSION, UPDATE_EM, UPDATE_ID, VERSAO,
  VERSAO_BUILD_APP,
} from '../lib/versao';
import { lerVersaoDosServicos, SERVIDOR, type VersaoServico } from '../lib/versaoServicos';
import { situacaoDoAlinhamento, textoDoAlinhamento } from '../lib/alinhamentoVersao';

const CAPUL = '#1e7d3a';

function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * "Que versão é esta?" — respondida no aparelho, sem acesso ao servidor.
 *
 * Existe porque `version` e `versionCode` ficam parados por meses: dois APKs
 * diferentes se apresentavam com o mesmo rótulo e a única forma de saber se a
 * correção estava ali era testar e torcer. Aqui ficam lado a lado a identidade
 * do app (commit + quando foi empacotado) e a de cada serviço, com o veredito
 * de alinhamento no topo.
 *
 * Todo texto é `selectable` de propósito: é o que se copia para o chat do
 * suporte. (Copiar com um toque pediria `expo-clipboard` — MÓDULO NATIVO, ou
 * seja, APK novo só para isso. Não vale o preço.)
 */
export function SobreScreen() {
  const insets = useSafeAreaInsets();
  const [servicos, setServicos] = useState<VersaoServico[] | null>(null);
  const [consultando, setConsultando] = useState(false);

  const consultar = useCallback(() => {
    setConsultando(true);
    void lerVersaoDosServicos()
      .then(setServicos)
      .finally(() => setConsultando(false));
  }, []);

  useEffect(consultar, [consultar]);

  const situacao = servicos
    ? situacaoDoAlinhamento(COMMIT, servicos.map((s) => (s.estado === 'ok' ? s.commit : null)))
    : 'indeterminado';

  return (
    <ScrollView
      style={styles.tela}
      contentContainerStyle={[styles.conteudo, { paddingBottom: 24 + insets.bottom }]}
    >
      {servicos ? (
        <View style={[styles.veredito, styles[situacao]]}>
          <Text style={styles.vereditoTitulo}>
            {situacao === 'alinhado' ? '✅ Alinhado' : situacao === 'divergente' ? '⚠️ Divergente' : '❔ Indeterminado'}
          </Text>
          <Text style={styles.vereditoTxt}>{textoDoAlinhamento(situacao)}</Text>
        </View>
      ) : null}

      <Text style={styles.secao}>Este aplicativo</Text>
      <View style={styles.bloco}>
        <Linha rotulo="Versão" valor={`${VERSAO}${VERSAO_BUILD_APP.build ? ` (build ${VERSAO_BUILD_APP.build})` : ''}`} />
        <Linha rotulo="Commit" valor={COMMIT} destaque />
        <Linha rotulo="Empacotado em" valor={dataHora(EMPACOTADO_EM)} />
        <Linha rotulo="Ambiente" valor={CANAL ?? 'desenvolvimento (Expo Go)'} />
        {/* APK x OTA: com o mesmo APK instalado, o que roda pode ser outro
            bundle baixado por cima — e é ele que tem (ou não) a correção. */}
        <Linha rotulo="Origem do código" valor={ORIGEM_BUNDLE === 'APK' ? 'bundle do APK' : 'atualização OTA'} />
        {ORIGEM_BUNDLE === 'OTA' ? (
          <>
            <Linha rotulo="Atualização" valor={UPDATE_ID ?? '—'} />
            <Linha rotulo="Publicada em" valor={dataHora(UPDATE_EM)} />
            {/* Sem isto o "build" acima seria uma mentira discreta: ele vem do
                manifesto do bundle, e num OTA o APK instalado pode ser outro. */}
            <Text style={styles.ressalva}>
              Versão e build acima descrevem o bundle em execução. O APK instalado pode ter outro
              número — quem manda no que roda é este bundle.
            </Text>
          </>
        ) : null}
        <Linha rotulo="Runtime" valor={RUNTIME_VERSION ?? '—'} />
      </View>

      <Text style={styles.secao}>Serviços</Text>
      <Text style={styles.servidor} selectable>{SERVIDOR}</Text>
      <View style={styles.bloco}>
        {servicos === null ? (
          <ActivityIndicator color={CAPUL} style={{ marginVertical: 12 }} />
        ) : (
          servicos.map((s) => (
            <View key={s.nome} style={styles.servico}>
              <Text style={styles.servicoNome}>
                {s.estado === 'ok' ? (s.status === 'ok' ? '🟢' : '🟡') : '🔴'} {s.nome}
              </Text>
              {s.estado === 'ok' ? (
                <>
                  <Linha rotulo="Commit" valor={s.commit ?? 'desconhecido'} destaque />
                  <Linha rotulo="Versão" valor={s.versao ?? '—'} />
                  <Linha rotulo="Build em" valor={dataHora(s.buildEm)} />
                  {s.status && s.status !== 'ok' ? <Linha rotulo="Estado" valor={s.status} /> : null}
                </>
              ) : (
                <Text style={styles.erro}>Sem resposta — {s.erro}</Text>
              )}
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.btn} onPress={consultar} disabled={consultando}>
        {consultando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnTxt}>Consultar de novo</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.ajuda}>
        Segure sobre um valor para copiar. "Commit" é o que identifica o código: se o do app e o dos
        serviços forem iguais, os dois lados são da mesma entrega.
      </Text>
    </ScrollView>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={styles.linha}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={[styles.valor, destaque && styles.valorDestaque]} selectable>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f8fafc' },
  conteudo: { padding: 16, gap: 10 },
  secao: { fontSize: 13, fontWeight: '700', color: '#475569', marginTop: 6 },
  bloco: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, gap: 6 },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rotulo: { fontSize: 13, color: '#64748b', width: 116 },
  valor: { fontSize: 13, color: '#0f172a', flex: 1 },
  valorDestaque: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  servico: { gap: 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  servicoNome: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  servidor: { fontSize: 12, color: '#64748b' },
  erro: { fontSize: 13, color: '#b91c1c' },
  veredito: { borderRadius: 12, padding: 12, gap: 4, borderWidth: 1 },
  alinhado: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  divergente: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  indeterminado: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  vereditoTitulo: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  vereditoTxt: { fontSize: 13, color: '#334155', lineHeight: 18 },
  btn: { backgroundColor: CAPUL, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ajuda: { fontSize: 12, color: '#94a3b8', lineHeight: 17 },
  ressalva: { fontSize: 12, color: '#92400e', backgroundColor: '#fffbeb', borderRadius: 8, padding: 8, lineHeight: 17 },
});
