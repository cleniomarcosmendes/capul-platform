import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateNotaFiscalDto, UpdateNotaFiscalDto } from '../dto/create-nota-fiscal.dto.js';
import { FiscalNfeClient, FiscalConsultaRetorno } from './fiscal-nfe.client.js';
import { resolveDepartamento } from '../../common/helpers/resolve-departamento.helper.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import * as path from 'path';
import * as fs from 'fs';

const NF_INCLUDE = {
  fornecedor: true,
  filial: true,
  criadoPor: { select: { id: true, nome: true, username: true } },
  equipe: { select: { id: true, nome: true, sigla: true, cor: true } },
  itens: {
    include: {
      produto: { include: { tipoProduto: true } },
      centroCusto: true,
      projeto: { select: { id: true, numero: true, nome: true } },
    },
    orderBy: { produto: { descricao: 'asc' as const } },
  },
  // Audit log de chave NF-e (14/05/2026). Ordenado mais recente primeiro
  // pra UI exibir a última alteração no topo.
  chaveHistorico: {
    include: { alteradoPor: { select: { id: true, nome: true, username: true } } },
    orderBy: { alteradoEm: 'desc' as const },
  },
};

/**
 * Valida o dígito verificador (44º) da chave NF-e via mod-11. Algoritmo
 * oficial: pesos cíclicos 2..9 da direita pra esquerda, soma; resto = mod 11;
 * dígito = 11 - resto (se >=10, dígito = 0).
 */
function validarChecksumChaveNfe(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  const digitos = chave.slice(0, 43).split('').map(Number);
  const informado = Number(chave[43]);
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += digitos[i] * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto >= 10 ? 0 : 11 - resto;
  return dv === informado;
}

function normalizarCnpj(cnpj: string | undefined | null): string {
  return (cnpj ?? '').replace(/\D/g, '');
}

