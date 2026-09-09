/**
 * RESOLUÇÃO usuário do sistema → colaborador.
 *
 * É a base da separação de funções: a regra "ninguém mexe na própria avaliação"
 * compara IDS, e para isso o `colaboradorId` de quem está logado precisa ser
 * resolvido em um lugar só. Comparar matrícula como string espalhada pelo código
 * é o caminho conhecido para a regra valer em alguns pontos e não em outros.
 *
 * ── Onde fica o "uma vez" ───────────────────────────────────────────────────
 * A plataforma é JWT **stateless**: não há sessão de servidor onde guardar o
 * resultado do login, e o token dura 60 minutos. Guardar a resolução no token
 * seria pior: identidade que vem do JWT congela, e trocar a matrícula de alguém
 * no Configurador só faria efeito uma hora depois — foi assim que nasceu o 403
 * intermitente do Inventário e da Logística.
 *
 * Então o "uma vez" é **uma vez por requisição**: o `IdentidadeGuard` resolve no
 * início e pendura em `req.colaboradorId`; todo o resto lê de lá pelo decorator
 * `@ColaboradorAtual()`. É uma consulta indexada por requisição, e a identidade
 * vem sempre do BANCO.
 *
 * ── Falha fechada ───────────────────────────────────────────────────────────
 * Usuário sem matrícula, ou cuja matrícula não existe entre os colaboradores
 * elegíveis, **não entra no módulo**. Sem `colaboradorId` não há como aplicar a
 * separação de funções, e liberar por omissão significaria deixar exatamente a
 * gestora — o caso que a regra existe para cobrir — passar batido.
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { chapasEquivalentes } from '../common/chapa.js';
import { MODULO } from '../common/roles-rh.js';
import {
  classificarAcesso,
  motivoDoAcesso,
  type AcessoDoAvaliador,
  type ContaEncontrada,
} from './acesso-do-avaliador.js';

export interface ColaboradorResumo {
  id: string;
  filial: string;
  matricula: string;
  nome: string;
  situacao: string;
}

/** Erro de DADO, não de permissão: a regra de negócio diz que não acontece. */
export class MatriculaAmbiguaError extends Error {
  constructor(
    readonly matricula: string,
    readonly encontrados: ColaboradorResumo[],
  ) {
    super(
      `Matrícula ${matricula} tem ${encontrados.length} colaboradores ATIVOS ` +
        `(filiais ${encontrados.map((c) => c.filial).join(', ')}). ` +
        `A regra de negócio diz que isso não acontece: matrícula duplicada é histórico de ` +
        `transferência, e as filiais antigas ficam com demissão preenchida. ` +
        `Corrija o cadastro antes de seguir.`,
    );
    this.name = 'MatriculaAmbiguaError';
  }
}

/**
 * Escolhe o colaborador único de uma matrícula — puro, para poder ser testado
 * sem banco.
 *
 * ⚠️ **Nunca "pega o primeiro".** Mais de um ativo para a mesma matrícula é
 * anomalia de dado, e escolher em silêncio significaria decidir quem é a pessoa
 * por ordem de índice — em um módulo onde a nota decide mérito. É o mesmo tipo
 * de escolha calada que produziu a promoção falsa no SR7010.
 */
export function escolherColaboradorUnico(
  encontrados: readonly ColaboradorResumo[],
  matricula: string,
): ColaboradorResumo | null {
  if (encontrados.length === 0) return null;
  if (encontrados.length > 1) throw new MatriculaAmbiguaError(matricula, [...encontrados]);
  return encontrados[0];
}

