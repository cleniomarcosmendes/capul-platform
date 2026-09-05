import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * IDENTIDADE DO BUILD que está rodando — para responder, em campo e sem acesso
 * ao servidor, à única pergunta que importa antes de testar: "este backend é o
 * da correção que eu quero testar, ou é o de ontem?".
 *
 * `commit` e `buildEm` são ARGUMENTOS DE BUILD (Dockerfile `ARG` → `ENV`),
 * gravados na imagem no instante em que o código foi congelado — não em runtime,
 * senão diriam quando o container subiu, que é outra coisa.
 *
 * ⚠️ Ausente = **"desconhecido"**, nunca um palpite. Build feito sem passar o
 * arg (docker compose build "na mão") tem de SE DECLARAR sem identidade: uma
 * versão errada é pior que versão nenhuma — ela encerra a investigação com a
 * resposta trocada. Para preencher, use `scripts/build-com-versao.sh`.
 */
export interface VersaoBuild {
  /** `version` do package.json do serviço. */
  versao: string;
  /** Commit curto (`git rev-parse --short HEAD`) ou 'desconhecido'. */
  commit: string;
  /** ISO-8601 de quando a imagem foi construída, ou null. */
  buildEm: string | null;
}

function versaoDoPackage(): string | null {
  try {
    const pkg = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    return (JSON.parse(pkg) as { version?: string }).version ?? null;
  } catch {
    return null; // sem package.json ao lado (teste, bundle exótico) — não é erro
  }
}

export const VERSAO_BUILD: VersaoBuild = {
  versao: process.env.APP_VERSION?.trim() || versaoDoPackage() || 'desconhecida',
  commit: process.env.APP_COMMIT?.trim() || 'desconhecido',
  buildEm: process.env.APP_BUILD_TIME?.trim() || null,
};
