import Constants from 'expo-constants';

/**
 * Versão exibida ao usuário. Fonte da verdade = `expo.version` do app.json —
 * num build com OTA o manifest da atualização traz a versão do bundle que está
 * de fato rodando, que é a que o suporte precisa ouvir do usuário (o build
 * nativo aparece ao lado só quando difere).
 */
export const VERSAO = Constants.expoConfig?.version ?? '—';

const BUILD = Constants.expoConfig?.android?.versionCode;

export const VERSAO_LABEL = `CAPUL Logística V. ${VERSAO}${BUILD ? ` · build ${BUILD}` : ''}`;
