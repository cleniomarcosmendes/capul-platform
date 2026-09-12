/**
 * PAINEL — o acompanhamento do ciclo enquanto ele corre.
 *
 * A pergunta que esta tela responde é sempre a mesma: **o que falta para o
 * ciclo fechar?** Por isso ela não mostra médias nem gráficos de nota (isso é
 * Resultados) e sim três coisas, nesta ordem:
 *
 *   1. quanto falta, por aplicação;
 *   2. QUANTAS faltam por avaliador — a fila por avaliador, da maior pendência
 *      para a menor, porque quem cobra precisa de nome, não de percentual.
 *      ⚠️ É uma CONTAGEM, não um veredito: quem não respondeu pode ter mil
 *      motivos, e esta lista é lida imediatamente antes de alguém ser cobrado;
 *   3. quem é elegível e ficou SEM designação — a única pendência que não
 *      aparece em lugar nenhum e faz a pessoa sumir do ciclo em silêncio;
 *   4. quem ficou FORA DE TODAS as aplicações.
 *
 * ⭐ Os itens 3 e 4 são a razão de o painel existir cedo, e são pendências
 * DIFERENTES, uma dentro da outra:
 *
 *   sem designação  — está no público de uma aplicação e ninguém disse quem
 *                     avalia. `Avaliacao` só nasce na designação, então a
 *                     pessoa não tem linha, não tem status e não entra em
 *                     contagem nenhuma.
 *   fora de todas   — não está no público de aplicação alguma. Nem sequer
 *                     chega a ser contada como "sem designação", porque o
 *                     item 3 é calculado POR APLICAÇÃO e ela não pertence a
 *                     nenhuma. É a pessoa que o ciclo inteiro não enxerga.
 *
 * ⚠️ Enquanto o público vinha do recorte por centro de custo, o item 4 era
 * invisível do mesmo jeito: um CC fora de todas as aplicações simplesmente não
 * aparecia. Com público nominal a conta passou a ser possível — e ela é de
 * nível de CICLO, não de aplicação.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DesignacaoService } from '../designacao/designacao.service.js';
import { montarListaInicial } from '../designacao/elegibilidade-ciclo.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { STATUS_VIVOS } from '../avaliacao/cancelamento.js';
import { ACAO_FALTA_GENTE, ACAO_NAO_E_MINHA_EQUIPE } from '../avaliacao/contestacao.js';
import { proximoPasso, type ProximoPasso } from './proximo-passo.js';
import { CicloService } from '../ciclo/ciclo.service.js';
import { IdentidadeService } from '../identidade/identidade.service.js';
import type { AcessoDoAvaliador } from '../identidade/acesso-do-avaliador.js';
import {
  ONDE_A_AVALIACAO_CONTA,
  somarQueContam,
} from '../avaliacao/avaliacoes-que-contam.js';

export interface ProgressoDaAplicacao {
  aplicacaoId: string;
  nome: string;
  designados: number;
  enviadas: number;
  emAndamento: number;
  pendentes: number;
  canceladas: number;
  /** Elegíveis da régua que ninguém designou — não têm avaliação nenhuma. */
  semDesignacao: number;
}

export interface FilaDoAvaliador {
  avaliadorId: string;
  nome: string;
  matricula: string;
  total: number;
  enviadas: number;
  aFazer: number;
  /**
   * ⭐⭐ Se esta pessoa CONSEGUE entrar para responder. Designar não dá acesso, e
   * a fila mostrava quem não tem conta igual a quem tem — ver
   * `identidade/acesso-do-avaliador.ts`.
   */
  acesso: AcessoDoAvaliador;
  /** Frase pronta quando `acesso !== 'OK'`. */
  motivoDoAcesso: string | null;
}

/** Uma pessoa que o ciclo não enxerga: elegível e fora de toda aplicação. */
export interface PessoaForaDoCiclo {
  colaboradorId: string;
  matricula: string;
  nome: string;
  filial: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
}

export interface PainelDoCiclo {
  ciclo: {
    id: string;
    nome: string;
    status: string;
    periodoInicio: Date;
    periodoFim: Date;
    dataBase: Date;
  };
  designados: number;
  enviadas: number;
  aFazer: number;
  semDesignacao: number;
  /**
   * ⭐ DE ONDE VEM o "sem designação" — sem isto o número convida a uma
   * subtração errada.
   *
   * O cadastro de avaliadores tem o SEU "sem avaliador" (a empresa inteira) e o
   * painel tem o dele (este ciclo). Os dois universos **não se contêm**: fechar
   * os 95 do ciclo não derruba 95 dos 108 do cadastro. Em vez de avisar que a
   * conta é sutil, o painel mostra a conta:
   *
   *   `jaTemNoCadastro`  → basta copiar o cadastro para o ciclo (um botão);
   *   `nemNoCadastro`    → precisa resolver no cadastro primeiro.
   */
  semDesignacaoPorOrigem: { jaTemNoCadastro: number; nemNoCadastro: number };
  /**
   * Elegíveis do ciclo que não estão no público de NENHUMA aplicação. Vem com
   * os nomes, não só o total: quem vai resolver precisa saber de quem se trata,
   * e "17 pessoas fora" não diz a ninguém o que fazer em seguida.
   */
  foraDeTodasAsAplicacoes: { total: number; pessoas: PessoaForaDoCiclo[] };
  aplicacoes: ProgressoDaAplicacao[];
  avaliadores: FilaDoAvaliador[];
}

