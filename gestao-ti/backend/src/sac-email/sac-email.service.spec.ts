import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SacEmailService } from './sac-email.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacaoService } from '../notificacao/notificacao.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

describe('SacEmailService (SAC Fase 3)', () => {
  let service: SacEmailService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let notificacao: { criarParaUsuario: jest.Mock; criarParaUsuarios: jest.Mock };

  // Limpa as envs IMAP entre testes pra controlar o "configurada".
  const ENV = ['SAC_IMAP_HOST', 'SAC_IMAP_USER', 'SAC_IMAP_PASSWORD', 'SAC_IMAP_PORT', 'SAC_IMAP_TLS'];
  beforeEach(async () => {
    ENV.forEach((k) => delete process.env[k]);
    prisma = createPrismaMock();
    prisma.sacEmailConfig.upsert.mockResolvedValue({ id: 1, mailboxFolder: 'INBOX', enabled: false });
    notificacao = { criarParaUsuario: jest.fn().mockResolvedValue({}), criarParaUsuarios: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        SacEmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificacaoService, useValue: notificacao },
      ],
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
    prisma.usuario.findFirst.mockResolvedValue({ id: 'sys-1' }); // usuário de sistema presente
    const r = await service.buscarAgora();
    expect(r.ok).toBe(false);
    expect(r.error ?? '').not.toMatch(/pausad/i);
  });

  it('buscarAgora: sem usuário de sistema (sistema_sac) → ok:false claro', async () => {
    process.env.SAC_IMAP_HOST = 'h';
    process.env.SAC_IMAP_USER = 'u';
    process.env.SAC_IMAP_PASSWORD = 'p';
    prisma.usuario.findFirst.mockResolvedValue(null);
    const r = await service.buscarAgora();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/sistema do SAC ausente/i);
  });

  // ===== 4a — Caixa de Triagem =====

  it('vincularTriagem: cria comentário (via triagem) + leva anexos + marca RESOLVIDO', async () => {
    prisma.sacEmailIngestao.findUnique.mockResolvedValue({
      id: 'ing-1', triagemStatus: 'PENDENTE', fromAddr: 'cli@ex.com', corpoTexto: 'oi sem protocolo',
      anexos: [{ id: 'a1', nomeOriginal: 'foto.jpg', nomeArquivo: 'uuid.jpg', mimeType: 'image/jpeg', tamanho: 10 }],
    });
    prisma.chamado.findUnique.mockResolvedValue({ id: 'ch-1', equipeAtualId: 'eq-sac' });
    prisma.equipe.findUnique.mockResolvedValue({ atendeSac: true });
    prisma.usuario.findFirst.mockResolvedValue({ id: 'sys-1' });

    const r = await service.vincularTriagem('ing-1', 1405, 'user-1');
    expect(r.ok).toBe(true);
    expect(r.anexos).toBe(1);
    expect(prisma.historicoChamado.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publico: true, usuarioId: 'sys-1', chamadoId: 'ch-1', descricao: expect.stringContaining('via triagem') }) }),
    );
    expect(prisma.anexoChamado.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nomeArquivo: 'uuid.jpg', chamadoId: 'ch-1' }) }),
    );
    expect(prisma.sacEmailIngestao.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ing-1' }, data: expect.objectContaining({ triagemStatus: 'RESOLVIDO', chamadoVinculadoId: 'ch-1', triadoPor: 'user-1' }) }),
    );
  });

  it('vincularTriagem: chamado que não é de SAC → erro', async () => {
    prisma.sacEmailIngestao.findUnique.mockResolvedValue({ id: 'ing-1', triagemStatus: 'PENDENTE', anexos: [] });
    prisma.chamado.findUnique.mockResolvedValue({ id: 'ch-x', equipeAtualId: 'eq-ti' });
    prisma.equipe.findUnique.mockResolvedValue({ atendeSac: false });
    await expect(service.vincularTriagem('ing-1', 10, 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('vincularTriagem: item já tratado → erro', async () => {
    prisma.sacEmailIngestao.findUnique.mockResolvedValue({ id: 'ing-1', triagemStatus: 'RESOLVIDO', anexos: [] });
    await expect(service.vincularTriagem('ing-1', 10, 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('abrirTriagem: cria chamado de SAC (solicitante sistema, canal EMAIL) + resolve a triagem', async () => {
    prisma.sacEmailIngestao.findUnique.mockResolvedValue({
      id: 'ing-1', triagemStatus: 'PENDENTE', subject: 'Reclamação nova', corpoTexto: 'veio errado', fromAddr: 'novo@ex.com',
      anexos: [{ id: 'a1', nomeOriginal: 'foto.jpg', nomeArquivo: 'u.jpg', mimeType: 'image/jpeg', tamanho: 10 }],
    });
    prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-sac', departamentoId: 'dep-sac', atendeSac: true, status: 'ATIVO' });
    prisma.usuario.findFirst.mockResolvedValue({ id: 'sys-1' });
    prisma.chamado.create.mockResolvedValue({ id: 'ch-new', numero: 1500 });

    const r = await service.abrirTriagem('ing-1', 'eq-sac', 'user-1', 'fil-1');
    expect(r).toMatchObject({ ok: true, numero: 1500, anexos: 1 });
    expect(prisma.chamado.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        titulo: 'Reclamação nova', descricao: 'veio errado', solicitanteId: 'sys-1',
        equipeAtualId: 'eq-sac', departamentoId: 'dep-sac', filialId: 'fil-1', clienteEmail: 'novo@ex.com', canalOrigem: 'EMAIL',
      }) }),
    );
    expect(prisma.historicoChamado.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'ABERTURA', publico: true, usuarioId: 'sys-1' }) }),
    );
    expect(prisma.sacEmailIngestao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ triagemStatus: 'RESOLVIDO', chamadoVinculadoId: 'ch-new', sacNumero: 1500 }) }),
    );
  });

  it('abrirTriagem: aplica a SLA da equipe (slaDefinicaoId + dataLimiteSla)', async () => {
    prisma.sacEmailIngestao.findUnique.mockResolvedValue({ id: 'ing-1', triagemStatus: 'PENDENTE', subject: 'x', corpoTexto: 'y', fromAddr: 'a@b.com', anexos: [] });
    prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-sac', departamentoId: 'dep', atendeSac: true, status: 'ATIVO' });
    prisma.usuario.findFirst.mockResolvedValue({ id: 'sys-1' });
    prisma.slaDefinicao.findUnique.mockResolvedValue({ id: 'sla-1', horasResolucao: 24 });
    prisma.chamado.create.mockResolvedValue({ id: 'ch-new', numero: 1600 });

    await service.abrirTriagem('ing-1', 'eq-sac', 'user-1', 'fil-1');
    const data = prisma.chamado.create.mock.calls[0][0].data;
    expect(data.slaDefinicaoId).toBe('sla-1');
    expect(data.dataLimiteSla).toBeInstanceOf(Date);
    expect(data.prioridade).toBe('MEDIA');
  });

  it('abrirTriagem: equipe não é de SAC → erro', async () => {
    prisma.sacEmailIngestao.findUnique.mockResolvedValue({ id: 'ing-1', triagemStatus: 'PENDENTE', anexos: [] });
    prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-ti', departamentoId: 'dep-ti', atendeSac: false, status: 'ATIVO' });
    await expect(service.abrirTriagem('ing-1', 'eq-ti', 'user-1', 'fil-1')).rejects.toThrow(BadRequestException);
  });

  it('descartarTriagem: marca DESCARTADO', async () => {
    prisma.sacEmailIngestao.findUnique.mockResolvedValue({ id: 'ing-1', triagemStatus: 'PENDENTE' });
    const r = await service.descartarTriagem('ing-1', 'user-1');
    expect(r.ok).toBe(true);
    expect(prisma.sacEmailIngestao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ triagemStatus: 'DESCARTADO', triadoPor: 'user-1' }) }),
    );
  });

  it('ingerirNoChamado (3c): cria comentário público do usuário-sistema + notifica o técnico', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ id: 'ch-1', numero: 7, tecnicoId: 'tec-1' });
    prisma.historicoChamado.create.mockResolvedValue({ id: 'h1' });
    const parsed = {
      from: { value: [{ address: 'cliente@ex.com' }] },
      subject: 'Re: [SAC-7] obrigado',
      text: 'Perfeito, pode fechar!',
      attachments: [],
    };
    const r = await (service as any).ingerirNoChamado('ch-1', parsed, 'sys-1');
    expect(r.anexos).toBe(0);
    expect(prisma.historicoChamado.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'COMENTARIO',
          publico: true,
          usuarioId: 'sys-1',
          chamadoId: 'ch-1',
          descricao: expect.stringContaining('respondeu por e-mail'),
        }),
      }),
    );
    expect(notificacao.criarParaUsuario).toHaveBeenCalledWith(
      'tec-1',
      'CHAMADO_ATUALIZADO',
      expect.stringContaining('SAC #7'),
      expect.any(String),
      { chamadoId: 'ch-1' },
    );
  });

  // ===== 3d — agendamento automático (deveAgendar) =====
  describe('deveAgendar', () => {
    const base = { enabled: true, pauseSync: false, pollIntervalMinutes: 5, lastPollAt: null as Date | null };
    const now = 1_000_000_000_000;

    it('nunca rodou (lastPollAt null) + ligado + configurada → true', () => {
      expect(service.deveAgendar({ ...base }, true, now)).toBe(true);
    });
    it('conexão não configurada → false', () => {
      expect(service.deveAgendar({ ...base }, false, now)).toBe(false);
    });
    it('automático desligado → false', () => {
      expect(service.deveAgendar({ ...base, enabled: false }, true, now)).toBe(false);
    });
    it('pausado (freio de mão) → false', () => {
      expect(service.deveAgendar({ ...base, pauseSync: true }, true, now)).toBe(false);
    });
    it('último poll recente (< intervalo) → false', () => {
      const lastPollAt = new Date(now - 2 * 60_000); // 2 min atrás, intervalo 5
      expect(service.deveAgendar({ ...base, lastPollAt }, true, now)).toBe(false);
    });
    it('último poll antigo (>= intervalo) → true', () => {
      const lastPollAt = new Date(now - 6 * 60_000); // 6 min atrás, intervalo 5
      expect(service.deveAgendar({ ...base, lastPollAt }, true, now)).toBe(true);
    });
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

  it('classificar: [SAC-n] de chamado de SAC existente → MATCHED', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ id: 'ch-9', equipeAtualId: 'eq-sac' });
    prisma.equipe.findUnique.mockResolvedValue({ atendeSac: true });
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

  it('classificar: [SAC-n] gigante (> Int4) → UNMATCHED sem consultar chamado (não estoura)', async () => {
    const r = await (service as any).classificar(mail({ from: 'cli@x.com', subject: '[SAC-9999999999] forjado' }));
    expect(r.resultado).toBe('UNMATCHED');
    expect(r.sacNumero).toBeNull();
    expect(prisma.chamado.findUnique).not.toHaveBeenCalled(); // nem tenta — evitaria o throw do Prisma
  });

  it('classificar: [SAC-n] de chamado que NÃO é de SAC → UNMATCHED (não threada)', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ id: 'ch-normal', equipeAtualId: 'eq-ti' });
    prisma.equipe.findUnique.mockResolvedValue({ atendeSac: false });
    const r = await (service as any).classificar(mail({ from: 'cli@x.com', subject: '[SAC-5] x' }));
    expect(r.resultado).toBe('UNMATCHED');
    expect(r.motivo).toMatch(/não é um chamado de SAC/i);
  });

  describe('extrairRespostaNova (strip de citação/assinatura)', () => {
    const strip = (t: string) => (service as any).extrairRespostaNova(t) as string;

    it('Gmail PT-BR: mantém só a resposta nova, corta "Em … escreveu:" + citação + assinatura', () => {
      const email = [
        'clenio resposta 1730 - gmail reposta',
        '',
        'Em qui., 25 de jun. de 2026 às 17:33, <testeplatform@capul.com.br> escreveu:',
        '',
        '> clenio teste email correto',
        '> Protocolo [SAC-1730].',
        '',
        '-- ',
        'Clenio Marcos Mendes',
        '38 2102-5125',
      ].join('\n');
      expect(strip(email)).toBe('clenio resposta 1730 - gmail reposta');
    });

    it('corta linhas citadas ">" mesmo sem o cabeçalho "escreveu:"', () => {
      expect(strip('minha resposta\n\n> texto antigo\n> mais antigo')).toBe('minha resposta');
    });

    it('remove a assinatura após "-- "', () => {
      expect(strip('resposta\n-- \nFulano\ntel')).toBe('resposta');
    });

    it('e-mail novo (sem citação) fica intacto', () => {
      expect(strip('Quero abrir uma reclamação sobre o produto X.')).toBe('Quero abrir uma reclamação sobre o produto X.');
    });

    it('só citação (sem resposta nova) → salvaguarda devolve o texto bruto', () => {
      const so = '> tudo citado\n> nada novo';
      expect(strip(so)).toBe(so);
    });
  });
});
