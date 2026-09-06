/**
 * Fonte CSV — a carga do piloto, autorizada pela especificação §5.1.
 *
 * Três arquivos num diretório (`RH_CSV_DIR`), extraídos do Protheus por SELECT:
 *
 *   colaboradores.csv     SRA010 + SX5010 (tabela 26)
 *   historico_funcao.csv  SR7010
 *   treinamentos.csv      RA4010
 *
 * O SQL de extração está em docs/SYNC_GESTAO_PESSOAS_CSV.md. Os nomes de coluna
 * são lidos do cabeçalho, então a ordem não importa.
 *
 * ⭐ SOMENTE LEITURA: esta classe abre arquivo e devolve linha. Não fala com o
 * Protheus e não tem como escrever nele.
 */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { lerCsv, obrigatorio, opcional, type LinhaCsv } from './csv.js';
import type {
  ColaboradorDaFonte,
  FonteColaboradores,
  HistoricoDaFonte,
  TreinamentoDaFonte,
} from './fonte.port.js';

@Injectable()
export class FonteCsvService implements FonteColaboradores {
  private readonly logger = new Logger(FonteCsvService.name);
  private readonly diretorio = process.env.RH_CSV_DIR ?? '/app/carga';

  readonly descricao = `CSV (${process.env.RH_CSV_DIR ?? '/app/carga'})`;

  async lerColaboradores(): Promise<ColaboradorDaFonte[]> {
    return (await this.abrir('colaboradores.csv')).map((l, i) => {
      const onde = `colaboradores.csv linha ${i + 2}`;
      return {
        filial: obrigatorio(l, 'filial', onde),
        matricula: obrigatorio(l, 'matricula', onde),
        nome: obrigatorio(l, 'nome', onde),
        cpf: opcional(l, 'cpf'),
        centroCusto: opcional(l, 'centro_custo'),
        centroCustoDescricao: opcional(l, 'centro_custo_descricao'),
        cargoCodigo: opcional(l, 'cargo_codigo'),
        cargoDescricao: opcional(l, 'cargo_descricao'),
        // Sem `obrigatorio`: a linha sem admissão é recusada com motivo pelo
        // mapeamento, e o relatório do sync mostra quem é. Estourar aqui
        // derrubaria o arquivo inteiro por causa de uma linha.
        dataAdmissao: (l.data_admissao ?? '').trim(),
        dataDemissao: opcional(l, 'data_demissao'),
        situacaoFolha: opcional(l, 'situacao_folha'),
        categoriaFuncional: opcional(l, 'categoria_funcional'),
        grauInstrucaoCodigo: opcional(l, 'grau_instrucao_codigo'),
        grauInstrucaoDescricao: opcional(l, 'grau_instrucao_descricao'),
        descricaoFuncao: opcional(l, 'descricao_funcao'),
      };
    });
  }

  async lerHistoricoFuncional(): Promise<HistoricoDaFonte[]> {
    return (await this.abrir('historico_funcao.csv')).map((l, i) => {
      const onde = `historico_funcao.csv linha ${i + 2}`;
      const recno = opcional(l, 'recno_origem');
      return {
        filial: obrigatorio(l, 'filial', onde),
        matricula: obrigatorio(l, 'matricula', onde),
        // Sem `obrigatorio`: há 99 lançamentos sem data no SR7010 da Capul.
        // Quem separa e conta é `separarUtilizaveis`; estourar aqui derrubaria
        // as outras 29.782 linhas por causa delas.
        data: (l.data ?? '').trim(),
        sequencia: opcional(l, 'sequencia') ?? '1',
        funcaoCodigo: obrigatorio(l, 'funcao_codigo', onde),
        funcaoDescricao: opcional(l, 'funcao_descricao'),
        tipo: opcional(l, 'tipo'),
        recnoOrigem: recno ? Number(recno) : null,
      };
    });
  }

  async lerTreinamentos(): Promise<TreinamentoDaFonte[]> {
    return (await this.abrir('treinamentos.csv')).map((l, i) => {
      const onde = `treinamentos.csv linha ${i + 2}`;
      const horas = opcional(l, 'carga_horaria');
      return {
        filial: obrigatorio(l, 'filial', onde),
        matricula: obrigatorio(l, 'matricula', onde),
        descricao: opcional(l, 'descricao') ?? opcional(l, 'curso') ?? '(sem descrição)',
        dataInicio: (l.data_inicio ?? '').trim(),
        dataFim: opcional(l, 'data_fim'),
        cargaHoraria: horas ? Number(horas) : null,
      };
    });
  }

  private async abrir(arquivo: string): Promise<LinhaCsv[]> {
    const caminho = path.join(this.diretorio, arquivo);
    try {
      const conteudo = await fs.readFile(caminho, 'utf8');
      const linhas = lerCsv(conteudo);
      this.logger.log(`${arquivo}: ${linhas.length} linhas`);
      return linhas;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // Arquivo ausente é diferente de arquivo vazio. Dizer o caminho poupa a
        // primeira meia hora de quem for rodar a carga.
        throw new Error(
          `Arquivo da carga não encontrado: ${caminho}. ` +
            'Gere os três CSV conforme docs/SYNC_GESTAO_PESSOAS_CSV.md e ' +
            'aponte RH_CSV_DIR para o diretório deles.',
        );
      }
      throw e;
    }
  }
}
