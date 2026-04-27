import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CccClient, type CccConsultaRaw } from '../sefaz/ccc-client.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { ProtheusCadastroService } from '../protheus/protheus-cadastro.service.js';
import { ReceitaClient, type ReceitaFederalData } from './receita.client.js';
import { DivergenciaService } from './divergencia.service.js';
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
  /** SA1/SA2 são tabelas compartilhadas entre filiais. Endpoint por CNPJ retorna; lista paginada não. */
  filial: string | null;
  codigo: string;
  loja: string;
  bloqueado: boolean;
  razaoSocial?: string | null;
  inscricaoEstadual?: string | null;
  /**
   * UF onde a IE deste vínculo foi emitida (campo `inscUF` do contrato v3
   * Protheus). Usada para decidir quais SEFAZs consultar na auditoria
   * multi-UF — uma IE só pode ser consultada no CCC da própria UF que a
   * emitiu. `null` quando o Protheus não tem IE cadastrada (ex.: consumidor
   * final pessoa física).
   */
  uf: string | null;
}

/**
 * Uma inscrição estadual retornada pelo CCC/SEFAZ. O mesmo CPF/CNPJ pode
 * ter múltiplas (produtor rural com várias propriedades, empresa com
 * filiais na mesma UF). Cada uma vem com seu próprio endereço, situação
 * e regime de apuração — estrutura plana replica o que o CCC devolve.
 */
export interface InscricaoEstadualSefaz {
  inscricaoEstadual: string;
  /** SEFAZ de qual UF retornou esta IE. Crítico na auditoria multi-UF para o operador saber a origem. */
  uf: string;
  situacao: SituacaoCadastral;
  situacaoRaw: string;
  /** `1` (Habilitado) é o estado "ativo". Os outros são variantes de baixa/suspensão. */
  cSit: string | null;
  dataSituacao: string | null;
  dataFimAtividade: string | null;
  inicioAtividade: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnae: string | null;
  regimeApuracao: string | null;
  ieDestinatario: string | null;
  ieDestinatarioCTe: string | null;
  /** IE atual (CCC v4 IEAtual). Geralmente igual à IE consultada — diferente apenas após substituição cadastral. */
  ieAtual: string | null;
  /** Documentos eletrônicos habilitados para esta IE — derivado dos `indCredNFe`/`indCredCTe`. */
  dfeHabilitados: string[];
  endereco: CccConsultaRaw['contribuintes'][number]['endereco'];
}

/**
 * Status de cruzamento de uma IE entre Protheus e SEFAZ.
 * - AMBOS: IE existe nos dois lados (pode ou não ter divergência de atributos)
 * - APENAS_PROTHEUS: IE está no Protheus mas não volta no CCC/SEFAZ —
 *   típico quando a IE foi BAIXADA no SEFAZ e o Protheus não atualizou
 * - APENAS_SEFAZ: IE está no SEFAZ mas não há vínculo Protheus —
 *   cadastro está faltando no ERP, ou IE não foi integrada
 */
export type StatusCruzamentoIe = 'AMBOS' | 'APENAS_PROTHEUS' | 'APENAS_SEFAZ';

/**
 * Linha do cruzamento IE-a-IE. Uma linha por IE distinta da união
 * {IEs Protheus} ∪ {IEs SEFAZ}.
 */
export interface CruzamentoIeProtheusSefaz {
  inscricaoEstadual: string;
  status: StatusCruzamentoIe;
  /** Todos os vínculos Protheus (SA1/SA2, múltiplas lojas) que carregam esta IE. */
  vinculosProtheus: VinculoProtheus[];
  /** Dados da IE conforme o CCC/SEFAZ (null se status=APENAS_PROTHEUS). */
  sefaz: InscricaoEstadualSefaz | null;
  /** Diagnósticos pontuais desta IE (ex: "baixada no SEFAZ mas ativa no Protheus"). */
  alertas: string[];
}

export interface CadastroConsultaPontualResult {
  cnpj: string;
  /**
   * UF "principal" do resultado — a UF da IE habilitada (ou a 1ª da lista de
   * UFs consultadas quando nenhuma é habilitada). Mantido singular por compat
   * com a UI antiga. Para ver TODAS as UFs consultadas, usar `ufsConsultadas`.
   */
  uf: string;

  /** Conjunto de UFs que o backend consultou nesta requisição. Sempre ≥ 1. */
  ufsConsultadas: string[];
  /** UFs que o backend ignorou por exceder o cap de proteção (ver `MAX_UFS_POR_CONSULTA`). */
  ufsIgnoradasPorCap: string[];
  /** UFs consultadas que retornaram erro técnico (timeout, circuit breaker, etc). */
  ufsComFalha: Array<{ uf: string; erro: string }>;

