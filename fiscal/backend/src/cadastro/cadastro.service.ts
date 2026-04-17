import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CccClient, type CccConsultaRaw } from '../sefaz/ccc-client.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { ProtheusCadastroService } from '../protheus/protheus-cadastro.service.js';
import { ReceitaClient, type ReceitaFederalData } from './receita.client.js';
import type {
  CadastroContribuinte,
  SituacaoCadastral,
  TipoCadastroProtheus,
} from '@prisma/client';

/**
 * Um vínculo individual com SA1010 ou SA2010 do Protheus.
 * Um CNPJ pode ter 0, 1 ou 2 vínculos (é cliente e fornecedor ao mesmo tempo).
 */
export interface VinculoProtheus {
  origem: 'SA1010' | 'SA2010';
  origemDescricao: 'Cliente' | 'Fornecedor';
  filial: string;
  codigo: string;
  loja: string;
  bloqueado: boolean;
  razaoSocial?: string | null;
  inscricaoEstadual?: string | null;
}

export interface CadastroConsultaPontualResult {
  cnpj: string;
  uf: string;

  // Dados do SEFAZ (fonte de verdade)
  situacao: SituacaoCadastral;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnae: string | null;
  inscricaoEstadual: string | null;
  endereco: CccConsultaRaw['contribuintes'][number]['endereco'];
  inicioAtividade: string | null;
  dataSituacao: string | null;
  dataFimAtividade: string | null;
  regimeApuracao: string | null;
  ieDestinatario: string | null;
  ieDestinatarioCTe: string | null;

  // Dados adicionais da Receita Federal (BrasilAPI/ReceitaWS).
  // - null quando: é CPF (APIs públicas não oferecem CPF) OU houve falha técnica.
  // - enriquecimentoReceitaDisponivel=false quando é CPF (usado pelo frontend
  //   para mostrar aviso explicativo, distinguindo de falha técnica).
  dadosReceita: ReceitaFederalData | null;
  enriquecimentoReceitaDisponivel: boolean;
  enriquecimentoReceitaMotivo: string | null;

  // Vínculos Protheus (0, 1 ou 2 registros)
  jaCadastradoNoProtheus: boolean;
  enriquecimentoProtheusFalhou: boolean;
  vinculosProtheus: VinculoProtheus[];

  // Divergências entre SA1010 e SA2010 (quando existe em ambas)
  divergenciasEntreTabelas: Array<{
    campo: string;
    valorSA1010: string | null;
    valorSA2010: string | null;
  }>;

  persistidoComoId: string;
  mudouSituacao: boolean;
  situacaoAnterior: SituacaoCadastral | null;
}

/**
 * Resultado intermediário do `enrichFromProtheus` — distingue "não achou"
 * de "falhou ao consultar".
 */
interface EnriquecimentoProtheus {
  vinculos: VinculoProtheus[];
  falhou: boolean;
}

/**
 * CadastroService — Etapa 11 da Onda 1 (consulta cadastral pontual).
 *
 * **Dois use cases** suportados pelo mesmo endpoint:
 *
 * A) **Validação de novo cadastro** (uso diário do Setor Fiscal — motivação
 *    original do módulo): antes de cadastrar um novo cliente ou fornecedor no
 *    Protheus, o operador consulta o CNPJ aqui. Recebe os dados oficiais
 *    do SEFAZ (situação cadastral, razão social, IE, endereço, CNAE) para
 *    preencher o cadastro do ERP. O enriquecimento Protheus vai retornar
 *    `jaCadastradoNoProtheus=false` — é esperado.
 *
 * B) **Verificação de contribuinte existente**: o operador quer validar o
 *    status atual de um cliente/fornecedor já cadastrado. O enriquecimento
 *    retorna `jaCadastradoNoProtheus=true` com filial/código/loja,
 *    permitindo à UI mostrar o vínculo.
 *
 * Fluxo:
 *   1. Valida CNPJ + UF
 *   2. Chama CccClient.consultarPorCnpj (fonte de verdade — SEFAZ)
 *   3. Enriquecimento best-effort via ProtheusCadastroService (pode falhar
 *      ou retornar vazio sem bloquear o fluxo)
 *   4. Upsert em fiscal.cadastro_contribuinte — registra o contribuinte
 *      mesmo quando novo, o que permite histórico a partir do ponto zero
 *   5. Se mudou situação em relação ao registro anterior, grava em
 *      fiscal.cadastro_historico
 *
 * @TODO Onda 2: divergências (comparar valores Protheus ↔ SEFAZ em lote).
 */
