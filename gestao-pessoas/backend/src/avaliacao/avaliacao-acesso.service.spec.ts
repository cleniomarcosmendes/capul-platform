import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AvaliacaoAcessoService, type ContextoAcesso } from './avaliacao-acesso.service.js';
import { MOTIVO_ACESSO_RESTRITO } from './separacao-funcoes.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

/**
 * ⭐ O teste que o RH pediu por escrito: RH_ADMIN abrindo a PRÓPRIA avaliação
 * recebe 403.
 *
 * Repare que papel nenhum aparece nestes testes — e é esse o ponto. A regra é
 * verificada por REGISTRO (`colaboradorId === avaliadoId`), então RH_ADMIN,
 * ADMIN e AVALIADOR passam exatamente pelo mesmo caminho. Um teste que
 * montasse um "usuário RH_ADMIN" estaria testando a autorização por papel, que
 * é outra coisa e mora no RolesGuard.
 */

const GESTORA = 'colab-gestora-rh';
const OUTRA_PESSOA = 'colab-fulano';

describe('AvaliacaoAcessoService — separação de funções', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: AvaliacaoAcessoService;

  const contexto: ContextoAcesso = {
    usuarioId: 'user-gestora',
    colaboradorId: GESTORA,
    ip: '10.0.0.9',
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new AvaliacaoAcessoService(prisma as never, auditoria as never);
  });

  const avaliacaoDe = (avaliadoId: string, avaliadorId = 'colab-superior') =>
    prisma.avaliacao.findUnique.mockResolvedValue({
      id: 'aval-1',
      avaliadoId,
      avaliadorId,
      cicloId: 'ciclo-1',
    });

  describe('a própria avaliação — 403 em todas as ações, qualquer papel', () => {
    it.each(['abrir', 'editar', 'reabrir', 'recalcular', 'responder'] as const)(
      'recusa %s',
      async (acao) => {
        avaliacaoDe(GESTORA);
        await expect(service.carregarParaAcao(contexto, 'aval-1', acao)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it('a mensagem diz o que fazer, sem jargão', async () => {
      avaliacaoDe(GESTORA);
      await expect(service.carregarParaAcao(contexto, 'aval-1', 'abrir')).rejects.toThrow(
        /própria avaliação.*outro administrador de RH/s,
      );
    });

    it('registra a tentativa em rh.auditoria ANTES de recusar', async () => {
      avaliacaoDe(GESTORA);
      await service.carregarParaAcao(contexto, 'aval-1', 'reabrir').catch(() => undefined);

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          entidade: 'Avaliacao',
          entidadeId: 'aval-1',
          acao: 'ACESSO_NEGADO_PROPRIO_AVALIADO:reabrir',
          usuarioId: 'user-gestora',
          justificativa: MOTIVO_ACESSO_RESTRITO,
          ip: '10.0.0.9',
        }),
      );
    });
  });

  describe('avaliação de terceiro', () => {
    it('deixa passar quando o usuário é o avaliador designado', async () => {
      avaliacaoDe(OUTRA_PESSOA, GESTORA);
      await expect(service.carregarParaAcao(contexto, 'aval-1', 'abrir')).resolves.toMatchObject({
        avaliadoId: OUTRA_PESSOA,
      });
    });

    it('não polui a auditoria quando quem abre é o próprio avaliador', async () => {
      avaliacaoDe(OUTRA_PESSOA, GESTORA);
      await service.carregarParaAcao(contexto, 'aval-1', 'abrir');
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it('deixa passar o RH, mas deixa rastro: leu resultado de quem não avalia (§8)', async () => {
      avaliacaoDe(OUTRA_PESSOA, 'colab-terceiro');
      await service.carregarParaAcao(contexto, 'aval-1', 'abrir');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'ACESSO_TERCEIRO:abrir' }),
      );
    });
  });

  it('avaliação inexistente é 404, não 403 — não confundir os dois', async () => {
    prisma.avaliacao.findUnique.mockResolvedValue(null);
    await expect(service.carregarParaAcao(contexto, 'nada', 'abrir')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('listas e relatórios — marca, não filtra', () => {
    const linhas = [
      { avaliadoId: OUTRA_PESSOA, nota: 82 },
      { avaliadoId: GESTORA, nota: 91 },
      { avaliadoId: 'colab-sicrano', nota: 74 },
    ];

    it('mantém TODAS as linhas — o total precisa fechar', () => {
      const marcadas = service.marcarProprias(contexto, linhas);
      expect(marcadas).toHaveLength(3);
      expect(marcadas.reduce((s, l) => s + l.nota, 0)).toBe(247);
    });

    it('marca a linha do próprio usuário com o motivo', () => {
      const marcadas = service.marcarProprias(contexto, linhas);
      expect(marcadas.find((l) => l.avaliadoId === GESTORA)).toMatchObject({
        restrita: true,
        motivoRestricao: MOTIVO_ACESSO_RESTRITO,
      });
    });

    it('as demais linhas ficam explicitamente não restritas', () => {
      const marcadas = service.marcarProprias(contexto, linhas);
      expect(marcadas.filter((l) => l.restrita)).toHaveLength(1);
      expect(marcadas.find((l) => l.avaliadoId === OUTRA_PESSOA)?.restrita).toBe(false);
    });
  });
});