  // ───── Dados da IE PRINCIPAL do SEFAZ (primeira habilitada; ou 1ª da lista) ─────
  // Mantidos para compatibilidade com a UI existente. Para ver TODAS as
  // inscrições, usar `inscricoesSefaz` abaixo.
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

  // ───── TODAS as inscrições do SEFAZ para este CNPJ/CPF nesta UF ─────
  // Produtor rural com várias propriedades, empresa com IEs diferentes
  // por filial — cada uma vem aqui. A `inscricaoEstadual` acima aponta
  // para a IE habilitada (ou primeira se nenhuma habilitada).
  inscricoesSefaz: InscricaoEstadualSefaz[];

  // ───── Cruzamento IE-a-IE Protheus × SEFAZ ─────
  // União dos conjuntos. Permite detectar:
  //   - IEs que ficaram órfãs no Protheus (baixadas no SEFAZ)
  //   - IEs no SEFAZ sem cadastro Protheus
  //   - IEs em ambos (base para divergências de atributos)
  cruzamentoInscricoes: CruzamentoIeProtheusSefaz[];

  // Dados adicionais da Receita Federal (BrasilAPI/ReceitaWS).
  // - null quando: é CPF (APIs públicas não oferecem CPF) OU houve falha técnica.
  // - enriquecimentoReceitaDisponivel=false quando é CPF (usado pelo frontend
  //   para mostrar aviso explicativo, distinguindo de falha técnica).
  dadosReceita: ReceitaFederalData | null;
  enriquecimentoReceitaDisponivel: boolean;
  enriquecimentoReceitaMotivo: string | null;

  // Vínculos Protheus (0, 1 ou N registros)
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
 * Snapshot do registro Protheus usado para comparação com SEFAZ.
 * Representa o estado "em um ponto" — não é persistido aqui (a persistência
 * acontece em `fiscal.cadastro_contribuinte.vinculosProtheus` como JSON).
 */
interface RegistroProtheusSnapshot {
  origem: 'SA1010' | 'SA2010';
  razaoSocial: string | null;
  inscricaoEstadual: string | null;
  cnae: string | null;
  enderecoCep: string | null;
  enderecoMunicipio: string | null;
  uf: string | null;
}

/**
 * Resultado intermediário do `enrichFromProtheus` — distingue "não achou"
 * de "falhou ao consultar".
 */
interface EnriquecimentoProtheus {
  vinculos: VinculoProtheus[];
  registros: RegistroProtheusSnapshot[];
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

  /**
   * Teto de UFs consultadas em uma única requisição. Protege o orçamento
   * diário SEFAZ (2.000/dia) — uma auditoria mal configurada num CNPJ com
   * vínculo em muitas UFs queimaria o orçamento rapidamente. 5 cobre 99%
   * dos casos reais (matriz + 2-4 filiais); acima disso o operador faz
   * consulta individual por UF.
   */
  private static readonly MAX_UFS_POR_CONSULTA = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ccc: CccClient,
    private readonly ambiente: AmbienteService,
    private readonly protheusCadastro: ProtheusCadastroService,
    private readonly receita: ReceitaClient,
    private readonly divergencia: DivergenciaService,
  ) {}

  /**
   * Consulta cadastral pontual com auditoria **multi-UF**.
   *
   * Até 24/04/2026 consultávamos só a UF informada, o que dava falso
   * positivo de cruzamento quando o contribuinte tinha IEs em UFs
   * distintas (uma IE Protheus de SP aparecia como APENAS_PROTHEUS na
   * consulta MG). Agora a ordem é:
   *
   *   1. Consulta Protheus (SA1010 + SA2010) por CNPJ
   *   2. Extrai o conjunto de UFs distintas dos vínculos
   *   3. Une com a UF informada pelo operador (se houver)
   *   4. Aplica cap de `MAX_UFS_POR_CONSULTA`
   *   5. Dispara N consultas SEFAZ em paralelo (Promise.allSettled)
   *      — cada UF é uma chave independente no dedup + circuit breaker
   *   6. Une todos os contribuintes retornados em `inscricoesSefaz[]`
   *      (cada IE carrega a UF da SEFAZ que a retornou)
   *   7. Faz o cruzamento Protheus ↔ SEFAZ (mesma lógica de antes)
   *
   * UF vira opcional: se o CNPJ já tem vínculo Protheus, o sistema deduz
   * as UFs sozinho. Continua obrigatória no caso "novo cadastro" (CNPJ
   * inexistente no Protheus — sem UF, o SEFAZ não tem onde perguntar).
   */
  async consultarPontual(cnpj: string, uf?: string | null): Promise<CadastroConsultaPontualResult> {
    const cnpjDigits = cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14 && cnpjDigits.length !== 11) {
      throw new BadRequestException(`Documento inválido — informe CPF (11 dígitos) ou CNPJ (14 dígitos): ${cnpj}`);
    }

