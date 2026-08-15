import { Reflector } from '@nestjs/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IntegracaoController } from './integracao.controller';
import { IntegracaoService } from './integracao.service';
import { ConfiguradorAdminGuard } from '../presenca/configurador-admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Dois achados High do /security-review de 15/08, ambos neste controller.
 *
 * Ele tinha apenas `JwtAuthGuard`, e o auth-gateway não tem RolesGuard global — logo
 * "autenticado" era todo o controle de acesso. Como a leitura devolve `authConfig`
 * (credencial de PRODUÇÃO do Protheus, texto puro) e `/api/v1/core/` é exposto pelo
 * nginx, qualquer conta da plataforma lia a credencial; e `PATCH /endpoints/:id`
 * permitia repontar a URL da integração para um host de atacante.
 */
describe('IntegracaoController — exige ADMIN do Configurador', () => {
  const guardsDoController = () =>
    new Reflector().get<any[]>('__guards__', IntegracaoController) ?? [];

  it('a classe é guardada por JwtAuthGuard E ConfiguradorAdminGuard', () => {
    const guards = guardsDoController();
    expect(guards).toContain(JwtAuthGuard);
    // ⭐ O que faltava: sem ele, autenticar já bastava para ler a credencial.
    expect(guards).toContain(ConfiguradorAdminGuard);
  });

  describe('ConfiguradorAdminGuard', () => {
    const guard = new ConfiguradorAdminGuard();
    const ctx = (user: unknown) =>
      ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

    it('ENTREGADOR autenticado é barrado — era ele quem lia a credencial', () => {
      expect(() =>
        guard.canActivate(ctx({ sub: 'u1', modulos: [{ codigo: 'LOGISTICA', role: 'ENTREGADOR' }] })),
      ).toThrow(ForbiddenException);
    });

    it('CONFIGURADOR não-ADMIN (VIEWER/OPERADOR) também é barrado', () => {
      expect(() =>
        guard.canActivate(ctx({ sub: 'u1', modulos: [{ codigo: 'CONFIGURADOR', role: 'VIEWER' }] })),
      ).toThrow(ForbiddenException);
    });

    it('ADMIN do Configurador passa', () => {
      expect(
        guard.canActivate(ctx({ sub: 'u1', modulos: [{ codigo: 'CONFIGURADOR', role: 'ADMIN' }] })),
      ).toBe(true);
    });
  });
});

/**
 * SSRF: `testarConexao` montava a requisição com o host/porta que viessem no corpo
 * (o DTO valida `url` só com `@IsString()`), com método e `Authorization` arbitrários
 * e `rejectUnauthorized: false` — de dentro da rede do Docker isso alcança o banco, o
 * MinIO, os outros backends e as rotas `/api/v1/internal/*` que o nginx bloqueia.
 */
describe('IntegracaoService.testarConexao — só host já cadastrado', () => {
  const comEndpoints = (urls: string[]) =>
    new IntegracaoService({
      integracaoApiEndpoint: { findMany: jest.fn().mockResolvedValue(urls.map((url) => ({ url }))) },
    } as any);

  it('host arbitrário é recusado ANTES de qualquer requisição', async () => {
    const svc = comEndpoints(['https://apiportal.capul.com.br:8104/rest/api']);
    await expect(
      svc.testarConexao({ url: 'http://postgres:5432/', metodo: 'GET' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rota interna que o nginx bloqueia de fora também é recusada', async () => {
    const svc = comEndpoints(['https://apiportal.capul.com.br:8104/rest/api']);
    await expect(
      svc.testarConexao({ url: 'http://auth-gateway:3000/api/v1/internal/email/send', metodo: 'POST' } as any),
    ).rejects.toThrow(/não está cadastrado/i);
  });

  it('esquema não-HTTP é recusado', async () => {
    const svc = comEndpoints(['https://apiportal.capul.com.br:8104/rest/api']);
    await expect(
      svc.testarConexao({ url: 'file:///etc/passwd', metodo: 'GET' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('URL malformada é recusada sem estourar', async () => {
    const svc = comEndpoints([]);
    await expect(svc.testarConexao({ url: 'nao-e-url', metodo: 'GET' } as any)).rejects.toThrow(
      /URL inválida/i,
    );
  });

  it('host CADASTRADO passa da checagem (a porta faz parte do host)', async () => {
    const svc = comEndpoints(['https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES']);
    // Não chega a abrir socket no teste: basta não ser recusado pela trava.
    await expect(
      svc.testarConexao({ url: 'https://apiportal.capul.com.br:8104/rest/api/outro', metodo: 'GET', timeoutMs: 1 } as any),
    ).resolves.toBeDefined();
  });

  it('endpoint cadastrado com URL malformada não habilita host nenhum', async () => {
    const svc = comEndpoints(['isso-nao-e-url']);
    await expect(
      svc.testarConexao({ url: 'http://postgres:5432/', metodo: 'GET' } as any),
    ).rejects.toThrow(/não está cadastrado/i);
  });
});
