import { Test } from '@nestjs/testing';
import { SacEmailService } from './sac-email.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

describe('SacEmailService (SAC Fase 3a)', () => {
  let service: SacEmailService;
  let prisma: ReturnType<typeof createPrismaMock>;

  // Limpa as envs IMAP entre testes pra controlar o "configurada".
  const ENV = ['SAC_IMAP_HOST', 'SAC_IMAP_USER', 'SAC_IMAP_PASSWORD', 'SAC_IMAP_PORT', 'SAC_IMAP_TLS'];
  beforeEach(async () => {
    ENV.forEach((k) => delete process.env[k]);
    prisma = createPrismaMock();
    prisma.sacEmailConfig.upsert.mockResolvedValue({ id: 1, mailboxFolder: 'INBOX', enabled: false });
    const module = await Test.createTestingModule({
      providers: [SacEmailService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SacEmailService);
  });
  afterAll(() => ENV.forEach((k) => delete process.env[k]));

  it('getConfig: sem envs → conexão NÃO configurada (senha não exposta)', async () => {
    const { conexao } = await service.getConfig();
    expect(conexao.origem).toBe('ambiente');
    expect(conexao.configurada).toBe(false);
    expect(conexao.senhaConfigurada).toBe(false);
    expect(conexao).not.toHaveProperty('pass');
  });

  it('getConfig: com envs → configurada=true, mas a senha nunca volta', async () => {
    process.env.SAC_IMAP_HOST = 'imap.capul.com.br';
    process.env.SAC_IMAP_USER = 'sac@capul.com.br';
    process.env.SAC_IMAP_PASSWORD = 'segredo';
    const { conexao } = await service.getConfig();
    expect(conexao.configurada).toBe(true);
    expect(conexao.senhaConfigurada).toBe(true);
    expect(conexao.host).toBe('imap.capul.com.br');
    expect(JSON.stringify(conexao)).not.toContain('segredo');
  });

  it('testConnection: sem conexão configurada → ok:false, sem tentar IMAP', async () => {
    const r = await service.testConnection();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/não configurada|nao configurada/i);
  });

  it('updateConfig: aplica os toggles + audita updatedBy', async () => {
    prisma.sacEmailConfig.update.mockResolvedValue({ id: 1, enabled: true, pollIntervalMinutes: 10 });
    await service.updateConfig({ enabled: true, pollIntervalMinutes: 10, mailboxFolder: '  INBOX  ' }, 'user-1');
    expect(prisma.sacEmailConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ enabled: true, pollIntervalMinutes: 10, mailboxFolder: 'INBOX', updatedBy: 'user-1' }),
      }),
    );
  });

  // ===== 3b — busca/classificação =====

  it('buscarAgora: sem conexão configurada → ok:false (não tenta IMAP)', async () => {
    const r = await service.buscarAgora();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/não configurada|nao configurada/i);
  });

  it('buscarAgora: ação MANUAL ignora o freio de mão (não barra por pauseSync)', async () => {
    // Host inválido → falha graciosa de conexão (ok:false), mas o motivo NÃO é
    // "pausado": a busca manual tenta conectar mesmo com pauseSync=true.
    process.env.SAC_IMAP_HOST = 'host-invalido.invalid';
    process.env.SAC_IMAP_USER = 'u';
    process.env.SAC_IMAP_PASSWORD = 'p';
    prisma.sacEmailConfig.upsert.mockResolvedValue({ id: 1, mailboxFolder: 'INBOX', pauseSync: true });
    const r = await service.buscarAgora();
    expect(r.ok).toBe(false);
    expect(r.error ?? '').not.toMatch(/pausad/i);
  });

  // classificar é privado — exercitado via (service as any) com ParsedMail fake.
  function mail({ from, subject, headers = {} }: { from?: string; subject?: string; headers?: Record<string, string> }) {
    const h = new Map(Object.entries(headers));
    return {
      from: from ? { value: [{ address: from }] } : undefined,
      subject,
      headers: h,
      date: null,
      messageId: '<x@y>',
    };
  }

  it('classificar: remetente próprio (SMTP_FROM) → SKIPPED_OWN', async () => {
    process.env.SMTP_FROM = 'sac@capul.com.br';
    const r = await (service as any).classificar(mail({ from: 'SAC@capul.com.br', subject: '[SAC-1] oi' }));
    expect(r.resultado).toBe('SKIPPED_OWN');
    delete process.env.SMTP_FROM;
  });

  it('classificar: auto-resposta (Auto-Submitted) → SKIPPED_AUTO', async () => {
    const r = await (service as any).classificar(mail({ from: 'cli@x.com', subject: '[SAC-1] re', headers: { 'auto-submitted': 'auto-replied' } }));
    expect(r.resultado).toBe('SKIPPED_AUTO');
  });

  it('classificar: sem [SAC-n] no assunto → UNMATCHED', async () => {
    const r = await (service as any).classificar(mail({ from: 'cli@x.com', subject: 'dúvida qualquer' }));
    expect(r.resultado).toBe('UNMATCHED');
    expect(r.sacNumero).toBeNull();
  });

  it('classificar: [SAC-n] de chamado existente → MATCHED', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ id: 'ch-9' });
    const r = await (service as any).classificar(mail({ from: 'cli@x.com', subject: 'Re: [SAC-42] pedido' }));
    expect(r.resultado).toBe('MATCHED');
    expect(r.sacNumero).toBe(42);
    expect(r.chamadoId).toBe('ch-9');
  });

  it('classificar: [SAC-n] inexistente → UNMATCHED (com número)', async () => {
    prisma.chamado.findUnique.mockResolvedValue(null);
    const r = await (service as any).classificar(mail({ from: 'cli@x.com', subject: '[SAC-999] x' }));
    expect(r.resultado).toBe('UNMATCHED');
    expect(r.sacNumero).toBe(999);
  });
});
