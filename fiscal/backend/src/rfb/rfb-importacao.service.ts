import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { parse as csvParse } from 'csv-parse';
import unzipper from 'unzipper';
import { PrismaRfbService } from '../prisma/prisma-rfb.service.js';
import { RfbWebdavService } from './rfb-webdav.service.js';

// F1.3 — Importação supervisionada da base pública CNPJ.
//
// Pipeline por tabela: WebDAV stream → unzipper (1 entry CSV) → csv-parse
// (latin-1, ';', tolerante) → projeta SÓ colunas essenciais → COPY (formato
// TEXT) em rfb.<t>_staging → índices no staging (nomes _stg_) → swap atômico
// (DROP live + RENAME staging→live + renomeia índices p/ canônico). Sem PK
// constraint (usa UNIQUE INDEX) p/ não colidir nome entre imports mensais.
//
// Import é SEMPRE manual (ADMIN_TI). Lock por status IMPORTANDO. O disco
// real é responsabilidade do roteiro de deploy (decisão Clenio) — aqui só
// logamos o tamanho esperado e travamos execução concorrente.

interface TabelaSpec {
  nome: string;
  arquivos: string[];
  colunas: string[];
  /** raw CSV row (array) → valores na ordem de `colunas` (null = \N). */
  projetar: (r: string[]) => Array<string | null>;
  /** índices a criar no staging: [sufixoNome, definição-de-colunas/USING]. */
  indices: Array<{ suf: string; def: string; unique?: boolean }>;
}

const ESTAB = (i: number) => `Estabelecimentos${i}.zip`;
const EMPRE = (i: number) => `Empresas${i}.zip`;
const norm = (v: string | undefined) => (v == null || v === '' ? null : v);
const numBR = (v: string | undefined) => (v == null || v === '' ? null : v.replace(',', '.'));

