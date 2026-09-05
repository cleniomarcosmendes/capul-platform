import { ForbiddenException } from '@nestjs/common';
import {
  IdentidadeService,
  MatriculaAmbiguaError,
  escolherColaboradorUnico,
  type ColaboradorResumo,
} from './identidade.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

const colab = (over: Partial<ColaboradorResumo> = {}): ColaboradorResumo => ({
  id: 'colab-1',
  filial: '01',
  matricula: '001741',
  nome: 'JOAO LUIZ BARBOSA DA SILVA',
  situacao: 'ATIVO',
  ...over,
});

describe('escolherColaboradorUnico', () => {
  it('devolve o único encontrado', () => {
    expect(escolherColaboradorUnico([colab()], '001741')?.id).toBe('colab-1');
  });

  it('devolve null quando não encontra — quem decide o que fazer é o chamador', () => {
    expect(escolherColaboradorUnico([], '001741')).toBeNull();
  });

  it('⭐ NUNCA pega o primeiro: dois ativos para a mesma matrícula é anomalia', () => {
    // A regra de negócio diz que não acontece — matrícula repetida é histórico de
    // transferência, e as filiais antigas ficam com demissão preenchida. Se
    // acontecer, é dado errado e queremos saber na hora, não escolher por ordem
    // de índice num módulo onde a nota decide mérito.
    const duplicados = [colab({ id: 'a', filial: '01' }), colab({ id: 'b', filial: '18' })];
    expect(() => escolherColaboradorUnico(duplicados, '001741')).toThrow(MatriculaAmbiguaError);
  });

  it('a mensagem da anomalia diz a matrícula e as filiais, para achar a linha errada', () => {
    const duplicados = [colab({ filial: '01' }), colab({ filial: '18' })];
    try {
      escolherColaboradorUnico(duplicados, '001741');
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as Error).message).toContain('001741');
      expect((e as Error).message).toContain('01, 18');
      expect((e as MatriculaAmbiguaError).encontrados).toHaveLength(2);
    }
  });
});

describe('IdentidadeService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: IdentidadeService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new IdentidadeService(prisma as never);
  });

  it('lê a matrícula do BANCO (core.usuarios), não do JWT', async () => {
    prisma.$queryRaw.mockResolvedValue([{ matricula: '001741 ' }]);
    prisma.colaborador.findMany.mockResolvedValue([colab()]);

    const resultado = await service.colaboradorDoUsuario('user-1');

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(resultado.id).toBe('colab-1');
  });

  it('busca só por matrícula, sem pedir filial', async () => {
    prisma.$queryRaw.mockResolvedValue([{ matricula: '001741' }]);
    prisma.colaborador.findMany.mockResolvedValue([colab()]);

    await service.colaboradorDoUsuario('user-1');

    const where = prisma.colaborador.findMany.mock.calls[0][0].where;
    expect(where.matricula).toBe('001741');
    expect(where).not.toHaveProperty('filial');
  });

  it('procura entre os elegíveis — inclui férias e afastamento', async () => {
    prisma.$queryRaw.mockResolvedValue([{ matricula: '001741' }]);
    prisma.colaborador.findMany.mockResolvedValue([colab({ situacao: 'FERIAS' })]);

    await service.colaboradorDoUsuario('user-1');

    expect(prisma.colaborador.findMany.mock.calls[0][0].where.situacao.in).toEqual(
      expect.arrayContaining(['ATIVO', 'AFASTADO', 'FERIAS']),
    );
    expect(prisma.colaborador.findMany.mock.calls[0][0].where.situacao.in).not.toContain('DEMITIDO');
  });

  describe('⭐ falha FECHADA — sem identidade não se entra no módulo', () => {
    it('usuário sem matrícula em core.usuarios: 403', async () => {
      prisma.$queryRaw.mockResolvedValue([{ matricula: null }]);
      await expect(service.colaboradorDoUsuario('user-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('matrícula em branco também é ausência', async () => {
      prisma.$queryRaw.mockResolvedValue([{ matricula: '   ' }]);
      await expect(service.colaboradorDoUsuario('user-1')).rejects.toThrow(/matrícula/i);
    });

    it('usuário inexistente em core.usuarios: 403', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(service.colaboradorDoUsuario('user-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('matrícula que não bate com colaborador ativo: 403 dizendo qual é', async () => {
      prisma.$queryRaw.mockResolvedValue([{ matricula: '009999' }]);
      prisma.colaborador.findMany.mockResolvedValue([]);
      await expect(service.colaboradorDoUsuario('user-1')).rejects.toThrow(/009999/);
    });

    it('a anomalia de matrícula duplicada SOBE — não vira acesso liberado nem negado calado', async () => {
      prisma.$queryRaw.mockResolvedValue([{ matricula: '001741' }]);
      prisma.colaborador.findMany.mockResolvedValue([
        colab({ id: 'a', filial: '01' }),
        colab({ id: 'b', filial: '18' }),
      ]);
      await expect(service.colaboradorDoUsuario('user-1')).rejects.toBeInstanceOf(MatriculaAmbiguaError);
    });
  });
});
