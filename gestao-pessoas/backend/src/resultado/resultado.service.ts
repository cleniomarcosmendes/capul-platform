/**
 * RESULTADOS — a nota final, e a conta que chegou nela.
 *
 * ⭐ MEMÓRIA DE CÁLCULO. Uma nota sem a conta é um número que ninguém consegue
 * defender numa conversa com o avaliado. Por isso o detalhe mostra, lado a
 * lado: a nota do questionário (com a quebra por grupo, calculada na leitura —
 * ADR-RH-02), cada critério cadastral com o valor bruto que veio do cadastro, a
 * faixa em que caiu, a pontuação e o peso aplicado — e diz quando houve
 * RENORMALIZAÇÃO, que é o caso em que o peso de um critério sem dado foi
 * redistribuído entre os demais.
 *
 * ⭐ APLICAÇÃO ao lado da nota (decisão do RH, 05/09): a régua de conceitos é do
 * ciclo, mas o instrumento é da aplicação. Sem dizer qual questionário a pessoa
 * respondeu, comparar "BOM" de um aprendiz com "BOM" de um supervisor sugere
 * uma equivalência que não existe.
 *
 * ⚠️ Ler o PRÓPRIO resultado não é ato sobre ele. A separação de funções barra
 * abrir, editar, reabrir e recalcular a própria avaliação
 * (`avaliacao/separacao-funcoes.ts`) — atos que MUDAM o registro. A linha da
 * pessoa aparece marcada, como manda a regra de nunca filtrar em silêncio, e
 * abre: esconder de alguém o próprio número não protege nada, e faria o total
 * da lista não fechar.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AvaliacaoService } from '../avaliacao/avaliacao.service.js';
import { ehProprioAvaliado, marcarRestricoes } from '../avaliacao/separacao-funcoes.js';
import {
  celula,
  celulaData,
  celulaMatricula,
  celulaNumero,
  montarCsv,
  nomeDoArquivo,
} from './csv.js';

export interface LinhaDeResultado {
  id: string;
  avaliacaoId: string;
  avaliadoId: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  centroCusto: string | null;
  filial: string | null;
  aplicacao: string;
  notaAvaliacao: number;
  notaCriterios: number | null;
  notaFinal: number;
  conceito: string | null;
  houveRenormalizacao: boolean;
  calculadoEm: Date;
  /** true quando é o resultado de quem está olhando — marcado, nunca oculto. */
  restrita?: boolean;
  motivoRestricao?: string;
}