@Injectable()
export class CadastroService {
  private readonly logger = new Logger(CadastroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ccc: CccClient,
    private readonly ambiente: AmbienteService,
    private readonly protheusCadastro: ProtheusCadastroService,
    private readonly receita: ReceitaClient,
  ) {}

  async consultarPontual(cnpj: string, uf: string): Promise<CadastroConsultaPontualResult> {
    const cnpjDigits = cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14 && cnpjDigits.length !== 11) {
      throw new BadRequestException(`Documento inválido — informe CPF (11 dígitos) ou CNPJ (14 dígitos): ${cnpj}`);
    }
    if (!/^[A-Z]{2}$/.test(uf.toUpperCase())) {
      throw new BadRequestException(`UF inválida: ${uf}`);
    }
    const ufUpper = uf.toUpperCase();

    const ambienteCfg = await this.ambiente.getOrCreate();
    const ambienteStr = ambienteCfg.ambienteAtivo === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';

    let raw;
    try {
      raw = await this.ccc.consultarPorCnpj(cnpjDigits, ufUpper, ambienteStr);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Falha na consulta CCC para ${cnpjDigits} UF=${ufUpper}: ${msg}`);
      throw new BadRequestException({
        erro: 'SEFAZ_INDISPONIVEL',
        mensagem: `Não foi possível consultar o SEFAZ de ${ufUpper}. ${msg}`,
      });
    }

    if (raw.contribuintes.length === 0) {
      const isCpf = cnpjDigits.length === 11;
      const tipoDoc = isCpf ? 'CPF' : 'CNPJ';
      const dica = isCpf
        ? ' O cadastro de contribuintes (CCC/Sintegra) contém apenas contribuintes de ICMS (empresas e produtores rurais). CPFs de pessoas físicas comuns geralmente não constam.'
        : '';
      throw new NotFoundException(
        `${tipoDoc} ${cnpjDigits} não encontrado no cadastro de contribuintes da SEFAZ ${ufUpper}.${dica} (cStat=${raw.cStat})`,
      );
    }

    const contribuinte = raw.contribuintes[0];
    if (!contribuinte) {
      throw new NotFoundException(
        `Documento ${cnpjDigits} nao encontrado no cadastro de contribuintes da SEFAZ ${ufUpper}.`,
      );
    }
    const situacao = this.mapSituacaoToEnum(contribuinte.situacaoCadastral);

    // Enriquecimento Protheus (best effort — retorna 0, 1 ou 2 vínculos)
    const enriquecimento = await this.enrichFromProtheus(cnpjDigits);
    const { vinculos } = enriquecimento;

    // Enriquecimento Receita Federal (BrasilAPI/ReceitaWS) — só para CNPJ.
    // CPFs não são suportados por nenhuma API pública gratuita.
    let dadosReceita: ReceitaFederalData | null = null;
    let enriquecimentoReceitaDisponivel = false;
    let enriquecimentoReceitaMotivo: string | null = null;
    const isCpf = cnpjDigits.length === 11;
    if (isCpf) {
      enriquecimentoReceitaMotivo =
        'Enriquecimento via Receita Federal não disponível para CPF. ' +
        'As APIs públicas gratuitas (BrasilAPI, ReceitaWS) atendem apenas CNPJ. ' +
        'Para dados completos de CPF, seria necessário contratar a API Serpro (paga).';
    } else {
      try {
        dadosReceita = await this.receita.consultarCnpj(cnpjDigits);
        if (dadosReceita) {
          enriquecimentoReceitaDisponivel = true;
        } else {
          enriquecimentoReceitaMotivo =
            'Receita Federal não retornou dados para este CNPJ (pode estar temporariamente indisponível).';
        }
      } catch (err) {
        this.logger.warn(
          `Enriquecimento Receita falhou para ${cnpjDigits}: ${(err as Error).message}`,
        );
        enriquecimentoReceitaMotivo =
          'Falha técnica ao consultar a Receita Federal. Os dados da SEFAZ continuam válidos.';
      }
    }

    // Cast para Prisma JsonValue — Prisma exige primitivos ou InputJsonObject/Array
    const vinculosJson = vinculos.length > 0
      ? (JSON.parse(JSON.stringify(vinculos)) as object[])
      : undefined;

    // Upsert
    const existing = await this.prisma.cadastroContribuinte.findUnique({
      where: { cnpj_uf: { cnpj: cnpjDigits, uf: ufUpper } },
    });
    const upserted = await this.prisma.cadastroContribuinte.upsert({
      where: { cnpj_uf: { cnpj: cnpjDigits, uf: ufUpper } },
      create: {
        cnpj: cnpjDigits,
        uf: ufUpper,
        inscricaoEstadual: contribuinte.ie,
        razaoSocial: contribuinte.razaoSocial,
        nomeFantasia: contribuinte.nomeFantasia,
        cnae: contribuinte.cnae,
        regimeTributario: contribuinte.regimeApuracao,
        situacao,
        dataInicioAtividade: contribuinte.inicioAtividade ? new Date(contribuinte.inicioAtividade) : null,
        dataUltimaAtualizacaoCcc: contribuinte.dataSituacao ? new Date(contribuinte.dataSituacao) : null,
        enderecoLogradouro: contribuinte.endereco?.logradouro ?? null,
        enderecoNumero: contribuinte.endereco?.numero ?? null,
        enderecoBairro: contribuinte.endereco?.bairro ?? null,
        enderecoMunicipio: contribuinte.endereco?.municipio ?? null,
        enderecoCep: contribuinte.endereco?.cep ?? null,
        vinculosProtheus: vinculosJson,
        ultimaConsultaCccEm: new Date(),
      },
      update: {
        inscricaoEstadual: contribuinte.ie ?? undefined,
        razaoSocial: contribuinte.razaoSocial ?? undefined,
        nomeFantasia: contribuinte.nomeFantasia ?? undefined,
        cnae: contribuinte.cnae ?? undefined,
        regimeTributario: contribuinte.regimeApuracao ?? undefined,
        situacao,
        dataUltimaAtualizacaoCcc: contribuinte.dataSituacao ? new Date(contribuinte.dataSituacao) : undefined,
        enderecoLogradouro: contribuinte.endereco?.logradouro ?? undefined,
        enderecoNumero: contribuinte.endereco?.numero ?? undefined,
        enderecoBairro: contribuinte.endereco?.bairro ?? undefined,
        enderecoMunicipio: contribuinte.endereco?.municipio ?? undefined,
        enderecoCep: contribuinte.endereco?.cep ?? undefined,
        // Só sobrescreve vínculos Protheus se encontrou algo — não queremos apagar
        // vínculos previamente detectados só porque a última chamada falhou.
        vinculosProtheus: vinculosJson,
        ultimaConsultaCccEm: new Date(),
      },
    });

    // Histórico de mudança de situação
    const mudouSituacao = existing ? existing.situacao !== situacao : false;
    if (mudouSituacao && existing) {
      await this.prisma.cadastroHistorico.create({
        data: {
          contribuinteId: upserted.id,
          situacaoAnterior: existing.situacao,
          situacaoNova: situacao,
        },
      });
      this.logger.warn(
        `Contribuinte ${cnpjDigits} mudou de ${existing.situacao} → ${situacao} (detectado via consulta pontual)`,
      );
    }

    // Detecta divergências entre SA1010 e SA2010 (quando existem em ambas)
    const divergenciasEntreTabelas = this.detectarDivergenciasEntreTabelas(vinculos);

    return {
      cnpj: cnpjDigits,
      uf: ufUpper,
      situacao,
      razaoSocial: contribuinte.razaoSocial ?? null,
      nomeFantasia: contribuinte.nomeFantasia ?? null,
      cnae: contribuinte.cnae ?? null,
      inscricaoEstadual: contribuinte.ie ?? null,
      endereco: contribuinte.endereco,
      inicioAtividade: contribuinte.inicioAtividade ?? null,
      dataSituacao: contribuinte.dataSituacao ?? null,
      dataFimAtividade: contribuinte.dataFimAtividade ?? null,
      regimeApuracao: contribuinte.regimeApuracao ?? null,
      ieDestinatario: contribuinte.ieDestinatario ?? null,
      ieDestinatarioCTe: contribuinte.ieDestinatarioCTe ?? null,
      jaCadastradoNoProtheus: vinculos.length > 0,
      enriquecimentoProtheusFalhou: enriquecimento.falhou,
      vinculosProtheus: vinculos,
      divergenciasEntreTabelas,
      dadosReceita,
      enriquecimentoReceitaDisponivel,
      enriquecimentoReceitaMotivo,
      persistidoComoId: upserted.id,
      mudouSituacao,
      situacaoAnterior: existing?.situacao ?? null,
    };
  }

  async getPorCnpj(cnpj: string): Promise<CadastroContribuinte[]> {
    const cnpjDigits = cnpj.replace(/\D/g, '');
    return this.prisma.cadastroContribuinte.findMany({
      where: { cnpj: cnpjDigits },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getHistorico(cnpj: string): Promise<any> {
    const cnpjDigits = cnpj.replace(/\D/g, '');
    const contrib = await this.prisma.cadastroContribuinte.findFirst({
      where: { cnpj: cnpjDigits },
      include: {
        historico: { orderBy: { detectadoEm: 'desc' } },
      },
    });
    if (!contrib) {
      throw new NotFoundException(`Contribuinte ${cnpjDigits} não encontrado em fiscal.cadastro_contribuinte.`);
    }
    return contrib;
  }

  /**
   * Tenta enriquecer o retorno CCC com dados do Protheus (SA1010 e/ou SA2010).
   *
   * O endpoint `GET /cadastroFiscal/{cnpj}` do Protheus (Especificação API v2.0
   * §3.4) retorna um array de registros com campo `origem` indicando
   * `SA1010` ou `SA2010`. Um CNPJ pode retornar 2 registros quando a empresa
   * é simultaneamente cliente e fornecedor.
   *
   * Retorna:
   *   - `{ vinculos: [...], falhou: false }` — 0, 1 ou 2 registros encontrados.
   *   - `{ vinculos: [],    falhou: true  }` — erro técnico (API fora do ar).
   */
  private async enrichFromProtheus(cnpj: string): Promise<EnriquecimentoProtheus> {
    try {
      const resp = await this.protheusCadastro.porCnpj(cnpj);
      if (resp.registros.length === 0) {
        return { vinculos: [], falhou: false };
      }
      const vinculos: VinculoProtheus[] = resp.registros.map((r) => ({
        origem: r.origem as 'SA1010' | 'SA2010',
        origemDescricao: r.origem === 'SA1010' ? 'Cliente' : 'Fornecedor',
        filial: r.filial,
        codigo: r.codigo,
        loja: r.loja,
        bloqueado: r.bloqueado,
        razaoSocial: r.razaoSocial,
        inscricaoEstadual: r.inscricaoEstadual ?? null,
      }));
      if (vinculos.length > 1) {
        this.logger.log(
          `CNPJ ${cnpj} encontrado em AMBAS as tabelas: SA1010 (${vinculos[0]?.codigo}) e SA2010 (${vinculos[1]?.codigo})`,
        );
      }
      return { vinculos, falhou: false };
    } catch (err) {
      const anyErr = err as { statusCode?: number; body?: { erro?: string } };
      if (anyErr?.statusCode === 404 || anyErr?.body?.erro === 'CNPJ_NAO_ENCONTRADO') {
        this.logger.debug(`CNPJ ${cnpj} não cadastrado no Protheus (SA1/SA2) — novo contribuinte.`);
        return { vinculos: [], falhou: false };
      }
      this.logger.warn(`Enriquecimento Protheus falhou tecnicamente para ${cnpj}: ${(err as Error).message}`);
      return { vinculos: [], falhou: true };
    }
  }

  /**
   * Quando o CNPJ existe em SA1010 E SA2010, compara os campos que deviam
   * ser iguais e retorna as divergências. Isso ajuda o Setor Fiscal a
   * identificar cadastros inconsistentes que precisam ser corrigidos no ERP.
   */
  private detectarDivergenciasEntreTabelas(
    vinculos: VinculoProtheus[],
  ): CadastroConsultaPontualResult['divergenciasEntreTabelas'] {
    if (vinculos.length < 2) return [];
    const sa1 = vinculos.find((v) => v.origem === 'SA1010');
    const sa2 = vinculos.find((v) => v.origem === 'SA2010');
    if (!sa1 || !sa2) return [];

    const divergencias: CadastroConsultaPontualResult['divergenciasEntreTabelas'] = [];
    const comparar = (campo: string, v1: string | null | undefined, v2: string | null | undefined) => {
      const n1 = (v1 ?? '').trim().toUpperCase();
      const n2 = (v2 ?? '').trim().toUpperCase();
      if (n1 !== n2) {
        divergencias.push({ campo, valorSA1010: v1 ?? null, valorSA2010: v2 ?? null });
      }
    };

    comparar('Razão social', sa1.razaoSocial, sa2.razaoSocial);
    comparar('Inscrição estadual', sa1.inscricaoEstadual, sa2.inscricaoEstadual);
    comparar('Bloqueado', String(sa1.bloqueado), String(sa2.bloqueado));

    return divergencias;
  }

  private mapSituacaoToEnum(raw: string): SituacaoCadastral {
    const normalized = raw.toUpperCase();
    if (normalized.includes('HABILITADO') && !normalized.includes('NÃO')) return 'HABILITADO';
    if (normalized.includes('NÃO HABILITADO') || normalized.includes('NAO HABILITADO')) return 'NAO_HABILITADO';
    if (normalized.includes('SUSPENSO')) return 'SUSPENSO';
    if (normalized.includes('INAPTO')) return 'INAPTO';
    if (normalized.includes('BAIXADO') || normalized.includes('BAIXA')) return 'BAIXADO';
    return 'DESCONHECIDO';
  }
}