@Injectable()
export class IdentidadeService {
  private readonly logger = new Logger(IdentidadeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Matrícula do usuário logado, lida de `core.usuarios` — do BANCO, não do JWT.
   * `core` é read-only aqui: consulta por `$queryRaw`, como Logística e Fiscal.
   */
  async matriculaDoUsuario(usuarioId: string): Promise<string | null> {
    const linhas = await this.prisma.$queryRaw<{ matricula: string | null }[]>(
      Prisma.sql`SELECT matricula FROM "core"."usuarios" WHERE id = ${usuarioId} LIMIT 1`,
    );
    const matricula = (linhas[0]?.matricula ?? '').trim();
    return matricula || null;
  }

  /**
   * Busca por MATRÍCULA apenas — sem filial. A filial existe na chave composta
   * do banco como rede de proteção contra dado conflitante, mas a aplicação não
   * pede filial a ninguém: para o RH, matrícula identifica a pessoa.
   */
  async porMatricula(matricula: string): Promise<ColaboradorResumo | null> {
    /**
     * ⚠️ Busca por TODAS as formas da chapa, não só pela digitada (08/09).
     *
     * O Protheus identifica como `E01981`; `rh.colaborador` guarda `001981`. O
     * match exato transformava essa diferença num **403 que parece falta de
     * permissão** — a pessoa loga, tem o papel certo, e é mandada de volta ao
     * Configurador para receber o que já tem. Ver `common/chapa.ts`.
     *
     * ⚠️ Isto é a REDE. A fonte foi fechada no Configurador no mesmo dia, mas
     * dado legado continua na base (`marcelojunio` = `E03942`, conta ativa).
     */
    const candidatas = chapasEquivalentes(matricula);
    if (candidatas.length === 0) return null;
    const alvo = candidatas[0];
    const encontrados = (await this.prisma.colaborador.findMany({
      // O `in` sai de SITUACOES_ELEGIVEIS — a definição única de "ativo"
      // (common/elegibilidade.ts). Não escrever o filtro à mão aqui.
      where: {
        matricula: { in: candidatas },
        situacao: { in: SITUACOES_ELEGIVEIS as unknown as $Enums.SituacaoColaborador[] },
      },
      select: { id: true, filial: true, matricula: true, nome: true, situacao: true },
      orderBy: { filial: 'asc' },
    })) as unknown as ColaboradorResumo[];

    try {
      return escolherColaboradorUnico(encontrados, alvo);
    } catch (e) {
      // Sobe para o chamador, mas registra aqui: quem lê o log precisa ver as
      // filiais envolvidas para achar a linha errada no Protheus.
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /**
   * O colaborador de quem está logado. Lança 403 quando não dá para resolver —
   * falha fechada, sempre.
   */
  async colaboradorDoUsuario(usuarioId: string): Promise<ColaboradorResumo> {
    const matricula = await this.matriculaDoUsuario(usuarioId);
    if (!matricula) {
      this.logger.warn(`Usuário ${usuarioId} sem matrícula em core.usuarios — acesso negado.`);
      throw new ForbiddenException(
        'Seu usuário não tem matrícula cadastrada, e sem ela o sistema não consegue ' +
          'identificar você como colaborador. Peça ao Configurador para preencher a matrícula.',
      );
    }

    const colaborador = await this.porMatricula(matricula);
    if (!colaborador) {
      this.logger.warn(
        `Usuário ${usuarioId} tem matrícula ${matricula}, que não corresponde a nenhum colaborador ativo.`,
      );
      throw new ForbiddenException(
        `A matrícula ${matricula} do seu usuário não corresponde a nenhum colaborador ativo. ` +
          'Verifique o cadastro ou rode a sincronização com o Protheus.',
      );
    }
    return colaborador;
  }

  /**
   * ⭐⭐ QUEM DESSAS PESSOAS CONSEGUIRIA ENTRAR PARA RESPONDER.
   *
   * O caminho inverso do `colaboradorDoUsuario`: dali se vai do usuário logado
   * ao colaborador; aqui se vai do colaborador ao usuário, para responder
   * **antes de abrir o ciclo** se as designações têm dono capaz de cumpri-las.
   *
   * ⚠️ Uma consulta para o lote inteiro, não uma por avaliador — o painel do
   * ciclo do Piloto tem 54 e a fila é montada a cada abertura da tela.
   *
   * ⚠️ **A regra da chapa NÃO é reescrita em SQL.** As formas possíveis saem de
   * `chapasEquivalentes` (TypeScript) e entram como parâmetro; o `WHERE` só
   * compara. Duplicar a normalização no SQL criaria a segunda cópia que
   * envelhece errada — e esta regra já custou um 403 que parecia falta de
   * permissão.
   *
   * `core` é read-only aqui, como no resto do módulo: `$queryRaw`, sem escrita,
   * sem FK, sem acoplamento ao Configurador além da leitura que já existia.
   */
  async acessoDeAvaliadores(
    matriculas: readonly string[],
  ): Promise<Map<string, { acesso: AcessoDoAvaliador; motivo: string | null; username: string | null }>> {
    const resultado = new Map<
      string,
      { acesso: AcessoDoAvaliador; motivo: string | null; username: string | null }
    >();
    if (matriculas.length === 0) return resultado;

    /** Todas as formas de todas as chapas — a busca é por elas, em um `IN` só. */
    const candidatas = [...new Set(matriculas.flatMap((m) => chapasEquivalentes(m)))];
    if (candidatas.length === 0) return resultado;

    // ⚠️ `${MODULO}`, e não o código escrito à mão: o dono do nome do módulo é
    // `common/roles-rh.ts`, e SQL cru é justamente onde a cópia envelhece sem
    // aviso — nada quebra, a consulta só passa a contar zero permissão e todo
    // avaliador vira "sem acesso". Dentro de `Prisma.sql` ele vai como
    // PARÂMETRO, não como texto concatenado.
    const contas = await this.prisma.$queryRaw<
      { matricula: string; usuario_id: string; username: string; status_conta: string; permissoes: bigint }[]
    >(Prisma.sql`
      SELECT upper(trim(u.matricula)) AS matricula,
             u.id   AS usuario_id,
             u.username,
             u.status::text AS status_conta,
             (SELECT count(*) FROM "core"."permissoes_modulo" p
                JOIN "core"."modulos_sistema" m ON m.id = p.modulo_id
              WHERE p.usuario_id = u.id
                AND m.codigo = ${MODULO}
                AND p.status::text = 'ATIVO') AS permissoes
        FROM "core"."usuarios" u
       WHERE upper(trim(u.matricula)) IN (${Prisma.join(candidatas)})
    `);

    const porChapa = new Map<string, ContaEncontrada>();
    for (const c of contas) {
      porChapa.set(c.matricula, {
        usuarioId: c.usuario_id,
        username: c.username,
        statusConta: c.status_conta,
        permissoesNoModulo: Number(c.permissoes),
      });
    }

    for (const matricula of matriculas) {
      // A conta pode estar gravada em qualquer uma das formas — procura por
      // todas, como a busca de colaborador faz.
      const conta =
        chapasEquivalentes(matricula)
          .map((forma) => porChapa.get(forma))
          .find((c): c is ContaEncontrada => c !== undefined) ?? null;
      const acesso = classificarAcesso(conta);
      resultado.set(matricula, {
        acesso,
        motivo: motivoDoAcesso(acesso),
        username: conta?.username ?? null,
      });
    }
    return resultado;
  }
}
