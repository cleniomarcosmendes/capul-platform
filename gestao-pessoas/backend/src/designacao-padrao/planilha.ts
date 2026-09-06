/**
 * A PLANILHA DE AVALIADORES — leitura e conferência.
 *
 * É o arquivo que a gestora de RH devolve preenchido: uma linha por centro de
 * custo, com a matrícula de quem responde por ele. Para mais de um responsável
 * no mesmo centro de custo, a linha se repete.
 *
 * ⚠️ Linha com o avaliador EM BRANCO não é erro. O modelo que ela recebe tem os
 * 74 centros de custo e a coluna vazia; enquanto ela decide, o branco significa
 * "ainda não" e sai contado à parte. Tratar como recusa encheria a tela de
 * vermelho no primeiro dia e esconderia os erros de verdade.
 *
 * ⚠️ `conferencia` é o SHA-256 do conteúdo. A prévia devolve o dela e o gravar
 * exige o mesmo: arquivo trocado entre "veja o que vai acontecer" e "pode
 * gravar" é recusado, porque senão ela confirma uma coisa e grava outra.
 */
import { createHash } from 'node:crypto';
import { lerCsv } from '../sincronizacao/csv.js';

/** Uma linha aproveitável da planilha, já normalizada. */
export interface LinhaDaPlanilha {
  /** Número da linha no arquivo, contando o cabeçalho — é o que ela vê no Excel. */
  numero: number;
  centroCusto: string;
  /** Quando preenchida, restringe o alcance a essa filial. */
  filial: string | null;
  avaliadorMatricula: string;
}

export interface RecusaDeLinha {
  numero: number;
  motivo: string;
  detalhe: string;
}

export interface LeituraDaPlanilha {
  linhas: LinhaDaPlanilha[];
  recusas: RecusaDeLinha[];
  /** Centros de custo listados sem avaliador — "ainda não decidi", não erro. */
  semAvaliador: number;
  linhasNoArquivo: number;
  conferencia: string;
}

const COLUNAS_OBRIGATORIAS = ['centro_custo', 'avaliador_matricula'];

export class PlanilhaInvalidaError extends Error {
  constructor(readonly faltando: string[], readonly encontradas: string[]) {
    super(
      `A planilha não tem a(s) coluna(s) ${faltando.join(', ')}. ` +
        `Encontrei: ${encontradas.join(', ') || '(nenhuma)'}. ` +
        'Use o modelo enviado pelo RH, sem renomear o cabeçalho.',
    );
    this.name = 'PlanilhaInvalidaError';
  }
}

export function conferenciaDe(conteudo: string): string {
  // Normaliza a quebra de linha antes: o mesmo arquivo salvo no Excel do
  // Windows e no editor do Mac produziria hashes diferentes, e a gestora
  // levaria "o arquivo mudou" sem ter mudado nada.
  return createHash('sha256').update(conteudo.replace(/\r\n/g, '\n').trimEnd(), 'utf8').digest('hex');
}

/** Matrícula do Protheus tem 6 posições com zeros à esquerda; o Excel come os zeros. */
export function normalizarMatricula(valor: string): string {
  const limpo = valor.trim();
  return /^\d+$/.test(limpo) ? limpo.padStart(6, '0') : limpo;
}

export function lerPlanilhaDeAvaliadores(conteudo: string): LeituraDaPlanilha {
  const registros = lerCsv(conteudo, ';');
  const encontradas = registros.length ? Object.keys(registros[0]) : [];
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !encontradas.includes(c));
  if (faltando.length) throw new PlanilhaInvalidaError(faltando, encontradas);

  const linhas: LinhaDaPlanilha[] = [];
  const recusas: RecusaDeLinha[] = [];
  let semAvaliador = 0;

  registros.forEach((r, i) => {
    const numero = i + 2; // +1 do cabeçalho, +1 porque o Excel conta de 1
    const centroCusto = (r['centro_custo'] ?? '').trim();
    const avaliador = (r['avaliador_matricula'] ?? '').trim();
    const filial = (r['filial'] ?? '').trim();

    if (!centroCusto && !avaliador) return; // linha em branco no fim do arquivo
    if (!avaliador) {
      semAvaliador++;
      return;
    }
    if (!centroCusto) {
      recusas.push({
        numero,
        motivo: 'SEM_CENTRO_DE_CUSTO',
        detalhe: `Matrícula ${avaliador} sem centro de custo na linha — não dá para saber por quem ela responde.`,
      });
      return;
    }
    linhas.push({
      numero,
      centroCusto,
      filial: filial || null,
      avaliadorMatricula: normalizarMatricula(avaliador),
    });
  });

  return {
    linhas,
    recusas,
    semAvaliador,
    linhasNoArquivo: registros.length,
    conferencia: conferenciaDe(conteudo),
  };
}
