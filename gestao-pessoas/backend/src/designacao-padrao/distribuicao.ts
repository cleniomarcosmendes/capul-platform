/**
 * O QUE A IMPORTAÇÃO VAI FAZER — regra pura, sem banco.
 *
 * A planilha traz 82 linhas no formato "centro de custo → avaliador". O banco
 * guarda pares nominais "este avaliador avalia esta pessoa", que são ~1.000. É
 * aqui que uma coisa vira a outra, e é por isso que existe PRÉVIA: ninguém
 * confere mil linhas depois de gravadas.
 *
 * ── As três exigências, e onde cada uma mora ────────────────────────────────
 *
 * PRÉ-VISUALIZAR  `montarPrevia` devolve o RELATÓRIO e o que gravar. A tela
 *                 mostra o relatório; o `aGravar` só é usado no commit.
 *
 * IDEMPOTÊNCIA    par que já existe IGUAL não vira linha nova — sai como
 *                 `inalterados`. Reimportar dez vezes grava zero na décima.
 *                 ⚠️ E não é só o avaliador: se o par já é o mesmo, a linha
 *                 existente fica INTACTA mesmo que a origem mude. Reescrever
 *                 uma linha MANUAL como DIVISAO_AUTOMATICA desfaria a revisão
 *                 que alguém já tinha feito — a importação apagaria o trabalho
 *                 de conferir.
 *
 * AJUSTE MANUAL   quando a planilha manda outro avaliador para quem já tem uma
 *                 designação MANUAL, o par NÃO é gravado: vira conflito, com
 *                 nome e as duas pontas, para ela decidir. Só com
 *                 `substituirAjustesManuais` a importação passa por cima — e aí
 *                 foi ela quem mandou.
 *
 * ── A divisão entre vários responsáveis ─────────────────────────────────────
 * Um responsável: todo mundo do centro de custo vai para ele, `CENTRO_CUSTO`.
 * Vários: blocos contíguos por ordem alfabética do avaliado, `DIVISAO_AUTOMATICA`.
 * ⚠️ A ordem alfabética é ARBITRÁRIA e não tem nada a ver com quem trabalha com
 * quem. Ela existe para não jogar fora o trabalho de quem preencheu a planilha,
 * e é por isso que essas linhas ficam marcadas até alguém olhar.
 */
import { normalizarChapa } from '../common/chapa.js';

export interface ColaboradorDaPrevia {
  id: string;
  filial: string;
  matricula: string;
  nome: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
}

export interface DesignacaoVigente {
  id: string;
  avaliadoId: string;
  avaliadorId: string;
  origem: string;
}

export interface LinhaResolvida {
  numero: number;
  centroCusto: string;
  filial: string | null;
  avaliadorMatricula: string;
}

export interface RecusaDeLinha {
  numero: number;
  motivo: string;
  detalhe: string;
}

/** Um par a gravar. `encerrarId` aponta a designação vigente que sai de cena. */
export interface ParaGravar {
  avaliadorId: string;
  avaliadoId: string;
  origem: 'CENTRO_CUSTO' | 'DIVISAO_AUTOMATICA';
  origemReferencia: string;
  encerrarId: string | null;
}

export interface ConflitoComAjusteManual {
  matricula: string;
  nome: string;
  avaliadorAtual: string;
  avaliadorDaPlanilha: string;
  centroCusto: string;
}

export interface CentroDeCustoDaPrevia {
  chave: string;
  descricao: string | null;
  pessoas: number;
  divisao: { avaliador: string; matricula: string; quantos: number }[];
  porDivisaoAutomatica: boolean;
}

export interface Previa {
  linhasNoArquivo: number;
  linhasSemAvaliador: number;
  centrosCusto: CentroDeCustoDaPrevia[];
  pares: {
    total: number;
    novos: number;
    inalterados: number;
    substituira: number;
    porDivisaoAutomatica: number;
  };
  conflitosComAjusteManual: ConflitoComAjusteManual[];
  recusas: RecusaDeLinha[];
  avisos: string[];
}