    const ufInformada = uf?.trim().toUpperCase() || null;
    if (ufInformada && !/^[A-Z]{2}$/.test(ufInformada)) {
      throw new BadRequestException(`UF inválida: ${uf}`);
    }

    const ambienteCfg = await this.ambiente.getOrCreate();
    const ambienteStr = ambienteCfg.ambienteAtivo === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';

    // 1) Protheus PRIMEIRO — fonte para descobrir UFs no modo auditoria.
    const enriquecimento = await this.enrichFromProtheus(cnpjDigits);
    const { vinculos } = enriquecimento;

    // 2) Conjunto de UFs candidatas. Prioridade:
    //    a) UFs distintas dos vínculos Protheus (auditoria)
    //    b) UF informada pelo operador (garantia — mesmo que o Protheus
    //       não tenha vínculo naquela UF, pode haver IE no SEFAZ)
    const ufsDoProtheus = [
      ...new Set(vinculos.map((v) => v.uf).filter((u): u is string => !!u)),
    ];
    const ufsCandidatas = [...ufsDoProtheus];
    if (ufInformada && !ufsCandidatas.includes(ufInformada)) {
      ufsCandidatas.push(ufInformada);
    }

    // Sem UF informada e sem Protheus → operador precisa dizer onde procurar.
    if (ufsCandidatas.length === 0) {
      throw new BadRequestException(
        'Informe a UF — este CNPJ ainda não possui vínculo no Protheus, então o sistema não sabe em qual SEFAZ consultar.',
      );
    }

    // 3) Aplica cap de proteção. Ordena Protheus primeiro (mais relevante) +
    //    UF informada ao final (se extra), mantendo as 5 primeiras.
    const ufsParaConsultar = ufsCandidatas.slice(0, CadastroService.MAX_UFS_POR_CONSULTA);
    const ufsIgnoradasPorCap = ufsCandidatas.slice(CadastroService.MAX_UFS_POR_CONSULTA);
    if (ufsIgnoradasPorCap.length > 0) {
      this.logger.warn(
        `CNPJ ${cnpjDigits} tem ${ufsCandidatas.length} UFs distintas — consultando ${ufsParaConsultar.length}, ignorando ${ufsIgnoradasPorCap.join(',')} por cap.`,
      );
    }

    // 4) Consulta SEFAZ em paralelo (allSettled — se uma UF cair, as outras
    //    continuam). Cada UF tem sua própria chave no dedup/circuit breaker.
    const resultados = await Promise.allSettled(
      ufsParaConsultar.map((ufAlvo) =>
        this.ccc.consultarPorCnpj(cnpjDigits, ufAlvo, ambienteStr).then((raw) => ({ uf: ufAlvo, raw })),
      ),
    );

    const ufsComFalha: Array<{ uf: string; erro: string }> = [];
    const contribuintesPorUf: Array<{
      uf: string;
      contribuintes: CccConsultaRaw['contribuintes'];
      cStat: string;
    }> = [];
    resultados.forEach((r, idx) => {
      const ufAlvo = ufsParaConsultar[idx]!;
      if (r.status === 'fulfilled') {
        contribuintesPorUf.push({
          uf: ufAlvo,
          contribuintes: r.value.raw.contribuintes,
          cStat: r.value.raw.cStat,
        });
      } else {
        const mensagem = (r.reason as Error)?.message ?? 'erro desconhecido';
        this.logger.error(`Falha CCC ${cnpjDigits} UF=${ufAlvo}: ${mensagem}`);
        ufsComFalha.push({ uf: ufAlvo, erro: mensagem });
      }
    });

    // Se TODAS as UFs falharam tecnicamente, propaga o primeiro erro (para
    // manter o mapeamento de erros específico — TLS, cert, rate limit etc).
    if (contribuintesPorUf.length === 0 && ufsComFalha.length > 0) {
      const primeiraFalha = resultados.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      if (primeiraFalha) {
        throw this.traduzirErroSefaz(primeiraFalha.reason, ufsParaConsultar[0]!);
      }
    }

