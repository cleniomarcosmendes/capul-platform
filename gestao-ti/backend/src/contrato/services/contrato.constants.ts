import { StatusContrato } from '@prisma/client';

export const UPLOADS_DIR = require('path').resolve('./uploads/contratos');

export const contratoListInclude = {
  software: { select: { id: true, nome: true, fabricante: true } },
  tipoContrato: { select: { id: true, codigo: true, nome: true } },
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  equipe: { select: { id: true, nome: true, sigla: true } },
  fornecedorRef: { select: { id: true, codigo: true, loja: true, nome: true } },
  produtoRef: { select: { id: true, codigo: true, descricao: true } },
  rateioTemplate: { select: { id: true, modalidade: true } },
  _count: { select: { parcelas: true, licencas: true, anexos: true } },
};

export const contratoDetailInclude = {
  software: { select: { id: true, nome: true, fabricante: true, tipo: true } },
  tipoContrato: { select: { id: true, codigo: true, nome: true } },
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  equipe: { select: { id: true, nome: true, sigla: true } },
  fornecedorRef: { select: { id: true, codigo: true, loja: true, nome: true } },
  produtoRef: { select: { id: true, codigo: true, descricao: true } },
  parcelas: {
    include: {
      rateioItens: {
        include: {
          centroCusto: { select: { id: true, codigo: true, nome: true } },
          natureza: { select: { id: true, codigo: true, nome: true } },
        },
      },
    },
    orderBy: { numero: 'asc' as const },
  },
  rateioTemplate: {
    include: {
      itens: {
        include: {
          centroCusto: { select: { id: true, codigo: true, nome: true } },
          natureza: { select: { id: true, codigo: true, nome: true } },
        },
        orderBy: { centroCusto: { nome: 'asc' as const } },
      },
    },
  },
  historicos: {
    include: { usuario: { select: { id: true, nome: true, username: true } } },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
  licencas: {
    include: { software: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  anexos: { orderBy: { createdAt: 'desc' as const } },
  contratosRenovados: {
    select: { id: true, numero: true, titulo: true, valorTotal: true, dataInicio: true, dataFim: true, status: true },
  },
  contratoOriginal: {
    select: { id: true, numero: true, titulo: true },
  },
  _count: { select: { parcelas: true, licencas: true, anexos: true } },
};

export const TRANSICOES_VALIDAS: Record<StatusContrato, StatusContrato[]> = {
  RASCUNHO: ['ATIVO', 'CANCELADO'],
  ATIVO: ['SUSPENSO', 'VENCIDO', 'RENOVADO', 'CANCELADO'],
  SUSPENSO: ['ATIVO', 'CANCELADO'],
  VENCIDO: ['RENOVADO', 'ATIVO'],
  RENOVADO: [],
  CANCELADO: ['ATIVO'],
};