@Injectable()
export class CompraNotaFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalClient: FiscalNfeClient,
  ) {}

  /**
   * Validação + preview de uma chave NF-e antes de persistir. Usado tanto
   * pelo endpoint `POST /compras/notas-fiscais/validar-chave` (form de
   * cadastro) quanto internamente por `create`/`update` antes de gravar a
   * chave. Garante:
   *  - Formato 44 dígitos + checksum mod-11
   *  - Status SEFAZ AUTORIZADA (codigoStatus 100)
   *  - CNPJ destinatário pertence a alguma filial CAPUL
   * Lança BadRequest com mensagem clara em qualquer falha.
   */
  async validarChave(chave: string, jwt: string, filialCodigo?: string): Promise<FiscalConsultaRetorno> {
    if (!validarChecksumChaveNfe(chave)) {
      throw new BadRequestException(
        'Chave NF-e inválida (dígito verificador não confere). Confira a digitação.',
      );
    }

    const retorno = await this.fiscalClient.consultarChave(chave, jwt, filialCodigo);

    // Status SEFAZ: aceita só AUTORIZADA (cStat='100'). cStat é STRING.
    // Cancelada/denegada/inutilizada não pode vincular.
    const prot = retorno.parsed.protocoloAutorizacao;
    if (prot && prot.cStat !== '100') {
      throw new BadRequestException(
        `NF-e não está autorizada na SEFAZ (${prot.cStat} - ${prot.motivo}). Não é possível vincular.`,
      );
    }

    // Cancelamento via evento posterior (tpEvento=110111). Mesmo com
    // cStat=100 da autorização original, a NF pode estar cancelada hoje.
    const eventoCancelamento = retorno.parsed.eventos?.find(
      (e) => e.tpEvento === '110111' && (e.cStat === '135' || e.cStat === '155'),
    );
    if (eventoCancelamento) {
      throw new BadRequestException(
        'NF-e está cancelada na SEFAZ (evento de cancelamento registrado). Não é possível vincular.',
      );
    }

    // Destinatário precisa ser filial CAPUL (Compras TI é centralizado,
    // então qualquer filial CAPUL serve — não filtra pela filial do usuário).
    const cnpjDest = normalizarCnpj(retorno.parsed.destinatario.cnpj);
    if (!cnpjDest) {
      throw new BadRequestException(
        'NF-e sem CNPJ de destinatário (provavelmente emitida para CPF). Não é possível vincular.',
      );
    }
    const filiaisCapul = await this.prisma.filial.findMany({ select: { cnpj: true } });
    const cnpjsCapul = new Set(filiaisCapul.map((f) => normalizarCnpj(f.cnpj)).filter(Boolean));
    if (!cnpjsCapul.has(cnpjDest)) {
      throw new BadRequestException(
        `NF-e emitida para CNPJ ${cnpjDest} (${retorno.parsed.destinatario.razaoSocial}), que ` +
        'não pertence a nenhuma filial CAPUL cadastrada. Confira a chave.',
      );
    }

    return retorno;
  }

  /**
   * Verifica se o usuario tem permissao para gerenciar compras/NFs de uma equipe.
   * ADMIN e GESTOR_TI sempre tem acesso. Outros precisam ser membro da equipe com podeGerirCompras.
   */
  async ensureNFPermission(equipeId: string | null | undefined, usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR') return;
    if (!equipeId) {
      throw new ForbiddenException('NF sem equipe associada. Associe uma equipe ou solicite a um ADMIN/GESTOR_TI.');
    }
    const membro = await this.prisma.membroEquipe.findUnique({
      where: { usuarioId_equipeId: { usuarioId, equipeId } },
    });
    if (!membro || membro.status !== 'ATIVO' || !membro.podeGerirCompras) {
      throw new ForbiddenException('Voce nao tem permissao para gerenciar compras desta equipe.');
    }
  }

  /**
   * Retorna equipes onde o usuario pode gerenciar compras.
   */
  async findEquipesParaCompras(usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR') {
      return this.prisma.equipeTI.findMany({
        where: { status: 'ATIVO' },
        select: { id: true, nome: true, sigla: true, cor: true },
        orderBy: { nome: 'asc' },
      });
    }
    const membros = await this.prisma.membroEquipe.findMany({
      where: { usuarioId, status: 'ATIVO', podeGerirCompras: true },
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true, status: true } } },
    });
    return membros
      .filter(m => m.equipe.status === 'ATIVO')
      .map(m => ({ id: m.equipe.id, nome: m.equipe.nome, sigla: m.equipe.sigla, cor: m.equipe.cor }));
  }

  async findAll(filters: {
    fornecedorId?: string;
    status?: string;
    centroCustoId?: string;
    projetoId?: string;
    dataInicio?: string;
    dataFim?: string;
    equipeId?: string;
  }, filialId?: string, usuarioId?: string, role?: string) {
    const where: Record<string, unknown> = {};
    if (filialId) where.filialId = filialId;
    if (filters.fornecedorId) where.fornecedorId = filters.fornecedorId;
    if (filters.status) where.status = filters.status;
    if (filters.equipeId) where.equipeId = filters.equipeId;
    if (filters.dataInicio || filters.dataFim) {
      const dataLancamento: Record<string, unknown> = {};
      if (filters.dataInicio) dataLancamento.gte = new Date(filters.dataInicio);
      if (filters.dataFim) dataLancamento.lte = new Date(filters.dataFim);
      where.dataLancamento = dataLancamento;
    }
    if (filters.centroCustoId) {
      where.itens = { some: { centroCustoId: filters.centroCustoId } };
    }
    if (filters.projetoId) {
      where.itens = { ...((where.itens as Record<string, unknown>) || {}), some: { ...((where.itens as { some?: Record<string, unknown> })?.some || {}), projetoId: filters.projetoId } };
    }

    // Filtro por equipe para nao-admin
    if (usuarioId && role && role !== 'ADMIN' && role !== 'GESTOR') {
      const membrosComPermissao = await this.prisma.membroEquipe.findMany({
        where: { usuarioId, status: 'ATIVO', podeGerirCompras: true },
        select: { equipeId: true },
      });
      const equipeIds = membrosComPermissao.map(m => m.equipeId);
      if (equipeIds.length === 0) {
        return [];
      }
      where.equipeId = { in: equipeIds };
    }

    return this.prisma.notaFiscal.findMany({
      where,
      include: NF_INCLUDE,
      orderBy: { dataLancamento: 'desc' },
    });
  }

  async findOne(id: string) {
    const nf = await this.prisma.notaFiscal.findUnique({
      where: { id },
      include: NF_INCLUDE,
    });
    if (!nf) throw new NotFoundException('Nota fiscal nao encontrada');
    return nf;
  }

  async findByProjeto(projetoId: string) {
    return this.prisma.notaFiscalItem.findMany({
      where: { projetoId },
      include: {
        notaFiscal: {
          include: {
            fornecedor: true,
          },
        },
        produto: { include: { tipoProduto: true } },
        centroCusto: true,
      },
      orderBy: { notaFiscal: { dataLancamento: 'desc' } },
    });
  }

  async create(
    dto: CreateNotaFiscalDto,
    userId: string,
    filialId: string,
    role: string = 'ADMIN',
    jwt?: string,
    user?: JwtPayload,
  ) {
    if (!dto.itens || dto.itens.length === 0) {
      throw new BadRequestException('A nota fiscal deve ter pelo menos um item');
    }

    // Verificar permissao na equipe
    await this.ensureNFPermission(dto.equipeId, userId, role);

    // Se chave NF-e foi informada, valida via Fiscal antes de persistir.
    // O Fiscal já dispara SZR→SEFAZ→grava Protheus como efeito colateral.
    // JWT é exigido para repassar ao Fiscal (mesmo issuer); ausência = caller
    // não passou pelo controller (testes, jobs) e nesse caso não permitimos
    // vincular chave por segurança.
    if (dto.chaveNfe) {
      if (!jwt) {
        throw new BadRequestException(
          'Vinculação de chave NF-e exige autenticação completa (token ausente).',
        );
      }
      await this.validarChave(dto.chaveNfe, jwt);
    }

    const itensData = dto.itens.map((item) => {
      const valorTotal = Number((item.quantidade * item.valorUnitario).toFixed(2));
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal,
        centroCustoId: item.centroCustoId,
        projetoId: item.projetoId || null,
        observacao: item.observacao || null,
      };
    });

    const valorTotalNF = itensData.reduce((sum, i) => sum + i.valorTotal, 0);

    // Onda 1 Sub-fase 1.6.1 — resolveDepartamento em cascata.
    const departamentoId = await resolveDepartamento(
      this.prisma,
      user ?? null,
      'WORKSPACE',
      dto.departamentoId,
    );

    return this.prisma.$transaction(async (tx) => {
      const nf = await tx.notaFiscal.create({
        data: {
          numero: dto.numero,
          dataLancamento: new Date(dto.dataLancamento),
          dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
          fornecedorId: dto.fornecedorId,
          filialId,
          criadoPorId: userId,
          equipeId: dto.equipeId || null,
          observacao: dto.observacao || null,
          valorTotal: valorTotalNF,
          chaveNfe: dto.chaveNfe ?? null,
          departamentoId,
          itens: {
            create: itensData,
          },
        },
        include: NF_INCLUDE,
      });

      // Vínculo inicial gera linha de histórico com chaveAnterior=null.
      // Sem motivo (não exigido na criação).
      if (dto.chaveNfe) {
        await tx.notaFiscalChaveHistorico.create({
          data: {
            notaFiscalId: nf.id,
            chaveAnterior: null,
            chaveNova: dto.chaveNfe,
            motivo: null,
            alteradoPorId: userId,
          },
        });
      }

      return nf;
    });
  }

  async update(
    id: string,
    dto: UpdateNotaFiscalDto,
    usuarioId: string = '',
    role: string = 'ADMIN',
    jwt?: string,
  ) {
    const existing = await this.prisma.notaFiscal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Nota fiscal nao encontrada');
    if (existing.status === 'CANCELADA') {
      throw new BadRequestException('Nota fiscal cancelada nao pode ser editada');
    }

    // Verificar permissao na equipe da NF existente
    await this.ensureNFPermission(existing.equipeId, usuarioId, role);

    // ─── Regras de alteração da chave NF-e (14/05/2026) ───
    // Compara dto.chaveNfe com existing.chaveNfe normalizado. `undefined` =
    // campo não enviado (mantém atual); `null`/"" = pedido de desvincular.
    let chaveMudou = false;
    let novaChavePersistir: string | null = existing.chaveNfe;

    if (dto.chaveNfe !== undefined) {
      const nova = dto.chaveNfe && dto.chaveNfe.trim() !== '' ? dto.chaveNfe : null;
      if (nova !== existing.chaveNfe) {
        chaveMudou = true;
        novaChavePersistir = nova;

        // Bloqueia alteração se status já passou de REGISTRADA.
        if (existing.status !== 'REGISTRADA') {
          throw new BadRequestException(
            `Chave NF-e não pode ser alterada — NF já está em status ${existing.status}. ` +
            'Cancele esta NF e crie uma nova se for necessário corrigir.',
          );
        }

        // Trocar/desvincular chave preexistente exige motivo (audit).
        if (existing.chaveNfe && !dto.motivoAlteracaoChave?.trim()) {
          throw new BadRequestException(
            'Para alterar/remover a chave NF-e vinculada, informe o motivo da alteração.',
          );
        }

        // Se está vinculando nova chave (não só removendo), valida via Fiscal.
        if (nova) {
          if (!jwt) {
            throw new BadRequestException(
              'Alteração de chave NF-e exige autenticação completa (token ausente).',
            );
          }
          await this.validarChave(nova, jwt);
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.numero !== undefined) data.numero = dto.numero;
    if (dto.dataLancamento !== undefined) data.dataLancamento = new Date(dto.dataLancamento);
    if (dto.dataVencimento !== undefined) data.dataVencimento = dto.dataVencimento ? new Date(dto.dataVencimento) : null;
    if (dto.fornecedorId !== undefined) data.fornecedorId = dto.fornecedorId;
    if (dto.observacao !== undefined) data.observacao = dto.observacao;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.equipeId !== undefined) data.equipeId = dto.equipeId || null;
    if (chaveMudou) data.chaveNfe = novaChavePersistir;

    const itensData = dto.itens?.map((item) => {
      const valorTotal = Number((item.quantidade * item.valorUnitario).toFixed(2));
      return {
        notaFiscalId: id,
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal,
        centroCustoId: item.centroCustoId,
        projetoId: item.projetoId || null,
        observacao: item.observacao || null,
      };
    });

    if (dto.itens !== undefined) {
      if (!itensData || itensData.length === 0) {
        throw new BadRequestException('A nota fiscal deve ter pelo menos um item');
      }
      data.valorTotal = itensData.reduce((sum, i) => sum + i.valorTotal, 0);
    }

    // Transação cobre: update NF + recria itens (se enviados) + grava
    // histórico de chave (se mudou). Tudo atômico.
    return this.prisma.$transaction(async (tx) => {
      if (itensData) {
        await tx.notaFiscalItem.deleteMany({ where: { notaFiscalId: id } });
        await tx.notaFiscalItem.createMany({ data: itensData });
      }

      if (chaveMudou) {
        await tx.notaFiscalChaveHistorico.create({
          data: {
            notaFiscalId: id,
            chaveAnterior: existing.chaveNfe,
            chaveNova: novaChavePersistir,
            motivo: dto.motivoAlteracaoChave?.trim() || null,
            alteradoPorId: usuarioId,
          },
        });
      }

      return tx.notaFiscal.update({
        where: { id },
        data,
        include: NF_INCLUDE,
      });
    });
  }

  async remove(id: string, usuarioId: string = '', role: string = 'ADMIN') {
    const existing = await this.prisma.notaFiscal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Nota fiscal nao encontrada');
    await this.ensureNFPermission(existing.equipeId, usuarioId, role);
    await this.prisma.notaFiscal.delete({ where: { id } });
    return { success: true };
  }

  async duplicar(id: string, userId: string, filialId: string, role: string = 'ADMIN') {
    const original = await this.prisma.notaFiscal.findUnique({
      where: { id },
      include: { itens: true },
    });
    if (!original) throw new NotFoundException('Nota fiscal nao encontrada');
    await this.ensureNFPermission(original.equipeId, userId, role);

    const itensData = original.itens.map((item) => ({
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      valorUnitario: Number(item.valorUnitario),
      valorTotal: Number(item.valorTotal),
      centroCustoId: item.centroCustoId,
      projetoId: item.projetoId,
      observacao: item.observacao,
    }));

    // Cópia herda do original (departamentoId NOT NULL desde Sub-fase 1.1).
    const departamentoId = original.departamentoId;

    return this.prisma.notaFiscal.create({
      data: {
        numero: `${original.numero}-COPIA`,
        dataLancamento: new Date(),
        fornecedorId: original.fornecedorId,
        filialId,
        criadoPorId: userId,
        equipeId: original.equipeId,
        observacao: original.observacao,
        valorTotal: Number(original.valorTotal),
        departamentoId,
        itens: { create: itensData },
      },
      include: NF_INCLUDE,
    });
  }

  // --- Anexos ---

  async listAnexos(nfId: string) {
    return this.prisma.anexoNotaFiscal.findMany({
      where: { notaFiscalId: nfId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAnexo(nfId: string, file: Express.Multer.File, userId: string) {
    const nf = await this.prisma.notaFiscal.findUnique({ where: { id: nfId } });
    if (!nf) throw new NotFoundException('Nota fiscal nao encontrada');
    return this.prisma.anexoNotaFiscal.create({
      data: {
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        notaFiscalId: nfId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async getAnexoFile(nfId: string, anexoId: string) {
    const anexo = await this.prisma.anexoNotaFiscal.findFirst({
      where: { id: anexoId, notaFiscalId: nfId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');
    const filePath = path.join(process.cwd(), 'uploads', 'notas-fiscais', anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Arquivo nao encontrado no disco');
    return { filePath, anexo };
  }

  async removeAnexo(nfId: string, anexoId: string) {
    const anexo = await this.prisma.anexoNotaFiscal.findFirst({
      where: { id: anexoId, notaFiscalId: nfId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');
    const filePath = path.join(process.cwd(), 'uploads', 'notas-fiscais', anexo.nomeArquivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await this.prisma.anexoNotaFiscal.delete({ where: { id: anexoId } });
    return { deleted: true };
  }
}