    // 5) Une todos os contribuintes de todas as UFs, rotulando cada um com
    //    a UF de origem.
    const inscricoesSefaz: InscricaoEstadualSefaz[] = contribuintesPorUf.flatMap((grupo) =>
      grupo.contribuintes
        .filter((c) => !!c.ie)
        .map((c) => ({
          inscricaoEstadual: c.ie as string,
          uf: grupo.uf,
          situacao: this.mapSituacaoToEnum(c.situacaoCadastral),
          situacaoRaw: c.situacaoCadastral,
          cSit: this.extrairCSit(c.situacaoCadastral),
          dataSituacao: c.dataSituacao ?? null,
          dataFimAtividade: c.dataFimAtividade ?? null,
          inicioAtividade: c.inicioAtividade ?? null,
          razaoSocial: c.razaoSocial ?? null,
          nomeFantasia: c.nomeFantasia ?? null,
          cnae: c.cnae ?? null,
          regimeApuracao: c.regimeApuracao ?? null,
          ieDestinatario: c.ieDestinatario ?? null,
          ieDestinatarioCTe: c.ieDestinatarioCTe ?? null,
          ieAtual: c.ieAtual ?? null,
          dfeHabilitados: c.dfeHabilitados,
          endereco: c.endereco,
        })),
    );

    // 404 se NENHUMA das UFs consultadas retornou contribuinte E nenhuma falhou
    // tecnicamente (diferente de "falhou tudo" tratado acima).
    if (inscricoesSefaz.length === 0 && contribuintesPorUf.every((g) => g.contribuintes.length === 0)) {
      const isCpf = cnpjDigits.length === 11;
      const tipoDoc = isCpf ? 'CPF' : 'CNPJ';
      const ufsTexto = ufsParaConsultar.join(', ');
      const dica = isCpf
        ? ' O cadastro de contribuintes (CCC/Sintegra) contém apenas contribuintes de ICMS (empresas e produtores rurais). CPFs de pessoas físicas comuns geralmente não constam.'
        : '';
      throw new NotFoundException(
        `${tipoDoc} ${cnpjDigits} não encontrado no cadastro de contribuintes da SEFAZ (UF: ${ufsTexto}).${dica}`,
      );
    }

    // Escolhe a IE "principal" para campos legado do response + persistência.
    // 1ª prioridade: HABILITADO; 2ª: 1ª da lista (ordem de retorno das UFs).
    const principal =
      inscricoesSefaz.find((i) => i.situacao === 'HABILITADO') ??
      inscricoesSefaz[0];
    // Determina UF principal e contribuinte bruto dessa UF para os campos
    // legado/persistência. Se o operador informou uma UF, ela tem prioridade
    // como "UF ativa" do response — preserva comportamento antigo.
    const ufPrincipal =
      principal?.uf ?? ufInformada ?? ufsParaConsultar[0]!;
    const grupoPrincipal =
      contribuintesPorUf.find((g) => g.uf === ufPrincipal) ?? contribuintesPorUf[0];
    const contribuinte = grupoPrincipal?.contribuintes[0];
    if (!contribuinte) {
      const ufsTexto = ufsParaConsultar.join(', ');
      throw new NotFoundException(
        `Documento ${cnpjDigits} não encontrado no cadastro de contribuintes da SEFAZ (UF: ${ufsTexto}).`,
      );
    }
    const situacao = principal?.situacao ?? this.mapSituacaoToEnum(contribuinte.situacaoCadastral);

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

    // Upsert uma linha por UF consultada (tabela tem chave composta cnpj_uf).
    // A linha da UF principal é retornada para `persistidoComoId` + histórico.
    const agora = new Date();
    const upserts = await Promise.all(
      contribuintesPorUf.map(async (grupo) => {
        const c = grupo.contribuintes[0];
        if (!c) return null;
        const situacaoGrupo = this.mapSituacaoToEnum(c.situacaoCadastral);
        const existente = await this.prisma.cadastroContribuinte.findUnique({
          where: { cnpj_uf: { cnpj: cnpjDigits, uf: grupo.uf } },
        });
        const atualizado = await this.prisma.cadastroContribuinte.upsert({
          where: { cnpj_uf: { cnpj: cnpjDigits, uf: grupo.uf } },
          create: {
            cnpj: cnpjDigits,
            uf: grupo.uf,
            inscricaoEstadual: c.ie,
            razaoSocial: c.razaoSocial,
            nomeFantasia: c.nomeFantasia,
            cnae: c.cnae,
            regimeTributario: c.regimeApuracao,
            situacao: situacaoGrupo,
            dataInicioAtividade: c.inicioAtividade ? new Date(c.inicioAtividade) : null,
            dataUltimaAtualizacaoCcc: c.dataSituacao ? new Date(c.dataSituacao) : null,
            enderecoLogradouro: c.endereco?.logradouro ?? null,
            enderecoNumero: c.endereco?.numero ?? null,
            enderecoBairro: c.endereco?.bairro ?? null,
            enderecoMunicipio: c.endereco?.municipio ?? null,
            enderecoCep: c.endereco?.cep ?? null,
            vinculosProtheus: vinculosJson,
            ultimaConsultaCccEm: agora,
          },
          update: {
            inscricaoEstadual: c.ie ?? undefined,
            razaoSocial: c.razaoSocial ?? undefined,
            nomeFantasia: c.nomeFantasia ?? undefined,
            cnae: c.cnae ?? undefined,
            regimeTributario: c.regimeApuracao ?? undefined,
            situacao: situacaoGrupo,
            dataUltimaAtualizacaoCcc: c.dataSituacao ? new Date(c.dataSituacao) : undefined,
            enderecoLogradouro: c.endereco?.logradouro ?? undefined,
            enderecoNumero: c.endereco?.numero ?? undefined,
            enderecoBairro: c.endereco?.bairro ?? undefined,
            enderecoMunicipio: c.endereco?.municipio ?? undefined,
            enderecoCep: c.endereco?.cep ?? undefined,
            // Só sobrescreve vínculos Protheus se encontrou algo — não queremos apagar
            // vínculos previamente detectados só porque a última chamada falhou.
            vinculosProtheus: vinculosJson,
            ultimaConsultaCccEm: agora,
          },
        });
        return { grupo, existente, atualizado, situacaoGrupo };
      }),
    );
    const upsertsValidos = upserts.filter(
      (u): u is NonNullable<typeof u> => u !== null,
    );

