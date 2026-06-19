import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ProjetoPendenciaService } from './projeto-pendencia.service';
import { ProjetoHelpersService } from './projeto-helpers.service';
import { NotificacaoService } from '../../notificacao/notificacao.service';
import { EmailEnvolvidosService } from '../../email/email-envolvidos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../common/testing/prisma-mock';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

// Regras de quem encerra/altera pendência (ajuste 19/06/2026):
//  - staff T.I. (ADMIN/GESTOR/SUPORTE) com acesso ao projeto pode mudar o STATUS
//    (inclusive Concluir) sem ser o responsável — resolve UC/TERCEIRIZADO que não
//    fecham as pendências.
//  - editar DADOS (título etc.) segue exigindo gestor ou responsável.
//  - USUARIO_CHAVE/TERCEIRIZADO só transitam pra Em Andamento/Aguardando/Concluída.
const mockUser = (sub = 'sup-1'): JwtPayload =>
  ({ sub, email: 'sup@test.com', filialId: 'filial-1' } as unknown as JwtPayload);

function basePendencia(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pend-1',
    numero: 1,
    projetoId: 'proj-1',
    titulo: 'Pendência Teste',
    descricao: 'desc',
    status: 'EM_ANDAMENTO',
    responsavelId: 'outro-user', // NÃO é o SUPORTE que está agindo
    criadorId: 'criador-1',
    ...overrides,
  };
}

describe('ProjetoPendenciaService — permissão de encerrar/alterar status', () => {
  let service: ProjetoPendenciaService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let helpers: { checkProjetoAccessChave: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    helpers = { checkProjetoAccessChave: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ProjetoPendenciaService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjetoHelpersService, useValue: helpers },
        { provide: NotificacaoService, useValue: { criarParaUsuario: jest.fn().mockResolvedValue(undefined), criarParaUsuarios: jest.fn().mockResolvedValue(undefined) } },
        { provide: EmailEnvolvidosService, useValue: { enviar: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(ProjetoPendenciaService);
    prisma.projeto.findUnique.mockResolvedValue({ departamentoId: 'dep-ti', nome: 'Projeto X' });
    prisma.interacaoPendencia.create.mockResolvedValue({});
  });

  it('SUPORTE (não responsável) pode CONCLUIR a pendência', async () => {
    prisma.pendenciaProjeto.findFirst.mockResolvedValue(basePendencia());
    prisma.pendenciaProjeto.update.mockResolvedValue(basePendencia({ status: 'CONCLUIDA' }));

    await service.updatePendencia('proj-1', 'pend-1', { status: 'CONCLUIDA' } as any, mockUser(), 'SUPORTE');

    expect(prisma.pendenciaProjeto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONCLUIDA' }) }),
    );
  });

  it('SUPORTE NÃO pode editar DADOS (título) sem ser responsável', async () => {
    prisma.pendenciaProjeto.findFirst.mockResolvedValue(basePendencia());

    await expect(
      service.updatePendencia('proj-1', 'pend-1', { titulo: 'novo título' } as any, mockUser(), 'SUPORTE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pendenciaProjeto.update).not.toHaveBeenCalled();
  });

  it('USUARIO_CHAVE não pode mandar a pendência pra status fora da whitelist (CANCELADA)', async () => {
    prisma.pendenciaProjeto.findFirst.mockResolvedValue(basePendencia());

    await expect(
      service.updatePendencia('proj-1', 'pend-1', { status: 'CANCELADA' } as any, mockUser('uc-1'), 'USUARIO_CHAVE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pendenciaProjeto.update).not.toHaveBeenCalled();
  });
});