const SPECS: Record<string, TabelaSpec> = {
  cnaes: {
    nome: 'cnaes', arquivos: ['Cnaes.zip'], colunas: ['codigo', 'descricao'],
    projetar: (r) => [norm(r[0]), norm(r[1])],
    indices: [{ suf: 'codigo', def: '(codigo)', unique: true }],
  },
  municipios: {
    nome: 'municipios', arquivos: ['Municipios.zip'], colunas: ['codigo', 'descricao'],
    projetar: (r) => [norm(r[0]), norm(r[1])],
    indices: [{ suf: 'codigo', def: '(codigo)', unique: true }],
  },
  naturezas: {
    nome: 'naturezas', arquivos: ['Naturezas.zip'], colunas: ['codigo', 'descricao'],
    projetar: (r) => [norm(r[0]), norm(r[1])],
    indices: [{ suf: 'codigo', def: '(codigo)', unique: true }],
  },
  motivos: {
    nome: 'motivos', arquivos: ['Motivos.zip'], colunas: ['codigo', 'descricao'],
    projetar: (r) => [norm(r[0]), norm(r[1])],
    indices: [{ suf: 'codigo', def: '(codigo)', unique: true }],
  },
  qualificacoes: {
    nome: 'qualificacoes', arquivos: ['Qualificacoes.zip'], colunas: ['codigo', 'descricao'],
    projetar: (r) => [norm(r[0]), norm(r[1])],
    indices: [{ suf: 'codigo', def: '(codigo)', unique: true }],
  },
  paises: {
    nome: 'paises', arquivos: ['Paises.zip'], colunas: ['codigo', 'descricao'],
    projetar: (r) => [norm(r[0]), norm(r[1])],
    indices: [{ suf: 'codigo', def: '(codigo)', unique: true }],
  },
  simples: {
    nome: 'simples', arquivos: ['Simples.zip'],
    colunas: ['cnpj_basico', 'optante_simples', 'data_opcao_simples', 'optante_mei', 'data_exclusao_simples'],
    projetar: (r) => [norm(r[0]), norm(r[1]), norm(r[2]), norm(r[4]), norm(r[3])],
    indices: [{ suf: 'cnpjb', def: '(cnpj_basico)', unique: true }],
  },
  empresas: {
    nome: 'empresas', arquivos: Array.from({ length: 10 }, (_, i) => EMPRE(i)),
    colunas: ['cnpj_basico', 'razao_social', 'natureza_juridica', 'porte', 'capital_social',
      'qualificacao_responsavel', 'ente_federativo'],
    projetar: (r) => [norm(r[0]), norm(r[1]), norm(r[2]), norm(r[5]), numBR(r[4]),
      norm(r[3]), norm(r[6])],
    indices: [
      { suf: 'cnpjb', def: '(cnpj_basico)', unique: true },
      { suf: 'razao_trgm', def: 'USING gin (razao_social gin_trgm_ops)' },
    ],
  },
  estabelecimentos: {
    nome: 'estabelecimentos', arquivos: Array.from({ length: 10 }, (_, i) => ESTAB(i)),
    colunas: ['cnpj_completo', 'cnpj_basico', 'cnpj_ordem', 'cnpj_dv', 'matriz_filial',
      'nome_fantasia', 'situacao_cadastral', 'data_situacao', 'cnae_principal', 'logradouro',
      'numero', 'bairro', 'cep', 'uf', 'municipio', 'ddd1', 'telefone1', 'correio_eletronico',
      'motivo_situacao', 'data_inicio_atividade', 'cnae_secundaria', 'situacao_especial',
      'data_situacao_especial', 'pais'],
    projetar: (r) => [
      (r[0] || '') + (r[1] || '') + (r[2] || ''), norm(r[0]), norm(r[1]), norm(r[2]), norm(r[3]),
      norm(r[4]), norm(r[5]), norm(r[6]), norm(r[11]), norm(r[14]), norm(r[15]), norm(r[17]),
      norm(r[18]), norm(r[19]), norm(r[20]), norm(r[21]), norm(r[22]), norm(r[27]),
      norm(r[7]), norm(r[10]), norm(r[12]), norm(r[28]), norm(r[29]), norm(r[9]),
    ],
    indices: [
      { suf: 'cnpj', def: '(cnpj_completo)', unique: true },
      { suf: 'cnpjb', def: '(cnpj_basico)' },
      { suf: 'sit', def: '(situacao_cadastral)' },
      { suf: 'ufmun', def: '(uf, municipio)' },
      { suf: 'cnae', def: '(cnae_principal)' },
      { suf: 'fant_trgm', def: 'USING gin (nome_fantasia gin_trgm_ops)' },
    ],
  },
  // Camada 3 — QSA. Sem chave natural (vários sócios/CNPJ); índice
  // não-único por cnpj_basico (consultado via $queryRaw). Layout RFB
  // Socios: 0 cnpj_basico · 1 ident_socio · 2 nome/razão · 3 cnpj_cpf ·
  // 4 qualif_socio · 5 data_entrada · 6 país · 7 repr_cpf · 8 repr_nome ·
  // 9 repr_qualif · 10 faixa_etária.
  socios: {
    nome: 'socios', arquivos: Array.from({ length: 10 }, (_, i) => `Socios${i}.zip`),
    colunas: ['cnpj_basico', 'identificador_socio', 'nome_socio', 'cnpj_cpf_socio',
      'qualificacao_socio', 'data_entrada', 'pais', 'repr_legal_cpf', 'repr_legal_nome',
      'repr_legal_qualif', 'faixa_etaria'],
    projetar: (r) => [
      norm(r[0]), norm(r[1]), norm(r[2]), norm(r[3]), norm(r[4]), norm(r[5]),
      norm(r[6]), norm(r[7]), norm(r[8]), norm(r[9]), norm(r[10]),
    ],
    indices: [
      { suf: 'cnpjb', def: '(cnpj_basico)' },
      // Busca reversa por nome do sócio (pessoa → empresas). Recriado a
      // cada import (swap). Índice one-off equivalente já criado na base
      // atual (socios_nome_trgm_idx) p/ funcionar sem esperar o próximo.
      { suf: 'nome_trgm', def: 'USING gin (nome_socio gin_trgm_ops)' },
    ],
  },
};

const ORDEM = ['cnaes', 'municipios', 'naturezas', 'motivos', 'qualificacoes', 'paises',
  'simples', 'empresas', 'estabelecimentos', 'socios'];