export interface ResultadoDaPrevia {
  previa: Previa;
  aGravar: ParaGravar[];
}

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Divide em N blocos contíguos do tamanho mais parecido possível. */
export function emBlocos<T>(itens: readonly T[], n: number): T[][] {
  const base = Math.floor(itens.length / n);
  const sobra = itens.length % n;
  const blocos: T[][] = [];
  let i = 0;
  for (let b = 0; b < n; b++) {
    const tamanho = base + (b < sobra ? 1 : 0);
    blocos.push(itens.slice(i, i + tamanho));
    i += tamanho;
  }
  return blocos;
}

export function montarPrevia(entrada: {
  linhas: readonly LinhaResolvida[];
  recusasDaLeitura: readonly RecusaDeLinha[];
  linhasNoArquivo: number;
  linhasSemAvaliador: number;
  colaboradores: readonly ColaboradorDaPrevia[];
  vigentes: readonly DesignacaoVigente[];
  substituirAjustesManuais: boolean;
}): ResultadoDaPrevia {
  const recusas: RecusaDeLinha[] = [...entrada.recusasDaLeitura];
  const avisos: string[] = [];
  const aGravar: ParaGravar[] = [];
  const conflitos: ConflitoComAjusteManual[] = [];
  const centrosCusto: CentroDeCustoDaPrevia[] = [];

  /**
   * ⚠️ Indexado pela chapa NORMALIZADA (08/09). A planilha do RH pode trazer a
   * forma do Protheus (`E01981`) enquanto a base guarda `001981` — e o match
   * exato recusava a linha com *"matrícula não existe entre os colaboradores
   * ativos"*, mandando conferir um número que está certo. É a mesma família do
   * zero à esquerda que o Excel come, já citada na recusa abaixo.
   * Ver `common/chapa.ts`.
   */
  const porMatricula = new Map<string, ColaboradorDaPrevia[]>();
  for (const c of entrada.colaboradores) {
    const chave = normalizarChapa(c.matricula);
    porMatricula.set(chave, [...(porMatricula.get(chave) ?? []), c]);
  }
  const vigentePorAvaliado = new Map(entrada.vigentes.map((v) => [v.avaliadoId, v]));
  const nomePorId = new Map(entrada.colaboradores.map((c) => [c.id, c.nome]));

  // A planilha repete a linha para cada responsável do mesmo centro de custo.
  const grupos = new Map<string, { cc: string; filial: string | null; linhas: LinhaResolvida[] }>();
  for (const l of entrada.linhas) {
    const chave = `${l.filial ?? '*'}|${l.centroCusto}`;
    const g = grupos.get(chave) ?? { cc: l.centroCusto, filial: l.filial, linhas: [] };
    g.linhas.push(l);
    grupos.set(chave, g);
  }

  let inalterados = 0;
  let substituira = 0;
  let porDivisaoAutomatica = 0;
  /** Quem a planilha já mandou avaliar — pega centro de custo listado duas vezes. */
  const jaAtribuido = new Map<string, string>();

  for (const [chave, grupo] of [...grupos.entries()].sort()) {
    const responsaveis: ColaboradorDaPrevia[] = [];
    for (const linha of grupo.linhas) {
      const achados = porMatricula.get(normalizarChapa(linha.avaliadorMatricula)) ?? [];
      if (achados.length === 0) {
        recusas.push({
          numero: linha.numero,
          motivo: 'AVALIADOR_NAO_ENCONTRADO',
          detalhe:
            `Matrícula ${linha.avaliadorMatricula} não existe entre os colaboradores ativos. ` +
            'Confira o número — o Excel costuma comer o zero à esquerda.',
        });
        continue;
      }
      if (achados.length > 1) {
        // Nunca "pega o primeiro": escolher em silêncio seria decidir por ordem
        // de índice quem responde pela avaliação de alguém.
        recusas.push({
          numero: linha.numero,
          motivo: 'MATRICULA_AMBIGUA',
          detalhe:
            `A matrícula ${linha.avaliadorMatricula} existe em ${achados.length} filiais ` +
            `(${achados.map((a) => a.filial).join(', ')}). Preencha a coluna "filial" para dizer qual.`,
        });
        continue;
      }
      if (responsaveis.some((r) => r.id === achados[0].id)) {
        avisos.push(`${chave}: a matrícula ${linha.avaliadorMatricula} está repetida — contei uma vez.`);
        continue;
      }
      responsaveis.push(achados[0]);
    }

    if (responsaveis.length === 0) continue;
    responsaveis.sort(porNome);

    const membros = entrada.colaboradores
      .filter((c) => c.centroCusto === grupo.cc && (grupo.filial === null || c.filial === grupo.filial))
      .sort(porNome);

    if (membros.length === 0) {
      recusas.push({
        numero: grupo.linhas[0].numero,
        motivo: 'CENTRO_DE_CUSTO_SEM_PESSOAS',
        detalhe:
          `O centro de custo ${grupo.cc}${grupo.filial ? ` da filial ${grupo.filial}` : ''} ` +
          'não tem nenhum colaborador ativo. Confira o código.',
      });
      continue;
    }

    // O responsável não entra na própria lista: autoavaliação não existe. Quem
    // avalia o responsável é decisão à parte, e aparece na pendência reversa.
    const alvos = membros.filter((m) => !responsaveis.some((r) => r.id === m.id));
    if (alvos.length === 0) {
      avisos.push(
        `${chave}: todo mundo do centro de custo é responsável — ninguém sobra para avaliar. ` +
          'Eles aparecem na lista de quem ainda não tem avaliador.',
      );
      centrosCusto.push({
        chave,
        descricao: membros[0].centroCustoDescricao,
        pessoas: membros.length,
        divisao: responsaveis.map((r) => ({ avaliador: r.nome, matricula: r.matricula, quantos: 0 })),
        porDivisaoAutomatica: false,
      });
      continue;
    }

    const dividido = responsaveis.length > 1;
    const blocos = emBlocos(alvos, responsaveis.length);
    const origem = dividido ? ('DIVISAO_AUTOMATICA' as const) : ('CENTRO_CUSTO' as const);

    centrosCusto.push({
      chave,
      descricao: membros[0].centroCustoDescricao,
      pessoas: membros.length,
      divisao: responsaveis.map((r, i) => ({
        avaliador: r.nome,
        matricula: r.matricula,
        quantos: blocos[i].length,
      })),
      porDivisaoAutomatica: dividido,
    });

    blocos.forEach((bloco, i) => {
      const responsavel = responsaveis[i];
      for (const alvo of bloco) {
        const duplicada = jaAtribuido.get(alvo.id);
        if (duplicada && duplicada !== chave) {
          recusas.push({
            numero: grupo.linhas[0].numero,
            motivo: 'PESSOA_EM_DOIS_RECORTES',
            detalhe:
              `${alvo.nome} (${alvo.matricula}) aparece em ${duplicada} e em ${chave}. ` +
              'Uma pessoa tem um avaliador só — use a coluna "filial" para separar os recortes.',
          });
          continue;
        }
        jaAtribuido.set(alvo.id, chave);

        const vigente = vigentePorAvaliado.get(alvo.id);
        if (vigente && vigente.avaliadorId === responsavel.id) {
          inalterados++;
          continue;
        }
        if (vigente && vigente.origem === 'MANUAL' && !entrada.substituirAjustesManuais) {
          conflitos.push({
            matricula: alvo.matricula,
            nome: alvo.nome,
            avaliadorAtual: nomePorId.get(vigente.avaliadorId) ?? '(fora do cadastro ativo)',
            avaliadorDaPlanilha: responsavel.nome,
            centroCusto: chave,
          });
          continue;
        }
        if (vigente) substituira++;
        if (dividido) porDivisaoAutomatica++;
        aGravar.push({
          avaliadorId: responsavel.id,
          avaliadoId: alvo.id,
          origem,
          origemReferencia: chave,
          encerrarId: vigente?.id ?? null,
        });
      }
    });
  }

  return {
    previa: {
      linhasNoArquivo: entrada.linhasNoArquivo,
      linhasSemAvaliador: entrada.linhasSemAvaliador,
      centrosCusto,
      pares: {
        total: aGravar.length,
        novos: aGravar.length - substituira,
        inalterados,
        substituira,
        porDivisaoAutomatica,
      },
      conflitosComAjusteManual: conflitos,
      recusas,
      avisos,
    },
    aGravar,
  };
}
