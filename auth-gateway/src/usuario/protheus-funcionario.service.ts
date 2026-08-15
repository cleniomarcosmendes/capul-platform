import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { IntegracaoService } from '../integracao/integracao.service';

export interface FuncionarioProtheus { matricula: string; nome: string }

/**
 * Normaliza a resposta do `infoFuncionario` (INFOCLIENTES/infoPortal), que é o cadastro
 * de COLABORADOR do Protheus. Formato: `{ funcionarios: [{ matricula, nome, cc }] }` —
 * ou `{ mensagem: "...não encontrado..." }`, que vira lista vazia. Campos vêm com
 * espaços à direita (campo fixo do Protheus): trim em tudo. Pura/testável.
 */
export function mapFuncionarios(payload: unknown, limite = 25): FuncionarioProtheus[] {
  const lista = (payload as { funcionarios?: unknown })?.funcionarios;
  if (!Array.isArray(lista)) return []; // { mensagem: "não encontrado" }
  const vistos = new Set<string>();
  const out: FuncionarioProtheus[] = [];
  for (const it of lista as Array<{ matricula?: unknown; nome?: unknown }>) {
    const matricula = String(it?.matricula ?? '').trim().toUpperCase();
    const nome = String(it?.nome ?? '').trim();
    if (!matricula || !nome) continue;
    if (vistos.has(matricula)) continue;
    vistos.add(matricula);
    out.push({ matricula, nome });
    if (out.length >= limite) break;
  }
  return out;
}

/**
 * Busca FUNCIONÁRIO no Protheus — para o cadastro de usuário do Configurador.
 *
 * ⚠️ **Corrigido em 09/08/2026.** Antes usava a operação **`clienteEndereco` (SA1 =
 * CLIENTES)** e ficava com as linhas cujo código começa com `E`, como heurística de
 * "empregado". Fonte errada: a matrícula gravada no usuário é o que liga o login à
 * PESSOA no Protheus — dela saem o `loginPortal` e o departamento que responde pelas
 * despesas na Logística. Vindo do cadastro de clientes, podia-se gravar um código que
 * o portal do RH não reconhece.
 *
 * Agora usa **`infoFuncionario`** (INFOCLIENTES/infoPortal), o cadastro de colaborador
 * — o MESMO que a Logística já consome e que o `loginPortal` valida. Aceita
 * `?NOME=` (busca) e `?MATRICULA=` (confirmação de quem é a chapa digitada).
 */
@Injectable()
export class ProtheusFuncionarioService {
  private readonly logger = new Logger(ProtheusFuncionarioService.name);

  constructor(private readonly integracao: IntegracaoService) {}

  async buscarPorNome(nome: string): Promise<FuncionarioProtheus[]> {
    const termo = (nome ?? '').trim();
    if (termo.length < 3) return []; // evita varredura pesada no Protheus com termo curto
    return this.consultar(`NOME=${encodeURIComponent(termo)}`, `infoFuncionario NOME=${termo}`);
  }

  /**
   * Confirma QUEM é a chapa digitada — o mesmo padrão do Chamado: digita a matrícula,
   * a tela mostra o nome. Evita cadastrar a chapa de outra pessoa por engano de dígito,
   * que é barato de fazer e caro de descobrir (a matrícula decide quem aprova a despesa
   * de quem, na Logística).
   */
  async buscarPorMatricula(matricula: string): Promise<FuncionarioProtheus | null> {
    const chapa = (matricula ?? '').trim().toUpperCase();
    if (!chapa) return null;
    const achados = await this.consultar(`MATRICULA=${encodeURIComponent(chapa)}`, `infoFuncionario MATRICULA=${chapa}`);
    return achados[0] ?? null;
  }

  /** Chama o `infoFuncionario` com a query informada. Lista vazia em qualquer falha. */
  private async consultar(query: string, logLabel: string): Promise<FuncionarioProtheus[]> {
    let cfg: Awaited<ReturnType<IntegracaoService['getEndpointsAtivos']>>;
    try {
      cfg = await this.integracao.getEndpointsAtivos('PROTHEUS');
    } catch {
      this.logger.warn('Integração PROTHEUS não cadastrada — consulta de funcionário indisponível');
      return [];
    }
    const ep = cfg?.endpoints.find((e) => e.operacao === 'infoFuncionario');
    if (!ep) { this.logger.warn('Operação infoFuncionario não cadastrada (PROTHEUS) — consulta indisponível'); return []; }
    const authHeader = cfg.tipoAuth === 'BEARER' ? `Bearer ${cfg.authConfig}` : `Basic ${cfg.authConfig}`;
    const data = await this.requestJson(`${ep.url}?${query}`, authHeader, ep.timeoutMs || 8000, ep.metodo || 'GET', logLabel);
    if (!data) return [];
    return mapFuncionarios(data);
  }

  /** Requisição JSON (http/https), null em erro/timeout/status>=400. Igual ao PortalAuthService. */
  private requestJson(
    url: string,
    authHeader: string,
    timeoutMs: number,
    metodo: string,
    logLabel: string,
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;
      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: metodo,
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        timeout: timeoutMs,
        // ⭐ TLS VALIDADO. Era `false`, e por ali passavam a credencial Basic de PRODUÇÃO
        // do Protheus e — no login do portal — a SENHA do funcionário. Achado do
        // /security-review de 15/08: com a validação desligada, quem estivesse no caminho
        // apresentava qualquer certificado, colhia as credenciais e ainda podia responder
        // "autenticacao: OK" para matrícula arbitrária (é essa resposta, e só ela, que
        // autoriza o login de conta `autenticaPortal`).
        // Verificado em 15/08 que NÃO era necessário: `apiportal.capul.com.br` usa
        // certificado Sectigo (CA pública) e valida com o repositório padrão — testado
        // dentro do container, sem arquivo de CA nenhum.
        rejectUnauthorized: true,
      };
      const req = transport.request(options, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode >= 400) {
            this.logger.warn(`Protheus retornou status ${res.statusCode} para ${logLabel}`);
            resolve(null);
            return;
          }
          try { resolve(JSON.parse(body)); }
          catch { this.logger.error(`Erro ao parsear resposta Protheus de ${logLabel}`); resolve(null); }
        });
      });
      req.on('timeout', () => { req.destroy(); this.logger.error(`Timeout Protheus ${logLabel}`); resolve(null); });
      req.on('error', (err) => { this.logger.error(`Erro Protheus (${logLabel}): ${err.message}`); resolve(null); });
      req.end();
    });
  }
}
