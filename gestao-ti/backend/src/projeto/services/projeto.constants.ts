import * as fs from 'fs';
import * as path from 'path';

export const PROJETO_UPLOADS_DIR = path.resolve('./uploads/projetos');
if (!fs.existsSync(PROJETO_UPLOADS_DIR)) {
  fs.mkdirSync(PROJETO_UPLOADS_DIR, { recursive: true });
}

export const PENDENCIA_UPLOADS_DIR = path.resolve('./uploads/pendencias');

export const projetoListInclude = {
  software: { select: { id: true, nome: true, tipo: true } },
  contrato: { select: { id: true, numero: true, titulo: true } },
  responsavel: { select: { id: true, nome: true, username: true } },
  projetoPai: { select: { id: true, numero: true, nome: true } },
  _count: {
    select: {
      subProjetos: true, membros: true, fases: true, atividades: true,
      cotacoes: true, custos: true, riscos: true, anexos: true,
      apontamentos: true, dependenciasOrigem: true,
      usuariosChave: true, pendencias: true,
    },
  },
};

export const projetoDetailInclude = {
  software: { select: { id: true, nome: true, tipo: true } },
  contrato: { select: { id: true, numero: true, titulo: true } },
  responsavel: { select: { id: true, nome: true, username: true } },
  subProjetos: {
    select: { id: true, numero: true, nome: true, status: true, modo: true, nivel: true },
    orderBy: { numero: 'asc' as const },
  },
  membros: {
    include: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  fases: { orderBy: { ordem: 'asc' as const } },
  atividades: {
    include: {
      usuario: { select: { id: true, nome: true } },
      fase: { select: { id: true, nome: true } },
      _count: { select: { registrosTempo: true, comentarios: true } },
      registrosTempo: {
        where: { horaFim: null },
        select: { id: true, usuarioId: true, horaInicio: true, usuario: { select: { nome: true } } },
      },
    },
    orderBy: { dataAtividade: 'desc' as const },
    take: 50,
  },
  cotacoes: { orderBy: { createdAt: 'desc' as const } },
  custos: { orderBy: { createdAt: 'desc' as const } },
  riscos: {
    include: { responsavel: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  dependenciasOrigem: {
    include: {
      projetoDestino: { select: { id: true, numero: true, nome: true, status: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  dependenciasDestino: {
    include: {
      projetoOrigem: { select: { id: true, numero: true, nome: true, status: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  anexos: {
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  apontamentos: {
    include: {
      usuario: { select: { id: true, nome: true } },
      fase: { select: { id: true, nome: true } },
    },
    orderBy: { data: 'desc' as const },
    take: 100,
  },
  _count: {
    select: {
      subProjetos: true, membros: true, fases: true, atividades: true,
      cotacoes: true, custos: true, riscos: true, anexos: true,
      apontamentos: true, dependenciasOrigem: true,
      usuariosChave: true, pendencias: true,
    },
  },
};