/** O que a linha de estado do cabeçalho do ciclo mostra. */
/**
 * ⭐⭐ O RESUMO É UM RELATÓRIO, NÃO UMA CÓPIA DO CICLO (08/09).
 *
 * Ele mandava `status` e `encerradoEm` — **dois fatos que a linha `rh.ciclo`
 * grava e `GET /ciclos/:id` já entrega**. A tela do ciclo carregava os dois
 * endpoints e lia o mesmo fato de fontes diferentes: a etiqueta do topo pelo
 * ciclo, as faixas pelo resumo. Enquanto os dois eram buscados no mesmo
 * `useEffect` ninguém via; bastaria recarregar um só para a tela passar a
 * mostrar "ABERTO" na etiqueta com a faixa de RASCUNHO embaixo.
 *
 * ⚠️ **O critério de quem sobrevive é o DONO NATURAL do fato**, não a
 * conveniência de quem consome:
 *   - atributo gravado na linha do ciclo (status, datas, período, data-base)
 *     → dono é o **registro**, `GET /ciclos/:id`;
 *   - contagem e derivação que não existem na linha e são apuradas agora
 *     (público, designados, enviadas, apuradas, próximo passo, pendências,
 *     reaberturas vindas da auditoria) → dono é **este relatório**.
 *
 * `status` continua entrando no cálculo aqui dentro — `proximoPasso` e
 * `pendenciasParaAbrir` derivam dele. O que ele não faz mais é **atravessar o
 * contrato**: quem decide pelo status, decide pelo dono dele.
 */
export interface ResumoDoCiclo {
  aplicacoes: number;
  /**
   * ⭐⭐ TODAS as linhas de público montadas — inclusive as que o RH já tirou do
   * ciclo. É o número de MONTAGEM, e é o mesmo dos chips "Todos (N)" da
   * Designação.
   */
  noPublico: number;
  /**
   * ⭐ Pessoas que entraram no público e **nunca tiveram avaliação criada**.
   *
   * ⚠️ Não é "fora do ciclo" (essas a régua excluiu) nem "sem avaliador"
   * (essas têm avaliação e falta quem responda) — as duas palavras já
   * significam outra coisa neste módulo, e a varredura de 10/09 achou dois
   * "fora" com sentidos diferentes em abas vizinhas. É o termo que faltava
   * entre `noPublico` (54) e as avaliações que existem (52).
   */
  noPublicoSemAvaliacao: number;
  /**
   * Das canceladas: as que o **"Devolver canceladas"** alcança (origem
   * `ENCERRAMENTO`).
   *
   * ⭐⭐ A REGRA DO RÓTULO, e vale para todo par deste tipo: **origem e caminho
   * de recuperação no mesmo rótulo**. Foi o que faltou quando o "Excluir"
   * produzia "cancelada" e ninguém sabia desfazer — o estado estava na tela e
   * a saída não.
   */
  canceladasPeloEncerramento: number;
  /** Das canceladas: as que voltam por **Designação › Incluir** (`DECISAO_RH`). */
  excluidasPeloRh: number;
  /**
   * ⭐⭐ O TERMO QUE FALTAVA. `noPublico` responde "quanto foi montado" e os
   * números seguintes respondem "quem o ciclo ainda alcança" — dois registros
   * diferentes na mesma linha. Sem este campo a conta não fechava na tela:
   * 894 designados + 95 sem avaliador não dão os 1036 do público, porque 47
   * tinham sido tirados do ciclo e nada dizia isso.
   *
   * ⚠️ A saída NÃO é trocar `noPublico` por 989: isso apagaria da tela a
   * existência dos excluídos, que é uma decisão que alguém tomou e registrou.
   * Mostram-se os dois, com o termo intermediário à vista.
   */
  foraDoCiclo: number;
  designados: number;
  /**
   * ⭐⭐ QUANTAS FORAM CANCELADAS. Sem este termo, um ciclo encerrado com
   * pendência lê como sucesso: as canceladas saem do denominador (é o certo —
   * §3.1.38), então "13 de 13 enviadas" aparece como **100%** enquanto 39
   * pessoas foram canceladas para chegar lá. Dois números verdadeiros, mesma
   * linha, sem o termo que os concilia — a terceira vez (52×50, peso 60×100%).
   *
   * ⚠️ O comentário do `encerrar` promete que *"o painel mostra a contagem de
   * canceladas, que é onde o custo do override fica à vista"*. O cartão da
   * aplicação mostrava; **a linha de estado do ciclo, não** — e é ela que se lê
   * primeiro.
   */
  canceladas: number;
  semDesignacao: number;
  enviadas: number;
  aFazer: number;
  apuradas: number;
  /** `null` quando não há passo óbvio — a tela não mostra nada. Ver a regra. */
  proximoPasso: ProximoPasso | null;
  /**
   * ⭐ O que falta para ABRIR — só em RASCUNHO (`null` nos outros estados).
   * Vem da MESMA função que a abertura usa (`problemasParaAbrir`): lista vazia
   * significa que o clique passa, e é a mesma conta que a API vai fazer.
   */
  pendenciasParaAbrir: string[] | null;
  /**
   * ⭐ Reaberturas do ciclo. `reaberturas` conta TODAS (vem da auditoria); a
   * tabela só guarda a última. Um ciclo reaberto duas vezes é informação.
   */
  reaberturas: number;
  ultimaReabertura: { em: Date; por: string | null; motivo: string | null } | null;
}

