import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DispositivoSessaoService } from './dispositivo-sessao.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('DispositivoSessaoService', () => {
  let prisma: any;
  let svc: DispositivoSessaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new DispositivoSessaoService(prisma);
  });

  describe('revogarSessao', () => {
    it('404 se a sessão não existe', async () => {
      prisma.dispositivoSessao.findUnique.mockResolvedValue(null);
      await expect(svc.revogarSessao('s1', 'u1', 'u1')).rejects.toThrow(NotFoundException);
    });
    it('403 se a sessão é de outro usuário', async () => {
      prisma.dispositivoSessao.findUnique.mockResolvedValue({ id: 's1', usuarioId: 'u2' });
      await expect(svc.revogarSessao('s1', 'u1', 'u1')).rejects.toThrow(ForbiddenException);
    });
    it('revoga a sessão E invalida os refresh tokens ligados', async () => {
      prisma.dispositivoSessao.findUnique.mockResolvedValue({ id: 's1', usuarioId: 'u1' });
      const r = await svc.revogarSessao('s1', 'u1', 'u1');
      expect(r.revogadas).toBe(1);
      expect(prisma.dispositivoSessao.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revogadoPorId: 'u1' }) }));
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revoked: true } }));
    });
  });

  describe('revogarDispositivo', () => {
    it('revoga todas as sessões do device do usuário', async () => {
      prisma.dispositivoSessao.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      const r = await svc.revogarDispositivo('dev1', 'u1', 'u1');
      expect(r.revogadas).toBe(2);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
    it('no-op (0) quando o device não tem sessões ativas', async () => {
      prisma.dispositivoSessao.findMany.mockResolvedValue([]);
      const r = await svc.revogarDispositivo('devX', 'u1', 'u1');
      expect(r.revogadas).toBe(0);
      expect(prisma.dispositivoSessao.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('revogarTodasDoUsuario', () => {
    it('revoga todas as sessões ativas do usuário', async () => {
      prisma.dispositivoSessao.findMany.mockResolvedValue([{ id: 's1' }]);
      const r = await svc.revogarTodasDoUsuario('u1', 'u1');
      expect(r.revogadas).toBe(1);
    });
  });

  describe('assertAtiva (usado no refresh)', () => {
    it('lança se a sessão foi revogada', async () => {
      prisma.dispositivoSessao.findUnique.mockResolvedValue({ id: 's1', revogadoEm: new Date(), expiraEm: new Date(Date.now() + 1e6) });
      await expect(svc.assertAtiva('s1')).rejects.toThrow(UnauthorizedException);
    });
    it('lança se a sessão expirou', async () => {
      prisma.dispositivoSessao.findUnique.mockResolvedValue({ id: 's1', revogadoEm: null, expiraEm: new Date(Date.now() - 1000) });
      await expect(svc.assertAtiva('s1')).rejects.toThrow(UnauthorizedException);
    });
    it('ok quando ativa', async () => {
      prisma.dispositivoSessao.findUnique.mockResolvedValue({ id: 's1', revogadoEm: null, expiraEm: new Date(Date.now() + 1e6) });
      await expect(svc.assertAtiva('s1')).resolves.toBeTruthy();
    });
  });
});