@Injectable()
export class ResultadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avaliacoes: AvaliacaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * ⭐⭐ A PLANILHA DA REUNIÃO — resultados apurados, uma linha por pessoa.
   *
   * ⚠️ **A memória de cálculo NÃO vai junto, de propósito.** Ela mostra o valor
   * bruto de cada critério (grau de instrução, tempo de casa, cursos) — dado
   * pessoal que a nota final não expõe. Sair por padrão numa planilha que vai
   * circular por e-mail é decidir por omissão o que é decisão do RH. Se ela
   * quiser, pede — e aí é escolha registrada, não descuido.
   *
   * ⚠️ E **não** traz a linha de quem está gerando: a separação de funções vale
   * aqui como vale na tela. A pessoa aparece marcada na TELA (nunca filtrada,
   * para o total fechar), mas um arquivo que sai do sistema com a própria nota
   * dentro é outro ato.
   */
  async csvDoCiclo(cicloId: string, colaboradorId: string | null) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { nome: true },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const linhas = await this.doCiclo(cicloId, colaboradorId);
    const avaliadores = await this.avaliadoresDe(linhas.map((l) => l.avaliacaoId));

    const cabecalho = [
      'Matrícula', 'Nome', 'Filial', 'Centro de custo', 'Cargo', 'Aplicação',
      'Avaliador', 'Nota do questionário', 'Nota dos critérios', 'Nota final',
      'Conceito', 'Enviada em', 'Apurada em',
    ];

    const corpo = linhas
      // ⚠️ A própria linha sai do ARQUIVO — ver a nota do método.
      .filter((l) => !l.restrita)
      .map((l) => [
        celulaMatricula(l.matricula),
        celula(l.nome),
        celula(l.filial),
        celula(l.centroCusto),
        celula(l.cargo),
        celula(l.aplicacao),
        celula(avaliadores.get(l.avaliacaoId)?.nome ?? null),
        celulaNumero(l.notaAvaliacao),
        celulaNumero(l.notaCriterios),
        celulaNumero(l.notaFinal),
        celula(l.conceito),
        celulaData(avaliadores.get(l.avaliacaoId)?.enviadaEm ?? null),
        celulaData(l.calculadoEm),
      ]);

    return {
      nome: nomeDoArquivo('resultados', ciclo.nome),
      csv: montarCsv(cabecalho, corpo),
      linhas: corpo.length,
    };
  }

  /**
   * ⭐⭐ A LISTA DAS CANCELADAS — a que responde "por que fulano não tem nota".
   *
   * É a pergunta que aparece na reunião, e a planilha de resultados não pode
   * respondê-la: quem foi cancelado **não tem resultado**, então não existe
   * linha lá. Sem este arquivo, a ausência da pessoa na planilha é lida como
   * esquecimento — e o motivo, que está gravado em cada avaliação desde 08/09,
   * continuaria só no banco.
   *
   * ⚠️ Arquivo SEPARADO, e não uma seção no outro: são fatos de naturezas
   * diferentes (quem tem nota × quem não tem e por quê), com colunas diferentes.
   * Misturar faria a contagem de linhas do arquivo não significar nada.
   */
  async csvDeCanceladas(cicloId: string, colaboradorId: string | null) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { nome: true },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const canceladas = await this.prisma.avaliacao.findMany({
      /**
       * ⚠️ A LINHA DE QUEM ESTÁ GERANDO fica fora — a mesma razão do arquivo de
       * resultados: na TELA a própria linha aparece marcada (para o total
       * fechar), mas um arquivo que sai do sistema com a própria avaliação
       * dentro é outro ato, e este circula por e-mail.
       */
      where: {
        cicloId,
        status: 'CANCELADA',
        ...(colaboradorId ? { avaliadoId: { not: colaboradorId } } : {}),
      },
      orderBy: { canceladaEm: 'desc' },
      select: {
        avaliadoId: true,
        avaliadorId: true,
        filialSnapshot: true,
        centroCustoSnapshot: true,
        cargoSnapshot: true,
        canceladaEm: true,
        motivoCancelamento: true,
        aplicacao: { select: { nome: true } },
        _count: { select: { respostas: true } },
      },
    });

    const ids = [...new Set(canceladas.flatMap((c) => [c.avaliadoId, c.avaliadorId]))];
    const gente = await this.prisma.colaborador.findMany({
      where: { id: { in: ids } },
      select: { id: true, nome: true, matricula: true },
    });
    const porId = new Map(gente.map((g) => [g.id, g]));

    const cabecalho = [
      'Matrícula', 'Nome', 'Filial', 'Centro de custo', 'Cargo', 'Aplicação',
      'Estava com', 'Respostas já dadas', 'Cancelada em', 'Motivo',
    ];

    const corpo = canceladas.map((c) => [
      celulaMatricula(porId.get(c.avaliadoId)?.matricula),
      celula(porId.get(c.avaliadoId)?.nome ?? '(colaborador não encontrado)'),
      celula(c.filialSnapshot),
      celula(c.centroCustoSnapshot),
      celula(c.cargoSnapshot),
      celula(c.aplicacao.nome),
      celula(porId.get(c.avaliadorId)?.nome ?? null),
      // O número das parciais: as respostas ficam registradas e fora da
      // apuração, e é isto que a planilha diz sem precisar de nota de rodapé.
      celulaNumero(c._count.respostas, 0),
      celulaData(c.canceladaEm),
      celula(c.motivoCancelamento),
    ]);

    return {
      nome: nomeDoArquivo('canceladas', ciclo.nome),
      csv: montarCsv(cabecalho, corpo),
      linhas: corpo.length,
    };
  }

  /** Quem enviou cada avaliação, e quando — o CSV precisa dos dois. */
  private async avaliadoresDe(avaliacaoIds: string[]) {
    if (avaliacaoIds.length === 0) return new Map<string, { nome: string; enviadaEm: Date | null }>();
    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: { id: { in: avaliacaoIds } },
      select: { id: true, avaliadorId: true, enviadaEm: true },
    });
    const nomes = await this.prisma.colaborador.findMany({
      where: { id: { in: avaliacoes.map((a) => a.avaliadorId) } },
      select: { id: true, nome: true },
    });
    const porId = new Map(nomes.map((n) => [n.id, n.nome]));
    return new Map(
      avaliacoes.map((a) => [a.id, { nome: porId.get(a.avaliadorId) ?? '', enviadaEm: a.enviadaEm }]),
    );
  }

  async doCiclo(cicloId: string, colaboradorId: string | null): Promise<LinhaDeResultado[]> {
    const linhas = await this.prisma.resultadoAvaliacao.findMany({
      where: { cicloId },
      orderBy: { notaFinal: 'desc' },
      include: {
        avaliacao: {
          select: {
            id: true,
            avaliadoId: true,
            cargoSnapshot: true,
            centroCustoSnapshot: true,
            filialSnapshot: true,
            aplicacao: { select: { nome: true } },
          },
        },
      },
    });
    if (linhas.length === 0) return [];

    const pessoas = await this.prisma.colaborador.findMany({
      where: { id: { in: linhas.map((l) => l.colaboradorId) } },
      select: { id: true, nome: true, matricula: true, cargoDescricao: true },
    });
    const porId = new Map(pessoas.map((p) => [p.id, p]));

    const resultado: LinhaDeResultado[] = linhas.map((l) => ({
      id: l.id,
      avaliacaoId: l.avaliacaoId,
      avaliadoId: l.avaliacao.avaliadoId,
      nome: porId.get(l.colaboradorId)?.nome ?? '(colaborador não encontrado)',
      matricula: porId.get(l.colaboradorId)?.matricula ?? '',
      cargo: l.avaliacao.cargoSnapshot ?? porId.get(l.colaboradorId)?.cargoDescricao ?? null,
      centroCusto: l.avaliacao.centroCustoSnapshot,
      filial: l.avaliacao.filialSnapshot,
      aplicacao: l.avaliacao.aplicacao.nome,
      notaAvaliacao: Number(l.notaAvaliacao),
      notaCriterios: l.notaCriterios === null ? null : Number(l.notaCriterios),
      notaFinal: Number(l.notaFinal),
      conceito: l.conceitoDescricao,
      houveRenormalizacao: l.houveRenormalizacao,
      calculadoEm: l.calculadoEm,
    }));

    // Sem colaborador resolvido (RH que não é funcionário) ninguém tem linha
    // própria para marcar — e a lista sai inteira, como deve.
    return colaboradorId ? marcarRestricoes(resultado, colaboradorId) : resultado;
  }

  /** Memória de cálculo de um resultado. */
  /**
   * ⭐ A memória de cálculo é o registro individual mais completo do módulo:
   * traz a nota, o conceito, a quebra por grupo, o NOME de quem avaliou e a
   * OBSERVAÇÃO que o avaliador escreveu sobre a pessoa.
   *
   * A especificação §8 já decidiu que ler isso é permitido a quem não é o
   * avaliador designado — e, na mesma frase, que esse acesso é de **registro
   * obrigatório em `rh.auditoria`**. Sem a trilha, a decisão vira "qualquer
   * RH_ADMIN lê a opinião escrita sobre qualquer pessoa e não fica rastro" —
   * que não é o que está escrito em lugar nenhum.
   *
   * ⚠️ Não bloqueia: ler o PRÓPRIO resultado é explicitamente permitido (§3.1 —
   * a separação de funções barra o que MUDA o registro), e o RH precisa ler o
   * dos outros para apurar e para responder contestação. O que faltava era o
   * rastro, não a permissão.
   */
  async memoria(resultadoId: string, contexto?: { colaboradorId: string | null; usuarioId: string; ip?: string }) {
    const r = await this.prisma.resultadoAvaliacao.findUnique({
      where: { id: resultadoId },
      include: {
        criterios: true,
        ciclo: { select: { nome: true, dataBase: true } },
        avaliacao: {
          select: {
            id: true,
            avaliadoId: true,
            enviadaEm: true,
            observacaoAvaliador: true,
            avaliadorId: true,
            cargoSnapshot: true,
            centroCustoSnapshot: true,
            aplicacao: { select: { nome: true, pesoAvaliacao: true } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Resultado não encontrado.');

    // Quem é o avaliador designado lê sem rastro — é o trabalho dele. Todo o
    // resto entra na trilha, com quem leu o quê e quando.
    if (contexto && contexto.colaboradorId !== r.avaliacao.avaliadorId) {
      await this.auditoria.registrar({
        entidade: 'ResultadoAvaliacao',
        entidadeId: resultadoId,
        acao: 'LER_RESULTADO_INDIVIDUAL',
        usuarioId: contexto.usuarioId,
        valorNovo: {
          avaliadoId: r.avaliacao.avaliadoId,
          /**
           * ⚠️ `ehProprioAvaliado(...)` e NÃO `contexto.colaboradorId === …`.
           * Parecem a mesma pergunta e não são: `colaboradorId` é
           * `string | null`, e com os DOIS lados nulos o `===` responde
           * **true** — gravaria `proprioResultado: true` no acesso de quem não é
           * o avaliado, numa linha de auditoria que alguém vai ler meses depois
           * como prova. A função recusa afirmar sem id.
           *
           * Hoje isto não chega a acontecer aqui, e é justamente o incômodo: só
           * não acontece porque `avaliacao.avaliado_id` é `NOT NULL` no schema
           * — uma garantia de outra camada, que um `select` novo ou um id
           * opcional derruba sem passar por este arquivo. O acerto é a linha
           * afirmar o fato por si. Quem "simplificar" de volta para `===` volta
           * a depender do acidente.
           */
          proprioResultado: ehProprioAvaliado(contexto.colaboradorId, r.avaliacao.avaliadoId),
          leuObservacaoDoAvaliador: Boolean(r.avaliacao.observacaoAvaliador),
        },
        ip: contexto.ip,
      });
    }

    // ⭐ RÓTULO ao lado do código. `valorBruto = 45` é o código de grau de
    // instrução do Protheus, e 0.5914 é ano em decimal: nenhum dos dois se
    // defende numa conversa com o avaliado. A faixa em que o valor caiu já foi
    // gravada (`faixaId`) — falta só trazer o texto dela e a unidade do
    // critério, que é o que separa RÓTULO de PONTUAÇÃO.
    const [criteriosDoCatalogo, faixas] = await Promise.all([
      this.prisma.criterio.findMany({
        where: { id: { in: r.criterios.map((c) => c.criterioId) } },
        select: { id: true, unidade: true, tipoValor: true },
      }),
      this.prisma.criterioFaixa.findMany({
        where: { id: { in: r.criterios.map((c) => c.faixaId).filter((x): x is string => !!x) } },
        select: { id: true, rotulo: true },
      }),
    ]);
    const catalogoPorId = new Map(criteriosDoCatalogo.map((c) => [c.id, c]));
    const rotuloPorFaixa = new Map(faixas.map((f) => [f.id, f.rotulo]));

    const [avaliado, avaliador] = await Promise.all([
      this.prisma.colaborador.findUnique({
        where: { id: r.colaboradorId },
        select: { nome: true, matricula: true, cargoDescricao: true },
      }),
      this.prisma.colaborador.findUnique({
        where: { id: r.avaliacao.avaliadorId },
        select: { nome: true, matricula: true },
      }),
    ]);

    return {
      id: r.id,
      ciclo: { nome: r.ciclo.nome, dataBase: r.ciclo.dataBase },
      aplicacao: r.avaliacao.aplicacao.nome,
      avaliado: {
        nome: avaliado?.nome ?? '',
        matricula: avaliado?.matricula ?? '',
        cargo: r.avaliacao.cargoSnapshot ?? avaliado?.cargoDescricao ?? null,
        centroCusto: r.avaliacao.centroCustoSnapshot,
      },
      avaliador: { nome: avaliador?.nome ?? '', matricula: avaliador?.matricula ?? '' },
      enviadaEm: r.avaliacao.enviadaEm,
      observacaoAvaliador: r.avaliacao.observacaoAvaliador,
      notaAvaliacao: Number(r.notaAvaliacao),
      pesoAvaliacao: Number(r.pesoAvaliacao),
      notaCriterios: r.notaCriterios === null ? null : Number(r.notaCriterios),
      notaFinal: Number(r.notaFinal),
      conceito: r.conceitoDescricao,
      houveRenormalizacao: r.houveRenormalizacao,
      calculadoEm: r.calculadoEm,
      // A quebra do questionário é calculada agora, sobre as respostas gravadas.
      porGrupo: await this.avaliacoes.notaPorGrupoDa(r.avaliacaoId),
      criterios: r.criterios.map((c) => ({
        criterioId: c.criterioId,
        nome: c.criterioNome,
        valorBruto: c.valorBruto === null ? null : Number(c.valorBruto),
        valorTexto: c.valorTexto,
        /** Texto da faixa — "Superior completo", "de 5 a 10 anos". */
        faixaRotulo: c.faixaId ? (rotuloPorFaixa.get(c.faixaId) ?? null) : null,
        unidade: catalogoPorId.get(c.criterioId)?.unidade ?? null,
        tipoValor: catalogoPorId.get(c.criterioId)?.tipoValor ?? null,
        pontuacao: c.pontuacao === null ? null : Number(c.pontuacao),
        peso: Number(c.pesoAplicado),
        semDado: c.semDado,
      })),
    };
  }
}
