import * as path from 'path';

export const chamadoInclude = {
  solicitante: { select: { id: true, nome: true, username: true, email: true, departamentoId: true } },
  tecnico: { select: { id: true, nome: true, username: true, email: true } },
  equipeAtual: { select: { id: true, nome: true, sigla: true, cor: true, atendeSac: true } },
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  departamento: { select: { id: true, nome: true } },
  catalogoServico: { select: { id: true, nome: true } },
  slaDefinicao: true,
  software: { select: { id: true, nome: true, tipo: true } },
  softwareModulo: { select: { id: true, nome: true } },
  projeto: { select: { id: true, numero: true, nome: true } },
  ativo: { select: { id: true, tag: true, nome: true, tipo: true } },
  anexos: {
    select: { id: true, nomeOriginal: true, mimeType: true, tamanho: true, descricao: true, createdAt: true, usuarioId: true, usuario: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  // ⭐ 26/08 — laços de contexto (`#numero` no detalhamento). Os DOIS sentidos: o que
  // este chamado cita ("seguimento de #123") e quem citou ele ("#456 veio deste").
  // Sem o sentido inverso, quem atende o chamado antigo não fica sabendo que a demanda
  // continuou em outro — que é justamente o caso de quem antes reabria.
  referenciasFeitas: {
    select: { id: true, criadoEm: true, destino: { select: { id: true, numero: true, titulo: true, status: true } } },
    orderBy: { criadoEm: 'asc' as const },
  },
  referenciasRecebidas: {
    select: { id: true, criadoEm: true, origem: { select: { id: true, numero: true, titulo: true, status: true } } },
    orderBy: { criadoEm: 'asc' as const },
  },
};

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'chamados');