function escTexto(v: string | null): string {
  if (v === null) return '\\N';
  // Dados abertos da RFB trazem bytes NUL (0x00) espúrios em campos texto
  // (estabelecimentos: nome_fantasia/logradouro etc. — dado sujo conhecido).
  // O tipo TEXT do Postgres NÃO aceita 0x00 em hipótese alguma → o COPY
  // aborta com 'invalid byte sequence for encoding "UTF8": 0x00' e perde a
  // tabela inteira. Removemos o NUL antes de qualquer escaping (incidente
  // 17/05: import 60M falhou no Estabelecimentos4.zip após 1h46).
  return v
    .replace(/\u0000/g, '')
    .replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

@Injectable()
export class RfbImportacaoService {
  private readonly logger = new Logger(RfbImportacaoService.name);

  constructor(
    private readonly prisma: PrismaRfbService,
    private readonly webdav: RfbWebdavService,
  ) {}

  /** Dispara import (assíncrono). Manual/ADMIN_TI. `tabelas` vazio = todas.
   *  Retorna na hora; acompanhar via rfb.controle_importacao. */
  async iniciar(versao: string | undefined, userId: string, tabelas?: string[]) {
    const versoes = await this.webdav.listarVersoes();
    const alvo = versao || versoes[versoes.length - 1];
    if (!versoes.includes(alvo)) throw new BadRequestException(`Versão ${alvo} não existe na RFB`);

    const emAndamento = await this.prisma.rfbControleImportacao.findFirst({ where: { status: 'IMPORTANDO' } });
    if (emAndamento) throw new ConflictException(`Importação já em andamento (versão ${emAndamento.versaoRfb})`);

    const lista = (tabelas && tabelas.length ? tabelas : ORDEM).filter((t) => SPECS[t]);
    if (lista.length === 0) throw new BadRequestException('Nenhuma tabela válida');

    await this.prisma.rfbControleImportacao.upsert({
      where: { versaoRfb: alvo },
      create: { versaoRfb: alvo, status: 'IMPORTANDO', dataInicio: new Date(), disparadoPor: userId },
      update: { status: 'IMPORTANDO', dataInicio: new Date(), dataFim: null, disparadoPor: userId, observacao: null, totalRegistros: null },
    });

    // Fire-and-forget — não bloqueia o HTTP. Status vai pro DB.
    this.executar(alvo, lista).catch((e) => this.logger.error(`Import ${alvo} falhou: ${e?.message}`));
    return { iniciado: true, versao: alvo, tabelas: lista };
  }

  private async executar(versao: string, tabelas: string[]) {
    const t0 = Date.now();
    let total = 0n;
    // Mapa de progresso p/ o painel (F1.6). status: pendente|rodando|concluida|erro.
    const prog: Record<string, { status: string; linhas: number }> = {};
    for (const t of tabelas) prog[t] = { status: 'pendente', linhas: 0 };
    await this.prisma.rfbControleImportacao
      .update({
        where: { versaoRfb: versao },
        data: {
          progresso: prog, atualizadoEm: new Date(),
          tabelaAtual: null, arquivoAtual: null, arquivosTotal: null, linhasAcumuladas: null,
        },
      })
      .catch(() => undefined);
    let nomeAtual = '';
    try {
      for (const nome of tabelas) {
        nomeAtual = nome;
        const spec = SPECS[nome];
        prog[nome] = { status: 'rodando', linhas: 0 };
        await this.prisma.rfbControleImportacao.update({
          where: { versaoRfb: versao },
          data: {
            tabelaAtual: nome, arquivoAtual: 0, arquivosTotal: spec.arquivos.length,
            linhasAcumuladas: 0n, progresso: prog, atualizadoEm: new Date(),
          },
        });
        const n = await this.importarTabela(versao, spec, async (idx, linhasAcum) => {
          prog[nome] = { status: 'rodando', linhas: linhasAcum };
          await this.prisma.rfbControleImportacao
            .update({
              where: { versaoRfb: versao },
              data: {
                arquivoAtual: idx, linhasAcumuladas: BigInt(linhasAcum),
                progresso: prog, atualizadoEm: new Date(),
              },
            })
            .catch(() => undefined);
        });
        total += BigInt(n);
        prog[nome] = { status: 'concluida', linhas: n };
        await this.prisma.rfbControleImportacao.update({
          where: { versaoRfb: versao },
          data: {
            observacao: `${nome}: ${n.toLocaleString('pt-BR')} linhas`, totalRegistros: total,
            progresso: prog, atualizadoEm: new Date(),
          },
        });
      }
      await this.prisma.rfbControleImportacao.update({
        where: { versaoRfb: versao },
        data: {
          status: 'CONCLUIDO', dataFim: new Date(), totalRegistros: total,
          observacao: `OK (${((Date.now() - t0) / 60000).toFixed(1)} min)`,
          tabelaAtual: null, atualizadoEm: new Date(),
        },
      });
      this.logger.log(`RFB import ${versao} CONCLUIDO — ${total} linhas`);
    } catch (e: any) {
      if (nomeAtual && prog[nomeAtual]) prog[nomeAtual] = { ...prog[nomeAtual], status: 'erro' };
      await this.prisma.rfbControleImportacao
        .update({
          where: { versaoRfb: versao },
          data: {
            status: 'ERRO', dataFim: new Date(),
            observacao: String(e?.message || e).slice(0, 800),
            progresso: prog, atualizadoEm: new Date(),
          },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  /** Carrega 1 tabela (N partições) em staging e faz swap atômico.
   *  Retorna nº de linhas. */
  async importarTabela(
    versao: string,
    spec: TabelaSpec,
    onArquivo?: (idx: number, linhasAcum: number) => Promise<void>,
  ): Promise<number> {
    // Banco DEDICADO da RFB (02/06) — o COPY/staging vai pro capul-db-rfb, não
    // pro capul-db operacional. Mesmo destino do PrismaRfbService.
    const client = new Client({ connectionString: process.env.RFB_DATABASE_URL });
    await client.connect();
    let linhas = 0;
    try {
      const stg = `rfb.${spec.nome}_staging`;
      await client.query(`DROP TABLE IF EXISTS ${stg} CASCADE`);
      await client.query(
        `CREATE TABLE ${stg} (${spec.colunas.map((c) => `"${c}" ${c === 'capital_social' ? 'NUMERIC(18,2)' : 'TEXT'}`).join(', ')})`,
      );

      let i = 0;
      for (const arq of spec.arquivos) {
        linhas += await this.carregarComRetry(client, versao, arq, spec, stg);
        i++;
        this.logger.log(`RFB ${spec.nome}: ${arq} ok (acum ${linhas.toLocaleString('pt-BR')})`);
        if (onArquivo) await onArquivo(i, linhas);
      }

      // Índices no staging (nomes _stg_ → renomeados p/ canônico no swap).
      for (const ix of spec.indices) {
        const kind = ix.def.startsWith('USING') ? '' : '';
        await client.query(
          `CREATE ${ix.unique ? 'UNIQUE ' : ''}INDEX "${spec.nome}_stg_${ix.suf}" ON ${stg} ${kind}${ix.def}`,
        );
      }

      // Swap atômico por-tabela (janela ~0 — rename é instantâneo).
      await client.query('BEGIN');
      await client.query(`DROP TABLE IF EXISTS rfb."${spec.nome}" CASCADE`);
      await client.query(`ALTER TABLE ${stg} RENAME TO "${spec.nome}"`);
      for (const ix of spec.indices) {
        await client.query(`ALTER INDEX rfb."${spec.nome}_stg_${ix.suf}" RENAME TO "${spec.nome}_${ix.suf}_idx"`);
      }
      await client.query('COMMIT');
      return linhas;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /**
   * Retry LIMITADO por arquivo (incidente 18/05: "other side closed" — o
   * Nextcloud da RFB derrubou o stream de um arquivo grande após ~3h e
   * matou o import inteiro). NÃO é caso da regra SEFAZ-em-loop: WebDAV é
   * share público estático benigno (sem certificado/webservice). Cota: 3
   * tentativas, backoff 15s/30s, logado (sem caixa-preta). Seguro: COPY que
   * falha em autocommit faz rollback só dele (zero linha parcial no staging)
   * e abrirStream reabre conexão nova a cada tentativa.
   */
  private async carregarComRetry(
    client: Client, versao: string, arquivo: string, spec: TabelaSpec, stg: string,
  ): Promise<number> {
    const MAX = 3;
    for (let tent = 1; ; tent++) {
      try {
        return await this.carregarArquivo(client, versao, arquivo, spec, stg);
      } catch (e: any) {
        if (tent >= MAX) throw e;
        const espera = tent * 15_000;
        this.logger.warn(
          `RFB ${spec.nome}: ${arquivo} falhou (tent ${tent}/${MAX}: ${String(e?.message || e)}) — retry em ${espera / 1000}s`,
        );
        await new Promise((r) => setTimeout(r, espera));
      }
    }
  }

  /** 1 arquivo .zip → stream WebDAV → unzip → csv-parse → COPY TEXT. */
  private async carregarArquivo(
    client: Client, versao: string, arquivo: string, spec: TabelaSpec, stg: string,
  ): Promise<number> {
    const zipStream = await this.webdav.abrirStream(versao, arquivo);
    const zip = zipStream.pipe(unzipper.Parse({ forceStream: true }));
    let count = 0;

    for await (const entry of zip as any) {
      if (entry.type !== 'File') { entry.autodrain(); continue; }
      const parser = csvParse({
        delimiter: ';', quote: '"', escape: '"', relax_quotes: true,
        relax_column_count: true, skip_records_with_error: true, bom: false,
        encoding: 'latin1' as BufferEncoding,
      });
      const mapper = new Transform({
        objectMode: true,
        transform: (row: string[], _enc, cb) => {
          count++;
          cb(null, spec.projetar(row).map(escTexto).join('\t') + '\n');
        },
      });
      const colsSql = spec.colunas.map((c) => `"${c}"`).join(',');
      const copyStream = client.query(copyFrom(`COPY ${stg} (${colsSql}) FROM STDIN`));
      await pipeline(entry, parser, mapper, copyStream);
      break; // zip da RFB tem 1 entry
    }
    return count;
  }
}
