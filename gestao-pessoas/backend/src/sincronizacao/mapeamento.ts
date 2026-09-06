/**
 * Decisões PURAS do sync: o que entra, o que é recusado e com que motivo.
 *
 * Fica separado do service para poder ser testado sem banco — e porque é aqui
 * que moram as regras que já custaram caro: quem é população, o que é "ativo",
 * e o que fazer com linha incompleta.
 */
import { elegivel, situacaoDoProtheus, type Situacao } from '../common/elegibilidade.js';
import type { ColaboradorDaFonte } from './fonte.port.js';

/**
 * Categoria funcional que NÃO é população do módulo.
 *
 * `A` = autônomo. Na Capul são **2.756 pessoas** — cooperados e produtores, que
 * existem no `SRA010` por causa de pagamento, não por vínculo de emprego.
 * Excluí-los deixa os **1.036** colaboradores que a avaliação alcança.
 *
 * ⚠️ O select antigo fazia isso por `RA_MAT LIKE '0%'`, que funcionava por
 * coincidência: as matrículas de autônomo começam com 9. Aqui usamos o CAMPO,
 * porque coincidência de formato quebra sem avisar no dia em que alguém emitir
 * uma matrícula fora do padrão.
 */
export const CATEGORIA_AUTONOMO = 'A';

export type MotivoRecusa =
  | 'AUTONOMO'
  | 'NAO_ELEGIVEL'
  | 'SEM_ADMISSAO'
  | 'SEM_MATRICULA'
  | 'SEM_NOME';

export interface ColaboradorMapeado {
  filial: string;
  matricula: string;
  nome: string;
  cpf: string | null;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
  cargoDescricao: string | null;
  dataAdmissao: string;
  dataDemissao: string | null;
  situacao: Situacao;
  grauInstrucaoCodigo: string | null;
  grauInstrucaoDescricao: string | null;
  descricaoFuncao: string | null;
  categoriaFuncional: string | null;
}

export interface Recusa {
  filial: string;
  matricula: string;
  nome: string;
  motivo: MotivoRecusa;
  detalhe: string;
}

export interface ResultadoMapeamento {
  aceitos: ColaboradorMapeado[];
  recusados: Recusa[];
}

/**
 * Decide e converte. **Nada é descartado em silêncio**: toda linha que não entra
 * volta em `recusados`, com o motivo — inclusive os 2.756 autônomos, que não são
 * erro nenhum e ainda assim são contados, para o relatório do sync fechar com o
 * total do arquivo.
 */
export function mapearColaboradores(
  linhas: readonly ColaboradorDaFonte[],
): ResultadoMapeamento {
  const aceitos: ColaboradorMapeado[] = [];
  const recusados: Recusa[] = [];

  for (const linha of linhas) {
    const filial = (linha.filial ?? '').trim();
    const matricula = (linha.matricula ?? '').trim();
    const nome = (linha.nome ?? '').trim();
    const identificacao = { filial, matricula, nome };

    if (!matricula) {
      recusados.push({ ...identificacao, motivo: 'SEM_MATRICULA', detalhe: 'Linha sem matrícula.' });
      continue;
    }
    if (!nome) {
      recusados.push({ ...identificacao, motivo: 'SEM_NOME', detalhe: 'Linha sem nome.' });
      continue;
    }

    const categoria = (linha.categoriaFuncional ?? '').trim().toUpperCase();
    if (categoria === CATEGORIA_AUTONOMO) {
      recusados.push({
        ...identificacao,
        motivo: 'AUTONOMO',
        detalhe: 'Autônomo/cooperado — está no cadastro por pagamento, não por vínculo de emprego.',
      });
      continue;
    }

    const situacao = situacaoDoProtheus(linha.dataDemissao, linha.situacaoFolha);
    if (!elegivel(situacao)) {
      recusados.push({
        ...identificacao,
        motivo: 'NAO_ELEGIVEL',
        detalhe: `Situação ${situacao} na origem — fora do quadro.`,
      });
      continue;
    }

    const dataAdmissao = (linha.dataAdmissao ?? '').trim();
    if (!/^\d{8}$/.test(dataAdmissao)) {
      // A especificação §4.2 é explícita: admissão ausente não é lacuna
      // cadastral, é erro de sincronização — e TEMPO_EMPRESA nunca produz
      // semDado. Importar sem ela deixaria a pessoa sem nota nesse critério, ou
      // com uma data inventada. Recusa a linha e mostra qual é.
      recusados.push({
        ...identificacao,
        motivo: 'SEM_ADMISSAO',
        detalhe: `Data de admissão ausente ou inválida ("${linha.dataAdmissao ?? ''}").`,
      });
      continue;
    }

    aceitos.push({
      filial,
      matricula,
      nome,
      cpf: vazioParaNulo(linha.cpf),
      centroCusto: vazioParaNulo(linha.centroCusto),
      centroCustoDescricao: vazioParaNulo(linha.centroCustoDescricao),
      cargoDescricao: vazioParaNulo(linha.cargoDescricao),
      dataAdmissao,
      dataDemissao: vazioParaNulo(linha.dataDemissao),
      situacao,
      grauInstrucaoCodigo: vazioParaNulo(linha.grauInstrucaoCodigo),
      grauInstrucaoDescricao: vazioParaNulo(linha.grauInstrucaoDescricao),
      descricaoFuncao: vazioParaNulo(linha.descricaoFuncao),
      categoriaFuncional: categoria || null,
    });
  }

  return { aceitos, recusados };
}

/**
 * Filial ATUAL de cada pessoa, para o histórico saber qual cópia alimenta o
 * cálculo. Só os aceitos entram: quem não é população não tem filial atual.
 */
export function filialAtualPorMatricula(
  aceitos: readonly ColaboradorMapeado[],
): Map<string, string> {
  return new Map(aceitos.map((c) => [c.matricula, c.filial]));
}

/** Campo fixo do Protheus vem com espaço; `' '` é vazio, não conteúdo. */
function vazioParaNulo(valor: string | null | undefined): string | null {
  const v = (valor ?? '').trim();
  return v.length > 0 ? v : null;
}
