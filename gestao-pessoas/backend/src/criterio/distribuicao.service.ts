/**
 * ⭐⭐ DISTRIBUIÇÃO REAL POR FAIXA — quantas pessoas cada faixa cobre HOJE.
 *
 * **Por que existe.** Quem mexe numa faixa precisa ver o tamanho antes de mexer.
 * Apagar a faixa do código `45` de ESCOLARIDADE tira **480 pessoas** da conta —
 * elas caem em `SEM_FAIXA`, o critério sai da nota delas pela renormalização, e
 * nada avisa até a apuração. O cadastro mostrava a régua sem mostrar o que ela
 * mede.
 *
 * ⚠️ **Reusa os RESOLVERS e a `localizarFaixa`**, não reimplementa nada: o
 * número que a tela mostra tem de ser o mesmo que a apuração vai produzir. Uma
 * segunda forma de calcular "em que faixa esta pessoa cai" divergiria da
 * primeira, e o jeito que isso aparece é a tela prometendo uma distribuição que
 * a nota não confirma.
 *
 * ⚠️ **A referência é HOJE, não um ciclo.** O critério é do catálogo e não
 * pertence a ciclo nenhum; os critérios temporais (tempo de empresa, de função)
 * mudam com a data-base. A tela diz isso — número sem a data que o ancora é
 * número que envelhece calado.
 *
 * ⚠️ Critério INFORMADO não tem resolver: o valor vem por ciclo
 * (`criterio_valor_informado`), então **não há distribuição fora de um ciclo**.
 * Devolve `aplicavel: false` com o motivo, em vez de zeros que pareceriam
 * "ninguém se encaixa".
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { localizarFaixa, type Faixa } from '../calculo/faixa.js';
import { obterResolver, resolverRegistrado } from '../calculo/resolvers/registry.js';
import type { DadosColaborador } from '../calculo/resolvers/resolver.types.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';

export interface FaixaComTamanho {
  faixaId: string;
  pessoas: number;
}

export interface ValorSemFaixa {
  valor: string;
  pessoas: number;
}

export interface DistribuicaoDoCriterio {
  aplicavel: boolean;
  motivo: string | null;
  /** Data que ancora os critérios temporais. Hoje, e a tela mostra. */
  dataBase: string;
  /** Quantas pessoas ativas entraram na conta. */
  populacao: number;
  porFaixa: FaixaComTamanho[];
  /** Pessoas cujo valor não cai em faixa nenhuma — a lacuna que a nota esconde. */
  semFaixa: number;
  /** Os valores distintos que ficaram de fora, do mais comum para o menos. */
  valoresSemFaixa: ValorSemFaixa[];
  /** Pessoas sem o dado cadastral. Não é erro de faixa: é cadastro em branco. */
  semDado: number;
}

function hojeAaaammdd(): string {
  const d = new Date();
  return (
    String(d.getUTCFullYear()).padStart(4, '0') +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

function paraAaaammdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

@Injectable()
export class DistribuicaoService {
  constructor(private readonly prisma: PrismaService) {}

  async doCriterio(criterioId: string): Promise<DistribuicaoDoCriterio> {
    const criterio = await this.prisma.criterio.findUniqueOrThrow({
      where: { id: criterioId },
      include: { faixas: { orderBy: { ordem: 'asc' } } },
    });
    const dataBase = hojeAaaammdd();
    const vazio = { dataBase, populacao: 0, porFaixa: [], semFaixa: 0, valoresSemFaixa: [], semDado: 0 };

    if (criterio.origem === 'INFORMADO') {
      return {
        ...vazio,
        aplicavel: false,
        motivo:
          'O valor de um critério INFORMADO é por ciclo, e vem de planilha ou digitação — fora ' +
          'de um ciclo não há o que distribuir.',
      };
    }
    if (!resolverRegistrado(criterio.codigoCalculo)) {
      return {
        ...vazio,
        aplicavel: false,
        motivo: `O cálculo "${criterio.codigoCalculo}" não existe no sistema.`,
      };
    }

    const pessoas = await this.carregarPopulacao();
    const resolver = obterResolver(criterio.codigoCalculo as string);
    const faixas = criterio.faixas.map(paraFaixa);
    const contagem = new Map<string, number>();
    const foraDeFaixa = new Map<string, number>();
    let semDado = 0;
    let semFaixa = 0;

    for (const p of pessoas) {
      const valor = resolver(p, { dataBase, janelaTreinamentoMeses: 12 });
      if (valor.semDado) {
        semDado++;
        continue;
      }
      const faixa = localizarFaixa(faixas, valor);
      if (!faixa) {
        semFaixa++;
        const bruto = valor.valorTexto ?? String(valor.valorNumerico);
        foraDeFaixa.set(bruto, (foraDeFaixa.get(bruto) ?? 0) + 1);
        continue;
      }
      contagem.set(faixa.id, (contagem.get(faixa.id) ?? 0) + 1);
    }

    return {
      aplicavel: true,
      motivo: null,
      dataBase,
      populacao: pessoas.length,
      porFaixa: criterio.faixas.map((f) => ({ faixaId: f.id, pessoas: contagem.get(f.id) ?? 0 })),
      semFaixa,
      valoresSemFaixa: [...foraDeFaixa.entries()]
        .map(([valor, p]) => ({ valor, pessoas: p }))
        .sort((a, b) => b.pessoas - a.pessoas),
      semDado,
    };
  }

  /**
   * A população é a MESMA de todo o resto do módulo (`SITUACOES_ELEGIVEIS`) —
   * "ativo" tem uma definição só, e ela inclui férias e afastados.
   */
  private async carregarPopulacao(): Promise<DadosColaborador[]> {
    const linhas = await this.prisma.colaborador.findMany({
      where: { situacao: { in: [...SITUACOES_ELEGIVEIS] } },
      include: {
        funcaoHistorico: { where: { consideradoNoCalculo: true }, orderBy: { data: 'asc' } },
        treinamentos: { where: { dataFim: { not: null } } },
      },
    });
    return linhas.map((c) => ({
      grauInstrucaoCodigo: c.grauInstrucaoCodigo,
      dataAdmissao: paraAaaammdd(c.dataAdmissao),
      dataUltimaFuncao: c.dataUltimaFuncao ? paraAaaammdd(c.dataUltimaFuncao) : null,
      historicoFuncao: c.funcaoHistorico.map((h) => ({
        data: paraAaaammdd(h.data),
        sequencia: h.sequencia,
        funcaoCodigo: h.funcaoCodigo,
      })),
      treinamentosConcluidos: c.treinamentos.map((t) => paraAaaammdd(t.dataFim as Date)),
    }));
  }
}

function paraFaixa(f: {
  id: string;
  tipo: string;
  limiteInferior: unknown;
  limiteSuperior: unknown;
  inclusivoInf: boolean;
  inclusivoSup: boolean;
  valorDominio: string | null;
  pontuacao: unknown;
  rotulo: string | null;
  ordem: number;
}): Faixa {
  return {
    id: f.id,
    tipo: f.tipo as 'NUMERICA' | 'DOMINIO',
    limiteInferior: f.limiteInferior === null ? null : Number(f.limiteInferior),
    limiteSuperior: f.limiteSuperior === null ? null : Number(f.limiteSuperior),
    inclusivoInf: f.inclusivoInf,
    inclusivoSup: f.inclusivoSup,
    valorDominio: f.valorDominio,
    pontuacao: Number(f.pontuacao),
    rotulo: f.rotulo,
    ordem: f.ordem,
  };
}
