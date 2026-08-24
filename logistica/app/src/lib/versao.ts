import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Identidade do app que está rodando NESTE aparelho.
 *
 * Fonte da verdade = `expo.version` do app.json — num build com OTA o manifest
 * da atualização traz a versão do bundle que está de fato rodando.
 *
 * ⚠️ `version` (1.0.0) e `versionCode` andam parados por meses: sozinhos, eles
 * NÃO distinguem dois APKs. Quem distingue é o `commit`, injetado no empacotamento
 * por `app.config.js`. Sem ele, "estou testando a versão certa?" só se responde
 * por fé — e em 24/08 essa dúvida chegou junto com o APK novo.
 */
export const VERSAO = Constants.expoConfig?.version ?? '—';

const BUILD = Constants.expoConfig?.android?.versionCode;

interface ExtraBuild {
  commit?: string;
  em?: string;
}
const extraBuild = (Constants.expoConfig?.extra as { build?: ExtraBuild } | undefined)?.build;

/** Commit do código que virou este bundle (ou 'desconhecido'). */
export const COMMIT = extraBuild?.commit ?? 'desconhecido';
/** ISO-8601 de quando o bundle foi empacotado (ou null). */
export const EMPACOTADO_EM = extraBuild?.em ?? null;

/**
 * Leitura defensiva do expo-updates: no Expo Go / build de desenvolvimento os
 * campos são nulos, e uma exceção aqui derrubaria o rodapé de TODA tela — o
 * módulo é importado no Login e na Home.
 */
function doUpdates<T>(ler: () => T, aoFalhar: T): T {
  try {
    return ler();
  } catch {
    return aoFalhar;
  }
}

/** Canal do build: 'production', 'homolog' — ou null no Expo Go. */
export const CANAL = doUpdates(() => Updates.channel, null);
/** O que está rodando: o bundle que veio no APK, ou uma atualização OTA por cima. */
export const ORIGEM_BUNDLE: 'APK' | 'OTA' = doUpdates(
  () => (Updates.isEmbeddedLaunch ? 'APK' : 'OTA'),
  'APK',
);
export const UPDATE_ID = doUpdates(() => Updates.updateId, null);
export const UPDATE_EM = doUpdates(() => Updates.createdAt?.toISOString() ?? null, null);
export const RUNTIME_VERSION = doUpdates(() => Updates.runtimeVersion, null);

/**
 * Rótulo curto do rodapé (Login e Home). Leva o commit: é ele que responde
 * "qual build é este?" — e o rodapé é onde a pessoa olha primeiro.
 */
export const VERSAO_LABEL = `CAPUL Logística V. ${VERSAO}${BUILD ? ` · build ${BUILD}` : ''} · ${COMMIT}`;

export const VERSAO_BUILD_APP = { versao: VERSAO, build: BUILD ?? null, commit: COMMIT };