    // Pega o registro da UF principal para retorno.
    const upsertPrincipal =
      upsertsValidos.find((u) => u.grupo.uf === ufPrincipal) ??
      upsertsValidos[0];
    if (!upsertPrincipal) {
      // Não deveria acontecer — o guard de inscricoesSefaz vazio acima já barrou.
      throw new NotFoundException(`Nenhuma UF retornou dados para ${cnpjDigits}.`);
    }
    const upserted = upsertPrincipal.atualizado;
    const existing = upsertPrincipal.existente;

    // Histórico de mudança de situação — só da UF principal, para evitar
    // poluir o histórico com UFs que o operador não consultou explicitamente.
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
        `Contribuinte ${cnpjDigits} (UF=${ufPrincipal}) mudou de ${existing.situacao} → ${situacao} (detectado via consulta pontual)`,
      );
    }

    // Detecta divergências entre SA1010 e SA2010 (quando existem em ambas)
    const divergenciasEntreTabelas = this.detectarDivergenciasEntreTabelas(vinculos);

    // Cruzamento IE-a-IE Protheus × SEFAZ. Um CPF pode ter várias IEs em
    // uma mesma UF (produtor rural com N propriedades). A crítica é
    // bidirecional: IE só no Protheus (SEFAZ baixou?), IE só no SEFAZ
    // (falta cadastro no Protheus?), IE em ambos (OK — ou com divergência
    // de atributos que a seção divergenciasEntreTabelas já cobre no caso
    // SA1/SA2 de mesma IE).
    const cruzamentoInscricoes = this.cruzarInscricoes(vinculos, inscricoesSefaz);

    // Detecta divergências Protheus × SEFAZ — alimenta a tela /divergencias.
    // Usa o primeiro registro Protheus (se houver em ambas as tabelas, SA1 vs
    // SA2 já é tratado em divergenciasEntreTabelas). Não-bloqueante.
    const primeiroProtheus = enriquecimento.registros[0];
    if (primeiroProtheus) {
      this.divergencia
        .avaliarEgrav(
          upserted.id,
          {
            razaoSocial: primeiroProtheus.razaoSocial,
            inscricaoEstadual: primeiroProtheus.inscricaoEstadual,
            cnae: primeiroProtheus.cnae,
            enderecoCep: primeiroProtheus.enderecoCep,
            enderecoMunicipio: primeiroProtheus.enderecoMunicipio,
          },
          {
            razaoSocial: contribuinte.razaoSocial,
            inscricaoEstadual: contribuinte.ie,
            cnae: contribuinte.cnae,
            enderecoCep: contribuinte.endereco?.cep,
            enderecoMunicipio: contribuinte.endereco?.municipio,
          },
        )
        .catch((err) => {
          this.logger.warn(
            `Falha ao avaliar divergências pontuais para ${cnpjDigits}: ${(err as Error).message}`,
          );
        });
    }

    // Campos legado (compatibilidade): usam a IE PRINCIPAL (habilitada ou 1ª).
    // Para ver todas as IEs da SEFAZ, consumir `inscricoesSefaz` e/ou `cruzamentoInscricoes`.
    const fonte = principal ?? null;
    return {
      cnpj: cnpjDigits,
      uf: ufPrincipal,
      ufsConsultadas: ufsParaConsultar,
      ufsIgnoradasPorCap,
      ufsComFalha,
      situacao,
      razaoSocial: fonte?.razaoSocial ?? contribuinte.razaoSocial ?? null,
      nomeFantasia: fonte?.nomeFantasia ?? contribuinte.nomeFantasia ?? null,
      cnae: fonte?.cnae ?? contribuinte.cnae ?? null,
      inscricaoEstadual: fonte?.inscricaoEstadual ?? contribuinte.ie ?? null,
      endereco: fonte?.endereco ?? contribuinte.endereco,
      inicioAtividade: fonte?.inicioAtividade ?? contribuinte.inicioAtividade ?? null,
      dataSituacao: fonte?.dataSituacao ?? contribuinte.dataSituacao ?? null,
      dataFimAtividade: fonte?.dataFimAtividade ?? contribuinte.dataFimAtividade ?? null,
      regimeApuracao: fonte?.regimeApuracao ?? contribuinte.regimeApuracao ?? null,
      ieDestinatario: fonte?.ieDestinatario ?? contribuinte.ieDestinatario ?? null,
      ieDestinatarioCTe: fonte?.ieDestinatarioCTe ?? contribuinte.ieDestinatarioCTe ?? null,
      inscricoesSefaz,
      cruzamentoInscricoes,
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
      if (resp.itens.length === 0) {
        return { vinculos: [], registros: [], falhou: false };
      }
      // Contrato v3 Protheus (23/04/2026): usa `itens` + campos encurtados
      // (`inscIE`, `razSoc`, `bloquead`, `municip` etc.). Mapeamos para os
      // tipos internos (`VinculoProtheus`, `RegistroProtheusSnapshot`) que
      // continuam usando naming descritivo alinhado com o banco fiscal.
      const vinculos: VinculoProtheus[] = resp.itens.map((r) => ({
        origem: r.origem as 'SA1010' | 'SA2010',
        origemDescricao: r.origem === 'SA1010' ? 'Cliente' : 'Fornecedor',
        filial: r.filial ?? null,
        codigo: r.codigo,
        loja: r.loja,
        bloqueado: r.bloquead,
        razaoSocial: r.razSoc,
        inscricaoEstadual: r.inscIE ?? null,
        // Preferência inscUF (UF de emissão da IE — é o que bate com o CCC).
        // Fallback endereco.uf para registros Protheus antigos sem inscUF.
        uf: (r.inscUF ?? r.endereco?.uf ?? null)?.toUpperCase() ?? null,
      }));
      const registros: RegistroProtheusSnapshot[] = resp.itens.map((r) => ({
        origem: r.origem as 'SA1010' | 'SA2010',
        razaoSocial: r.razSoc ?? null,
        inscricaoEstadual: r.inscIE ?? null,
        cnae: r.cnae ?? null,
        enderecoCep: r.endereco?.cep ?? null,
        enderecoMunicipio: r.endereco?.municip ?? null,
        uf: (r.inscUF ?? r.endereco?.uf ?? null)?.toUpperCase() ?? null,
      }));
      if (vinculos.length > 1) {
        this.logger.log(
          `CNPJ ${cnpj} encontrado em AMBAS as tabelas: SA1010 (${vinculos[0]?.codigo}) e SA2010 (${vinculos[1]?.codigo})`,
        );
      }
      return { vinculos, registros, falhou: false };
    } catch (err) {
      const anyErr = err as { statusCode?: number; body?: { erro?: string } };
      if (anyErr?.statusCode === 404 || anyErr?.body?.erro === 'CNPJ_NAO_ENCONTRADO') {
        this.logger.debug(`CNPJ ${cnpj} não cadastrado no Protheus (SA1/SA2) — novo contribuinte.`);
        return { vinculos: [], registros: [], falhou: false };
      }
      this.logger.warn(`Enriquecimento Protheus falhou tecnicamente para ${cnpj}: ${(err as Error).message}`);
      return { vinculos: [], registros: [], falhou: true };
    }
  }

  /**
   * Traduz erros técnicos da consulta SEFAZ em exceções HTTP específicas,
   * para a UI mostrar mensagens claras ao operador em vez de "Erro interno".
   *
   * Distingue:
   *   - LIMITE_ATINGIDO     → 429 — proteção interna da Capul, não SEFAZ
   *   - CIRCUIT_ABERTO      → 503 — UF específica bloqueada temporariamente
   *   - CERT_INVALIDO       → 503 — problema no certificado A1
   *   - SEFAZ_INDISPONIVEL  → 502 — real falha do web service SEFAZ
   */
  private traduzirErroSefaz(err: unknown, ufUpper: string): HttpException {
    const msg = (err as Error).message ?? '';
    const name = (err as Error).name ?? '';

    // Limite diário global da Capul (Plano v2.0 §6.2 camada 4)
    if (name === 'LimiteDiarioAtingidoException' || msg.includes('Limite Diario Atingido')) {
      return new HttpException(
        {
          erro: 'LIMITE_ATINGIDO',
          mensagem:
            'Limite diário de consultas SEFAZ atingido pela plataforma. Nova tentativa após 00:00. Em emergência, ADMIN_TI pode liberar em Operação → Limites.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Circuit breaker da UF (Plano v2.0 §6.2 camada 3)
    if (name === 'CircuitBreakerOpenError' || msg.includes('Circuit breaker ABERTO') || msg.includes('circuit breaker')) {
      return new HttpException(
        {
          erro: 'CIRCUIT_ABERTO',
          mensagem: `A UF ${ufUpper} está temporariamente bloqueada por excesso de falhas consecutivas no SEFAZ. Tente novamente em alguns minutos.`,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // 1) Cadeia TLS do SERVIDOR SEFAZ desatualizada (nosso Node não conhece a AC
    //    que assinou o cert do servidor). Típico quando alguma UF troca de AC
    //    intermediária e nossa cadeia local (`/app/certs/icp-brasil/`) não tem
    //    a nova. Fix: ADMIN_TI roda refresh em Operação → Diagnóstico → TLS.
    //
    //    NÃO tem relação com o certificado A1 da CAPUL — distinção explícita
    //    adicionada em 23/04/2026 para não induzir o fiscal a revisar o A1 à
    //    toa.
    if (
      msg.includes('unable to get local issuer certificate') ||
      msg.includes('unable to get issuer certificate') ||
      msg.includes('UNABLE_TO_GET_ISSUER_CERT_LOCALLY') ||
      msg.includes('UNABLE_TO_GET_ISSUER_CERT') ||
      msg.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
      msg.includes('SELF_SIGNED_CERT_IN_CHAIN') ||
      msg.includes('DEPTH_ZERO_SELF_SIGNED_CERT')
    ) {
      return new HttpException(
        {
          erro: 'CADEIA_TLS_SERVIDOR_DESATUALIZADA',
          mensagem:
            `Cadeia TLS do SEFAZ de ${ufUpper} não reconhecida pela plataforma ` +
            `(o servidor SEFAZ usa uma AC intermediária que ainda não foi importada). ` +
            'NÃO é problema do certificado A1 da CAPUL. ' +
            'Peça ao ADMIN_TI atualizar a cadeia em Operação → Diagnóstico → Cadeia TLS (botão "Atualizar cadeia") ' +
            'e tente a consulta novamente.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // 2) Problema do nosso certificado CLIENTE A1 (mTLS). Aqui o erro é real
    //    de certificado — expirado, senha errada, ausente, PFX corrompido, etc.
    if (
      msg.includes('certificate expired') ||
      msg.includes('CERT_HAS_EXPIRED') ||
      msg.includes('ERR_OSSL') ||
      msg.includes('bad decrypt') ||
      msg.includes('mTLS') ||
      msg.includes('pfx') ||
      msg.includes('PFX') ||
      msg.includes('certificate unknown') ||
      msg.includes('bad certificate')
    ) {
      return new HttpException(
        {
          erro: 'CERT_INVALIDO',
          mensagem:
            'Problema no certificado digital A1 da CAPUL (cliente mTLS). ' +
            'Verificar no Configurador → Certificado Fiscal se há certificado ativo, ' +
            'dentro da validade e com a senha correta.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Timeout / rede
    if (
      msg.includes('timeout') ||
      msg.includes('Timeout') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('other side closed') ||
      name === 'ConnectTimeoutError' ||
      name === 'SocketError'
    ) {
      return new HttpException(
        {
          erro: 'SEFAZ_INDISPONIVEL',
          mensagem: `SEFAZ de ${ufUpper} não respondeu a tempo. Tente novamente em alguns minutos.`,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Default — erro genérico do SEFAZ (cStat inesperado, XML inválido, etc.)
    return new HttpException(
      {
        erro: 'SEFAZ_INDISPONIVEL',
        mensagem: `Não foi possível consultar o SEFAZ de ${ufUpper}. ${msg.slice(0, 200)}`,
      },
      HttpStatus.BAD_GATEWAY,
    );
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

  /**
   * Deduz `cSit` (código da situação no XML CCC) a partir do texto mapeado.
   * Mantém a mesma ordem do `mapSituacao` do `CccClient`.
   */
  private extrairCSit(situacaoRaw: string): string | null {
    const s = situacaoRaw.toUpperCase();
    if (s.includes('HABILITADO') && !s.includes('NÃO') && !s.includes('NAO')) return '1';
    if (s.includes('NÃO HABILITADO') || s.includes('NAO HABILITADO')) return '0';
    if (s.includes('SUSPENSO')) return '2';
    if (s.includes('INAPTO')) return '3';
    if (s.includes('BAIXADO') || s.includes('BAIXA')) return '4';
    return null;
  }

  /**
   * Cruza o conjunto de IEs do Protheus com o conjunto de IEs do SEFAZ.
   *
   * Fluxo:
   *  1. Normaliza cada IE (remove não-dígitos, uppercase) para comparar.
   *  2. Indexa vínculos Protheus por IE normalizada (pode ter múltiplos
   *     vínculos para a mesma IE — SA1010+SA2010, ou várias lojas).
   *  3. Indexa IEs SEFAZ por IE normalizada.
   *  4. Faz a união e produz uma linha por IE distinta com status.
   *
   * Cobre o caso reportado pelo setor fiscal (24/04/2026): IE ativa no
   * Protheus que já foi BAIXADA no SEFAZ deve aparecer aqui — pra crítica
   * poder detectar e o operador regularizar o ERP.
   */
  private cruzarInscricoes(
    vinculosProtheus: VinculoProtheus[],
    inscricoesSefaz: InscricaoEstadualSefaz[],
  ): CruzamentoIeProtheusSefaz[] {
    const normalizar = (ie: string | null | undefined): string =>
      (ie ?? '').replace(/\D/g, '').toUpperCase();

    // Protheus: IE normalizada → lista de vínculos que carregam essa IE.
    const protheusPorIe = new Map<string, VinculoProtheus[]>();
    for (const v of vinculosProtheus) {
      const ie = normalizar(v.inscricaoEstadual);
      if (!ie) continue;
      const lista = protheusPorIe.get(ie) ?? [];
      lista.push(v);
      protheusPorIe.set(ie, lista);
    }

    // SEFAZ: IE normalizada → dados (1 por IE; SEFAZ não duplica).
    const sefazPorIe = new Map<string, InscricaoEstadualSefaz>();
    for (const s of inscricoesSefaz) {
      const ie = normalizar(s.inscricaoEstadual);
      if (ie) sefazPorIe.set(ie, s);
    }

    const ies = new Set<string>([...protheusPorIe.keys(), ...sefazPorIe.keys()]);
    const cruzamento: CruzamentoIeProtheusSefaz[] = [];

    for (const ie of ies) {
      const vinculos = protheusPorIe.get(ie) ?? [];
      const sefaz = sefazPorIe.get(ie) ?? null;
      const temProtheus = vinculos.length > 0;
      const temSefaz = sefaz !== null;

      const status: StatusCruzamentoIe = temProtheus && temSefaz
        ? 'AMBOS'
        : temProtheus
          ? 'APENAS_PROTHEUS'
          : 'APENAS_SEFAZ';

      const alertas: string[] = [];
      if (status === 'APENAS_PROTHEUS') {
        alertas.push('IE cadastrada no Protheus mas ausente no CCC/SEFAZ — pode ter sido baixada no SEFAZ e o Protheus não foi atualizado.');
      } else if (status === 'APENAS_SEFAZ') {
        alertas.push('IE ativa no CCC/SEFAZ mas sem vínculo no Protheus — cadastro no ERP pode estar faltando.');
      } else if (status === 'AMBOS' && sefaz) {
        // IE nos dois lados. Detectar conflitos de situação:
        //   SEFAZ=BAIXADO + Protheus com algum vínculo não bloqueado → alerta crítico
        const sefazInativa = sefaz.situacao === 'BAIXADO' || sefaz.situacao === 'NAO_HABILITADO';
        const algumVinculoAtivo = vinculos.some((v) => !v.bloqueado);
        if (sefazInativa && algumVinculoAtivo) {
          alertas.push(`Situação no SEFAZ é ${sefaz.situacao} mas há vínculo(s) Protheus ativos (não bloqueados). Bloquear no ERP.`);
        }
        // SEFAZ HABILITADO + todos Protheus bloqueados → alerta inverso
        if (sefaz.situacao === 'HABILITADO' && vinculos.every((v) => v.bloqueado)) {
          alertas.push('Situação no SEFAZ é HABILITADO mas todos os vínculos Protheus estão bloqueados. Reativar no ERP se apropriado.');
        }
      }

      const inscricaoIdentificavel = sefaz?.inscricaoEstadual
        ?? vinculos[0]?.inscricaoEstadual
        ?? ie;

      cruzamento.push({
        inscricaoEstadual: inscricaoIdentificavel as string,
        status,
        vinculosProtheus: vinculos,
        sefaz,
        alertas,
      });
    }

    // Ordena: primeiro AMBOS, depois APENAS_PROTHEUS (crítico), depois APENAS_SEFAZ.
    const ordemStatus: Record<StatusCruzamentoIe, number> = {
      AMBOS: 1,
      APENAS_PROTHEUS: 2,
      APENAS_SEFAZ: 3,
    };
    cruzamento.sort((a, b) => {
      if (a.status !== b.status) return ordemStatus[a.status] - ordemStatus[b.status];
      return a.inscricaoEstadual.localeCompare(b.inscricaoEstadual);
    });
    return cruzamento;
  }
}
