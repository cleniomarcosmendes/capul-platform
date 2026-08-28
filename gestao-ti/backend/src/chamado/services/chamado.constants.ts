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
};

/**
 * ⭐ 28/08 — os laços `#numero` saíram do `chamadoInclude` compartilhado.
 *
 * Eles estavam lá dentro, e `chamadoInclude` é devolvido por **14 pontos**: além da
 * listagem e do detalhe, `create`, `assumir`, `resolver`, `fechar`, `reabrir`,
 * `cancelar`, `avaliar`, `transferirEquipe`, `transferirTecnico`, `updateHeader` e
 * `atualizarDadosClienteSac`. A poda que o /security-review pediu em 27/08 foi posta em
 * DOIS deles — os outros 12 seguiam devolvendo título e número de chamado PRIVADO de
 * departamento que o leitor não atende.
 *
 * Corrigir os 12 na mão seria a 3ª rodada do mesmo defeito. A trava é estrutural: quem
 * não precisa dos laços não os carrega. Só o DETALHE monta a linha do tempo e só ele
 * desenha "Chamados relacionados" — a listagem nunca usou o campo.
 *
 * ⚠️ Regra para quem mexer: `chamadoIncludeDetalhe` **exige** `podarReferencias` na
 * saída. Um teste varre este arquivo e o serviço para garantir isso — método novo que
 * use este include sem podar quebra a suíte.
 */
export const chamadoIncludeDetalhe = {
  ...chamadoInclude,
  // Os DOIS sentidos: o que este chamado cita ("seguimento de #123") e quem citou ele
  // ("#456 veio deste"). Sem o inverso, quem atende o chamado antigo não fica sabendo
  // que a demanda continuou em outro — o caso de quem antes reabria.
  //
  // ⚠️ `departamentoId` e `visibilidade` vêm no select porque o SERVIÇO precisa deles
  // para podar (`podeLerChamado`): sem isso, quem vê o chamado A veria número, título e
  // status de todo chamado que cita A, de QUALQUER departamento — inclusive PRIVADO.
  referenciasFeitas: {
    select: {
      id: true, criadoEm: true,
      destino: { select: { id: true, numero: true, titulo: true, status: true, departamentoId: true, visibilidade: true } },
    },
    orderBy: { criadoEm: 'asc' as const },
  },
  referenciasRecebidas: {
    select: {
      id: true, criadoEm: true,
      origem: { select: { id: true, numero: true, titulo: true, status: true, departamentoId: true, visibilidade: true } },
    },
    orderBy: { criadoEm: 'asc' as const },
  },
};

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'chamados');
