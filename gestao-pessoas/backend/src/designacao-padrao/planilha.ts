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
      // Lista, não contagem: o rótulo serve para os dois casos e não flexiona.
      `Colunas que faltam na planilha: ${faltando.join(', ')}. ` +
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

/**
 * ⚠️ O EXCEL COME O ZERO À ESQUERDA, e come em TODA coluna numérica.
 *
 * Matrícula do Protheus tem 6 posições, filial tem 2, e as duas são texto no
 * banco. Aberta e salva no Excel, a planilha volta com `3113` e `2` — e uma
 * filial `2` não casa com nenhuma pessoa, o que faria a linha ser recusada
 * como "centro de custo sem pessoas". A mensagem estaria errada e a gestora
 * iria conferir o código do centro de custo, que está certo.
 *
 * ⚠️ **NÃO é cópia de `common/chapa.ts:normalizarChapa`.** Aquela traduz a chapa
 * na forma do Protheus (`E01981` → `001981`) e **não repõe zero**; esta repõe o
 * zero comido pelo Excel (`1741` → `001741`) e **não sabe o que é `E`**. Os dois
 * problemas convivem no mesmo campo e cada função cobre um — unificar por
 * parecerem iguais devolve um dos dois defeitos, sem erro nenhum na tela.
 */
export function normalizarMatricula(valor: string): string {
  const limpo = valor.trim();
  return /^\d+$/.test(limpo) ? limpo.padStart(6, '0') : limpo;
}

export function normalizarFilial(valor: string): string {
  const limpo = valor.trim();
  return /^\d+$/.test(limpo) ? limpo.padStart(2, '0') : limpo;
}

/**
 * Vários responsáveis na MESMA célula, separados por `|`.
 *
 * O modelo diz "repita a linha", mas a coluna de sugestões ao lado usa `|`
 * entre os candidatos — e foi assim que a planilha voltou preenchida. Aceitar
 * é melhor do que recusar: a intenção é inequívoca, e recusar devolveria um
 * erro por uma convenção que a própria planilha ensinou ao contrário.
 */
export function separarMatriculas(valor: string): string[] {
  return valor
    .split('|')
    .map((m) => normalizarMatricula(m))
    .filter((m) => m.length > 0);
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
    // Uma linha com N matrículas na mesma célula vira N linhas aqui — é o
    // mesmo que repetir a linha na planilha, que é o outro jeito de dizer isto.
    for (const avaliadorMatricula of separarMatriculas(avaliador)) {
      linhas.push({
        numero,
        centroCusto,
        filial: filial ? normalizarFilial(filial) : null,
        avaliadorMatricula,
      });
    }
  });

  return {
    linhas,
    recusas,
    semAvaliador,
    linhasNoArquivo: registros.length,
    conferencia: conferenciaDe(conteudo),
  };
}