@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly designacao: DesignacaoService,
    private readonly ciclos: CicloService,
    private readonly identidade: IdentidadeService,
  ) {}

  async doCiclo(cicloId: string): Promise<PainelDoCiclo> {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const porAplicacaoEStatus = await this.prisma.avaliacao.groupBy({
      by: ['aplicacaoId', 'status'],
      where: { cicloId },
      _count: { _all: true },
    });

    const aplicacoes: ProgressoDaAplicacao[] = [];
    /** Quem ficou sem designação, para dizer DE ONDE isso vem (ver o tipo). */
    const semDesignacaoIds = new Set<string>();
    for (const a of ciclo.aplicacoes) {
      const linhas = porAplicacaoEStatus.filter((l) => l.aplicacaoId === a.id);
      const conta = (s: string) => linhas.find((l) => l.status === s)?._count._all ?? 0;
      // ⭐ Cancelada fora do denominador — a mesma regra da prévia da abertura e
      // da fila por avaliador, agora de um lugar só (§A6).
      const designados = somarQueContam(linhas);

      // A lista de elegibilidade é a mesma da tela de Designação — de propósito.
      // Duas contas de "quem deveria estar no ciclo" divergem no primeiro ajuste
      // manual, e aí o painel diz que falta gente que já foi resolvida.
      const elegiveis = (await this.designacao.listar(a.id)).filter((l) => l.elegivel);
      // groupBy e não findMany de propósito: o painel precisa saber QUEM já tem
      // avaliação, nunca o que há dentro dela. Consulta agregada deixa isso
      // explícito para o invariante e para quem ler depois.
      const comAvaliacao = new Set(
        (
          await this.prisma.avaliacao.groupBy({
            by: ['avaliadoId'],
            where: { aplicacaoId: a.id },
          })
        ).map((x) => x.avaliadoId),
      );

      aplicacoes.push({
        aplicacaoId: a.id,
        nome: a.nome,
        designados,
        enviadas: conta('ENVIADA'),
        emAndamento: conta('EM_ANDAMENTO'),
        pendentes: conta('PENDENTE'),
        canceladas: conta('CANCELADA'),
        semDesignacao: elegiveis.filter((e) => !comAvaliacao.has(e.colaboradorId)).length,
      });
      for (const e of elegiveis) {
        if (!comAvaliacao.has(e.colaboradorId)) semDesignacaoIds.add(e.colaboradorId);
      }
    }

    return {
      ciclo: {
        id: ciclo.id,
        nome: ciclo.nome,
        status: ciclo.status,
        periodoInicio: ciclo.periodoInicio,
        periodoFim: ciclo.periodoFim,
        dataBase: ciclo.dataBase,
      },
      designados: aplicacoes.reduce((t, a) => t + a.designados, 0),
      enviadas: aplicacoes.reduce((t, a) => t + a.enviadas, 0),
      aFazer: aplicacoes.reduce((t, a) => t + a.pendentes + a.emAndamento, 0),
      semDesignacao: aplicacoes.reduce((t, a) => t + a.semDesignacao, 0),
      semDesignacaoPorOrigem: await this.semDesignacaoPorOrigem(semDesignacaoIds),
      foraDeTodasAsAplicacoes: await this.foraDeTodasAsAplicacoes(ciclo),
      aplicacoes,
      avaliadores: await this.filaPorAvaliador(cicloId),
    };
  }

  /**
   * ⭐ O RESUMO — o que a LINHA DE ESTADO do cabeçalho do ciclo mostra, e o
   * próximo passo derivado dele.
   *
   * É irmão do `doCiclo`, e de propósito **não** faz as duas partes caras dele:
   * a varredura de quem está fora de todas as aplicações (percorre as 1.036
   * pessoas) e a fila por avaliador. O cabeçalho aparece em TODAS as abas do
   * ciclo — o que ele custa, custa quatro vezes.
   *
   * ⚠️ `semDesignacao` sai da MESMA régua da tela de Designação (via
   * `designacao.listar`), não de uma conta paralela: `noPublico - designados`
   * seria mais barato e daria número diferente, porque ignora quem o RH excluiu
   * e quem a régua tirou. Duas contas de "quem falta" divergem no primeiro
   * ajuste manual — e o cabeçalho é onde o número é lido primeiro.
   */
  /**
   * ⭐⭐ O QUE A ABERTURA VAI FAZER — lido ANTES do aviso de irreversibilidade.
   *
   * Item I do roteiro. A confirmação do Abrir não dizia número nenhum, e a
   * validação rodava **depois** do aviso: a pessoa encarava "não tem volta",
   * confirmava, e só então recebia *"o ciclo não tem nenhuma aplicação"*.
   *
   * ⚠️ **Os números vêm daqui, das MESMAS funções que decidem** — `listar()` da
   * designação (que aplica a régua do ciclo) e `problemasParaAbrir` (que a API
   * roda no clique). Se o diálogo contasse sozinho, divergiria no primeiro caso
   * de borda, e o caso de borda aqui é **a régua barrando alguém do público**:
   * a pessoa está na lista, aparece no total, e não vai gerar avaliação.
   *
   * ⚠️ E o número que importa **não é "quantas avaliações vão nascer": abrir não
   * cria avaliação nenhuma.** Elas nascem na designação. Abrir libera as que já
   * existem e trava a montagem — a tela dizia o contrário até 08/09.
   */
  async previaDaAbertura(cicloId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const [designados, noPublico, provisorias] = await Promise.all([
      this.prisma.avaliacao.count({ where: { cicloId, ...ONDE_A_AVALIACAO_CONTA } }),
      this.prisma.aplicacaoPublico.count({ where: { cicloId } }),
      // Aplicações cujo público veio de um atalho e o RH ainda não confirmou.
      this.prisma.aplicacaoPublico.groupBy({
        by: ['aplicacaoId'],
        where: { cicloId, provisorio: true },
      }),
    ]);

    let semAvaliador = 0;
    /**
     * ⚠️⚠️ ESTE CAMPO SE CHAMAVA `barradosPelaRegua`, E O NOME MENTIA.
     *
     * A conta é `!elegivel`, e `elegivel` sai de `designacao.listar`, onde
     * **"a decisão manual SOBREPÕE a régua, nos dois sentidos"**. Ou seja: o
     * número inclui quem o **RH tirou à mão**, que não é régua nenhuma — é
     * decisão de uma pessoa, com justificativa registrada.
     *
     * ⚠️ Medido no Piloto em 08/09: 47 fora do ciclo, `REGRA_CICLO` 47,
     * manual 0. Os dois sentidos concordam **por acaso** — ninguém excluiu à
     * mão ainda. Na primeira exclusão manual o campo passaria a dizer "a régua
     * barrou" sobre um ato de gente, com toda a confiança de um número.
     *
     * `foraDoCiclo` é o mesmo nome do campo equivalente em `resumoDoCiclo`, e
     * pela mesma razão: nomeia o EFEITO (está fora), não a causa suposta.
     */
    let foraDoCiclo = 0;
    for (const a of ciclo.aplicacoes) {
      const linhas = await this.designacao.listar(a.id);
      const comAvaliacao = new Set(
        (
          await this.prisma.avaliacao.groupBy({ by: ['avaliadoId'], where: { aplicacaoId: a.id } })
        ).map((x) => x.avaliadoId),
      );
      foraDoCiclo += linhas.filter((l) => !l.elegivel).length;
      semAvaliador += linhas.filter((l) => l.elegivel && !comAvaliacao.has(l.colaboradorId)).length;
    }

    /**
     * ⭐ Sai da MESMA função da fila do painel (`acessoDeAvaliadores`), não de
     * uma segunda checagem — duas contas de "quem consegue entrar" divergiriam
     * no primeiro caso de borda, e este aviso existe justamente para o caso de
     * borda que ninguém vê.
     */
    const porAvaliador = await this.prisma.avaliacao.groupBy({
      by: ['avaliadorId'],
      where: { cicloId, ...ONDE_A_AVALIACAO_CONTA },
      _count: { _all: true },
    });
    const nomes = new Map(
      (
        await this.prisma.colaborador.findMany({
          where: { id: { in: porAvaliador.map((l) => l.avaliadorId) } },
          select: { id: true, nome: true, matricula: true },
        })
      ).map((c) => [c.id, c]),
    );
    const acessos = await this.identidade.acessoDeAvaliadores(
      [...nomes.values()].map((c) => c.matricula),
    );
    const comAcesso = porAvaliador.map((l) => {
      const c = nomes.get(l.avaliadorId);
      const a = c ? acessos.get(c.matricula) : undefined;
      return {
        avaliadorId: l.avaliadorId,
        nome: c?.nome ?? '(colaborador não encontrado)',
        matricula: c?.matricula ?? '',
        acesso: a?.acesso ?? 'SEM_CONTA',
        motivo: a?.motivo ?? null,
        situacao: a?.situacao ?? null,
        avaliacoes: l._count._all,
      };
    });
    const porTamanho = (a: { avaliacoes: number; nome: string }, b: { avaliacoes: number; nome: string }) =>
      b.avaliacoes - a.avaliacoes || a.nome.localeCompare(b.nome, 'pt-BR');

    const avaliadoresSemAcesso = comAcesso.filter((x) => x.acesso !== 'OK').sort(porTamanho);

    /**
     * ⭐⭐ QUEM PODE ENTRAR MAS NÃO ESTÁ TRABALHANDO — a irmã que faltava (12/09).
     *
     * A prévia conferia UMA condição de impedimento (acesso) e não a irmã dela.
     * Férias e afastamento **não impedem entrar** — `SITUACOES_ELEGIVEIS` inclui
     * os dois —, mas a avaliação fica parada com quem não está no trabalho.
     *
     * ⚠️ **Lista SEPARADA da de acesso, de propósito.** São providências
     * diferentes: "sem conta" resolve-se no Configurador, com outra pessoa;
     * "de férias" resolve-se redesignando ou esperando, e é decisão do RH.
     * Juntas, a segunda seria lida como defeito de cadastro e mandaria o RH ao
     * lugar errado.
     *
     * ⚠️ E é AVISO, nunca bloqueio: quem volta de férias responde normalmente.
     * Medido em 12/09 no Piloto: 10 avaliadores, 264 das 894 avaliações.
     */
    const avaliadoresDeLicenca = comAcesso
      .filter((x) => x.acesso === 'OK' && (x.situacao === 'FERIAS' || x.situacao === 'AFASTADO'))
      .sort(porTamanho);

    return {
      /** Vazio = a abertura passa. Mesma função que a API roda no clique. */
      problemas: await this.ciclos.pendenciasParaAbrir(cicloId),
      /**
       * ⭐ O que NÃO impede abrir, mas quem abre precisa saber — hoje, critério
       * INFORMADO sem nenhum valor no ciclo. Lista separada da de problemas:
       * juntas, o aviso pareceria impedimento.
       */
      avisos: await this.ciclos.avisosParaAbrirCiclo(cicloId),
      totalAplicacoes: ciclo.aplicacoes.length,
      noPublico,
      /** Avaliações que já existem e serão liberadas para responder. */
      designados,
      /** No público, elegíveis, e ninguém disse quem avalia — não serão avaliadas. */
      semAvaliador,
      /**
       * No público e FORA do ciclo — pela régua **ou** por exclusão manual do
       * RH. O caso de borda que a tela não veria. Ver o comentário do cálculo:
       * o nome antigo (`barradosPelaRegua`) afirmava a causa, e só uma delas.
       */
      foraDoCiclo,
      /** Aplicações com público marcado como recorte provisório. */
      aplicacoesProvisorias: provisorias.length,
      /**
       * ⭐⭐ AVALIADORES QUE NÃO CONSEGUEM RESPONDER — o aviso que faltava.
       * Aparece na prévia porque é o último momento barato: depois de abrir, a
       * fila existe, o prazo corre e ninguém sabe que metade dela é impossível.
       * ⚠️ NÃO impede abrir. Falta conta, que é ato de outra pessoa, e pode ser
       * resolvido com o ciclo já aberto.
       */
      avaliadoresSemAcesso,
      /** Entram, mas estão de licença — lista separada: outra providência. */
      avaliadoresDeLicenca,
      /** Quantas avaliações estão paradas com quem está de licença. */
      avaliacoesComAvaliadorDeLicenca: avaliadoresDeLicenca.reduce((t, a) => t + a.avaliacoes, 0),
      /** Quantas avaliações estão nas mãos deles — o número que dói. */
      avaliacoesSemAvaliadorComAcesso: avaliadoresSemAcesso.reduce((t, a) => t + a.avaliacoes, 0),
    };
  }

  /**
   * ⭐⭐ O QUE OS AVALIADORES DISSERAM SOBRE A PRÓPRIA EQUIPE — a leitura do
   * sinal #5 do piloto (se a designação do cadastro corresponde à chefia real).
   *
   * ⚠️ Sem esta tela o recurso ficaria pela metade: o dado existe em
   * `rh.auditoria` desde 09/09, e auditoria só responde a quem já sabe perguntar
   * — com SQL. Reclamação que só a T.I. consegue ler **não vira decisão de quem
   * decide**, e a gestora é quem revisa o cadastro de avaliadores.
   *
   * Agrupado por AVALIADOR de propósito: a decisão dela é sobre a lista de uma
   * pessoa ("o Washington aponta 6 que não são dele"), não sobre apontamentos
   * soltos. Um avaliador com muitos apontamentos é um recorte de cadastro
   * errado; um apontamento isolado é uma pessoa que mudou de setor.
   */
  async contestacoesDoCiclo(cicloId: string) {
    const [apontamentos, faltas] = await Promise.all([
      this.prisma.auditoria.findMany({
        where: {
          entidade: 'Avaliacao',
          acao: ACAO_NAO_E_MINHA_EQUIPE,
          // O `cicloId` foi gravado no `valorNovo` justamente para esta leitura
          // não precisar carregar as 894 avaliações do ciclo para filtrar.
          valorNovo: { path: ['cicloId'], equals: cicloId },
        },
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.auditoria.findMany({
        where: { entidade: 'Ciclo', entidadeId: cicloId, acao: ACAO_FALTA_GENTE },
        orderBy: { criadoEm: 'desc' },
      }),
    ]);

    // Quem AVISOU: a auditoria guarda o usuário, e o nome que a gestora conhece
    // é o do colaborador — a ponte é a avaliação, que sabe quem é o avaliador.
    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: { id: { in: apontamentos.map((a) => a.entidadeId) } },
      select: { id: true, avaliadorId: true },
    });
    const avaliadorPorAvaliacao = new Map(avaliacoes.map((a) => [a.id, a.avaliadorId]));

    const idsDeGente = [
      ...new Set([
        ...avaliacoes.map((a) => a.avaliadorId),
        ...faltas.map((f) => (f.valorNovo as { avaliadorId?: string } | null)?.avaliadorId ?? ''),
      ]),
    ].filter(Boolean);
    const gente = await this.prisma.colaborador.findMany({
      where: { id: { in: idsDeGente } },
      select: { id: true, nome: true, matricula: true },
    });
    const nomePorId = new Map(gente.map((c) => [c.id, c]));

    const naoEMinhaEquipe = apontamentos.map((a) => {
      const dados = (a.valorNovo ?? {}) as {
        avaliadoNome?: string | null;
        avaliadoMatricula?: string | null;
        centroCusto?: string | null;
      };
      const avaliadorId = avaliadorPorAvaliacao.get(a.entidadeId) ?? '';
      const avaliador = nomePorId.get(avaliadorId);
      return {
        avaliacaoId: a.entidadeId,
        avaliadorNome: avaliador?.nome ?? '(avaliador não encontrado)',
        avaliadorMatricula: avaliador?.matricula ?? '',
        avaliadoNome: dados.avaliadoNome ?? '(não registrado)',
        avaliadoMatricula: dados.avaliadoMatricula ?? '',
        centroCusto: dados.centroCusto ?? null,
        motivo: a.justificativa ?? '',
        em: a.criadoEm,
      };
    });

    // Agrupa por avaliador mantendo a ordem de quem tem mais a dizer primeiro.
    const porAvaliador = [
      ...naoEMinhaEquipe
        .reduce((mapa, linha) => {
          const atual = mapa.get(linha.avaliadorMatricula) ?? {
            avaliadorNome: linha.avaliadorNome,
            avaliadorMatricula: linha.avaliadorMatricula,
            apontamentos: [] as typeof naoEMinhaEquipe,
          };
          atual.apontamentos.push(linha);
          mapa.set(linha.avaliadorMatricula, atual);
          return mapa;
        }, new Map<string, { avaliadorNome: string; avaliadorMatricula: string; apontamentos: typeof naoEMinhaEquipe }>())
        .values(),
    ].sort((a, b) => b.apontamentos.length - a.apontamentos.length);

    const faltaGente = faltas.map((f) => {
      const dados = (f.valorNovo ?? {}) as { avaliadorId?: string; avaliacoesNaFila?: number };
      const quem = nomePorId.get(dados.avaliadorId ?? '');
      return {
        avaliadorNome: quem?.nome ?? '(avaliador não encontrado)',
        avaliadorMatricula: quem?.matricula ?? '',
        avaliacoesNaFila: dados.avaliacoesNaFila ?? 0,
        texto: f.justificativa ?? '',
        em: f.criadoEm,
      };
    });

    return {
      // Os dois números separados: são reclamações de naturezas opostas — sobra
      // gente na fila × falta gente na fila —, e somá-las esconderia qual das
      // duas o cadastro está produzindo.
      totalApontamentos: naoEMinhaEquipe.length,
      totalFaltaGente: faltaGente.length,
      porAvaliador,
      faltaGente,
    };
  }

  async resumoDoCiclo(cicloId: string): Promise<ResumoDoCiclo> {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' }, select: { id: true } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const [porStatus, noPublico, apuradas, canceladasPorOrigem] = await Promise.all([
      this.prisma.avaliacao.groupBy({ by: ['status'], where: { cicloId }, _count: { _all: true } }),
      this.prisma.aplicacaoPublico.count({ where: { cicloId } }),
      this.prisma.resultadoAvaliacao.count({ where: { cicloId } }),
      /**
       * ⭐⭐ AS CANCELADAS POR ORIGEM — porque o caminho de RECUPERAÇÃO é
       * diferente para cada uma, e o rótulo tem de dizer qual.
       *
       * O cabeçalho contava 39 e a seção abaixo 37, sem nada conciliando: as
       * outras 2 foram excluídas pelo RH uma a uma, e o "Devolver canceladas"
       * **não as alcança** (ele só reverte origem `ENCERRAMENTO`). Elas voltam
       * pelo "Incluir", na aba Designação — e ninguém tinha como saber disso
       * lendo a tela.
       */
      this.prisma.avaliacao.groupBy({
        by: ['origemCancelamento'],
        where: { cicloId, status: 'CANCELADA' },
        _count: { _all: true },
      }),
    ]);
    const conta = (s: string) => porStatus.find((l) => l.status === s)?._count._all ?? 0;
    /**
     * ⭐ "0 de 52 enviadas" contava as 2 CANCELADAS e o ciclo nunca chegaria a
     * 100% — enquanto o diálogo que cancela promete que ela "deixa de travar o
     * encerramento". Agora sai da mesma regra que as outras quatro consultas.
     */
    const designados = somarQueContam(porStatus);

    /**
     * ⭐ Pessoas no público que nunca tiveram avaliação criada. Sai da MESMA
     * varredura de `semDesignacao` e `foraDoCiclo` — uma segunda conta de
     * "quem está no público" divergiria da primeira listagem que mudasse.
     */
    let noPublicoSemAvaliacao = 0;
    let semDesignacao = 0;
    // ⭐ Sai da MESMA varredura de `semDesignacao`, e da mesma régua: uma segunda
    // conta de "quem o ciclo tirou" divergiria da primeira listagem que mudasse.
    let foraDoCiclo = 0;
    for (const a of ciclo.aplicacoes) {
      const linhas = await this.designacao.listar(a.id);
      const elegiveis = linhas.filter((l) => l.elegivel);
      foraDoCiclo += linhas.length - elegiveis.length;
      const comAvaliacao = new Set(
        (
          await this.prisma.avaliacao.groupBy({ by: ['avaliadoId'], where: { aplicacaoId: a.id } })
        ).map((x) => x.avaliadoId),
      );
      semDesignacao += elegiveis.filter((e) => !comAvaliacao.has(e.colaboradorId)).length;
      /**
       * ⚠️ Sobre TODAS as linhas, elegíveis ou não.
       *
       * A primeira versão filtrava por `elegivel`, "para não contar duas vezes
       * com `foraDoCiclo`" — e o número deu **0** no SIMULACAO, onde há 2
       * pessoas sem avaliação. Elas eram justamente as que a régua excluiu.
       *
       * ⭐ Os dois números respondem perguntas DIFERENTES e podem se sobrepor:
       * `foraDoCiclo` é *"a régua tirou"*; este é *"não existe avaliação"*. No
       * SIMULACAO, 4 estão fora do ciclo e 2 delas têm avaliação (cancelada) —
       * somar os dois nunca foi a conta. A conta que fecha é
       * **`noPublico` = avaliações + estas**, e é ela que a linha precisa.
       */
      noPublicoSemAvaliacao += linhas.filter((l) => !comAvaliacao.has(l.colaboradorId)).length;
    }

    const estado = {
      status: ciclo.status as string,
      aplicacoes: ciclo.aplicacoes.length,
      noPublico,
      foraDoCiclo,
      designados,
      canceladas: conta('CANCELADA'),
      noPublicoSemAvaliacao,
      canceladasPeloEncerramento:
        canceladasPorOrigem.find((c) => c.origemCancelamento === 'ENCERRAMENTO')?._count._all ?? 0,
      excluidasPeloRh:
        canceladasPorOrigem.find((c) => c.origemCancelamento === 'DECISAO_RH')?._count._all ?? 0,
      semDesignacao,
      enviadas: conta('ENVIADA'),
      // "A fazer" é exatamente o conjunto que o encerramento contaria e
      // cancelaria — sai de `STATUS_VIVOS` para não virar uma segunda régua.
      aFazer: STATUS_VIVOS.reduce((t, s) => t + conta(s), 0),
      apuradas,
    };
    // ⚠️ `estado` tem `status` porque `proximoPasso` deriva dele — mas ele NÃO
    // sai daqui: o dono do fato é `GET /ciclos/:id`. Ver o comentário do tipo.
    const { status: _status, ...numeros } = estado;
    return {
      ...numeros,
      proximoPasso: proximoPasso(estado),
      // Só faz sentido no rascunho — nos outros estados a porta já passou.
      pendenciasParaAbrir:
        ciclo.status === 'RASCUNHO' ? await this.ciclos.pendenciasParaAbrir(cicloId) : null,
      ...(await this.ciclos.historicoDeReabertura(cicloId).then((h) => ({
        reaberturas: h.reaberturas,
        ultimaReabertura: h.ultima,
      }))),
    };
  }

  /**
   * Dos que não têm designação NESTE ciclo, quantos já têm avaliador no
   * cadastro da plataforma — ou seja, quantos se resolvem só copiando.
   */
  private async semDesignacaoPorOrigem(ids: Set<string>) {
    if (ids.size === 0) return { jaTemNoCadastro: 0, nemNoCadastro: 0 };
    const noCadastro = await this.prisma.designacaoPadrao.findMany({
      where: { avaliadoId: { in: [...ids] }, vigenciaFim: null },
      select: { avaliadoId: true },
    });
    const jaTem = new Set(noCadastro.map((d) => d.avaliadoId)).size;
    return { jaTemNoCadastro: jaTem, nemNoCadastro: ids.size - jaTem };
  }

  /**
   * QUEM O CICLO NÃO ENXERGA — elegível e fora do público de toda aplicação.
   *
   * A conta é de nível de CICLO de propósito: `semDesignacao` percorre as
   * aplicações uma a uma e, por construção, não tem como enxergar quem não
   * pertence a nenhuma delas. Era o buraco que sobrava depois de o público
   * virar nominal — e é a mesma pergunta que o cadastro de avaliadores responde
   * do outro lado ("quem não está na lista de ninguém").
   *
   * ⚠️ A régua de elegibilidade é a MESMA da tela de designação
   * (`elegibilidade-ciclo.ts`), pela razão de sempre: duas contas de "quem
   * deveria estar no ciclo" divergem no primeiro ajuste manual. Aqui ela roda
   * sobre o cadastro inteiro, porque a pergunta é justamente sobre quem ficou
   * fora de todo recorte.
   */
  /**
   * ⚠️ NÃO MARCA a linha do próprio usuário — decisão de 06/09/2026, com prazo
   * de validade.
   *
   * A linha aqui só diz "esta pessoa ficaria fora do ciclo": pendência de
   * montagem, sem avaliação, avaliador nem nota. E a marca seria quase sempre
   * invisível — medido no DEV, o ciclo "Avaliação Geral 2026" tem **896 pessoas
   * nesta lista e a tela renderiza 6 nomes**; a gestora está na posição 35.
   *
   * 🔴 **Quem implementar o "ver todos" desta lista precisa revisitar isto.** A
   * decisão é inócua enquanto a tela mostra 6 de 896 — deixa de ser no dia em
   * que ela mostrar a lista inteira, com busca. Marcar é uma linha:
   * `marcarRestricoesPor(pessoas, colaboradorId, (p) => p.colaboradorId)`.
   */
  private async foraDeTodasAsAplicacoes(ciclo: { id: string; incluirAfastados: boolean }) {
    const [candidatos, noPublico, decisoes] = await Promise.all([
      this.prisma.colaborador.findMany({
        where: { situacao: { in: SITUACOES_ELEGIVEIS as never[] } },
        select: {
          id: true,
          matricula: true,
          nome: true,
          filial: true,
          centroCusto: true,
          centroCustoDescricao: true,
          situacao: true,
        },
        orderBy: [{ filial: 'asc' }, { centroCusto: 'asc' }, { nome: 'asc' }],
      }),
      this.prisma.aplicacaoPublico.findMany({
        where: { cicloId: ciclo.id },
        select: { colaboradorId: true },
      }),
      this.prisma.cicloElegibilidade.findMany({
        where: { cicloId: ciclo.id, removidoEm: null },
        select: { colaboradorId: true, decisao: true },
      }),
    ]);

    const jaTemAplicacao = new Set(noPublico.map((p) => p.colaboradorId));
    // O RH pode ter EXCLUÍDO alguém do ciclo de propósito. Contar essa pessoa
    // como pendência transformaria uma decisão registrada em cobrança eterna.
    const excluidos = new Set(
      decisoes.filter((d) => d.decisao === 'EXCLUIR').map((d) => d.colaboradorId),
    );

    const { incluidos } = montarListaInicial(
      candidatos.map((c) => ({
        colaboradorId: c.id,
        matricula: c.matricula,
        nome: c.nome,
        // Mesma nota da tela de designação: categoria funcional não é coluna do
        // nosso cadastro; Presidente e Vice saem por decisão registrada.
        categoriaFuncional: null,
        situacaoNaDataBase: c.situacao,
      })),
      { incluirAfastados: ciclo.incluirAfastados },
    );

    const porId = new Map(candidatos.map((c) => [c.id, c]));
    const pessoas: PessoaForaDoCiclo[] = incluidos
      .filter((i) => !jaTemAplicacao.has(i.colaboradorId) && !excluidos.has(i.colaboradorId))
      .map((i) => {
        const c = porId.get(i.colaboradorId)!;
        return {
          colaboradorId: c.id,
          matricula: c.matricula,
          nome: c.nome,
          filial: c.filial,
          centroCusto: c.centroCusto,
          centroCustoDescricao: c.centroCustoDescricao,
        };
      });

    return { total: pessoas.length, pessoas };
  }

  /**
   * Fila por avaliador, de quem tem MAIS a fazer para quem tem menos — é uma
   * ordenação por quantidade, não um juízo sobre quem não respondeu. Cancelada
   * fica fora da
   * conta: não é trabalho de ninguém, e somá-la faria a fila de quem não deve
   * nada parecer cheia.
   */
  private async filaPorAvaliador(cicloId: string): Promise<FilaDoAvaliador[]> {
    const linhas = await this.prisma.avaliacao.groupBy({
      by: ['avaliadorId', 'status'],
      where: { cicloId, ...ONDE_A_AVALIACAO_CONTA },
      _count: { _all: true },
    });
    if (linhas.length === 0) return [];

    const pessoas = await this.prisma.colaborador.findMany({
      where: { id: { in: [...new Set(linhas.map((l) => l.avaliadorId))] } },
      select: { id: true, nome: true, matricula: true },
    });
    const porId = new Map(pessoas.map((p) => [p.id, p]));

    const acumulado = new Map<string, FilaDoAvaliador>();
    for (const l of linhas) {
      const atual =
        acumulado.get(l.avaliadorId) ??
        {
          avaliadorId: l.avaliadorId,
          nome: porId.get(l.avaliadorId)?.nome ?? '(colaborador não encontrado)',
          matricula: porId.get(l.avaliadorId)?.matricula ?? '',
          total: 0,
          enviadas: 0,
          aFazer: 0,
          // Preenchidos depois, numa consulta só para o lote.
          acesso: 'OK' as AcessoDoAvaliador,
          motivoDoAcesso: null as string | null,
        };
      atual.total += l._count._all;
      if (l.status === 'ENVIADA') atual.enviadas += l._count._all;
      else atual.aFazer += l._count._all;
      acumulado.set(l.avaliadorId, atual);
    }

    // ⭐ UMA consulta para o lote inteiro, depois de a fila estar montada.
    const acesso = await this.identidade.acessoDeAvaliadores(
      [...acumulado.values()].map((a) => a.matricula).filter(Boolean),
    );
    for (const fila of acumulado.values()) {
      const a = acesso.get(fila.matricula);
      fila.acesso = a?.acesso ?? 'SEM_CONTA';
      fila.motivoDoAcesso = a?.motivo ?? null;
    }

    /**
     * ⚠️ Ordena por "não consegue responder" ANTES de por tamanho da fila. A
     * ordenação por quantidade responde "quem tem mais a fazer"; esta responde
     * "o que impede o ciclo de andar", e é a pergunta mais urgente das duas —
     * uma fila de 13 que ninguém consegue abrir não é trabalho atrasado, é
     * trabalho impossível.
     */
    return [...acumulado.values()].sort(
      (a, b) =>
        Number(a.acesso === 'OK') - Number(b.acesso === 'OK') ||
        b.aFazer - a.aFazer ||
        a.nome.localeCompare(b.nome),
    );
  }
}
