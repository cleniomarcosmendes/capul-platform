import { Test } from '@nestjs/testing';
import { ChamadoLembreteService } from './chamado-lembrete.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailEnvolvidosService } from '../email/email-envolvidos.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

const DIA = 86_400_000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA);

const CFG = {
  id: 1, enabled: true, diasInatividadeEquipe: 3, diasInatividadeSolicitante: 3,
  diasEscala: 7, intervaloReenvioDias: 3, maxLembretes: 3, autoFechar: true,
  diasAutoFechamento: 3, horaExecucao: 8,
};

// Helper: chamado "cru" no formato do findMany do service.
function chamado(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: `id-${over.numero ?? 1}`, numero: over.numero ?? 1, titulo: 'Teste',
    status: 'EM_ATENDIMENTO', updatedAt: diasAtras(10),
    ultimoLembreteEm: null, lembretesEnviados: 0, dataLimiteSla: null,
    tecnicoId: 'tec-1', solicitanteId: 'sol-1', clienteEmail: null,
    solicitante: { id: 'sol-1', email: 'sol@capul.com.br' },
    equipeAtual: { atendeSac: false, membros: [{ usuarioId: 'tec-1' }, { usuarioId: 'm-2' }] },
    ...over,
  };
}

describe('ChamadoLembreteService — classificação (dry-run)', () => {
  let service: ChamadoLembreteService;
  let prisma: ReturnType<typeof createPrismaMock>;

  async function rodar(chamados: ReturnType<typeof chamado>[]) {
    prisma.chamado.findMany.mockResolvedValue(chamados);
    prisma.historicoChamado.groupBy.mockResolvedValue(
      chamados.map((c) => ({ chamadoId: c.id, _max: { createdAt: c.updatedAt } })),
    );
    return service.executarVarredura({ dryRun: true });
  }

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.chamadoLembreteConfig.upsert.mockResolvedValue({ ...CFG });
    const email = { enviar: jest.fn(), enviarExterno: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ChamadoLembreteService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailEnvolvidosService, useValue: email },
      ],
    }).compile();
    service = module.get(ChamadoLembreteService);
  });

  it('chamado de equipe parado ≥ Y (e < escala) → lembrar TÉCNICO', async () => {
    const r = await rodar([chamado({ numero: 10, updatedAt: diasAtras(4) })]);
    expect(r.lembrarTecnico).toEqual([10]);
    expect(r.escalados).toEqual([]);
  });

  it('chamado parado ≥ escala → ESCALADO', async () => {
    const r = await rodar([chamado({ numero: 11, updatedAt: diasAtras(9) })]);
    expect(r.escalados).toEqual([11]);
    expect(r.lembrarTecnico).toEqual([]);
  });

  it('SLA estourado (mesmo abaixo do limiar de escala) → ESCALADO', async () => {
    const r = await rodar([chamado({ numero: 12, updatedAt: diasAtras(4), dataLimiteSla: diasAtras(1) })]);
    expect(r.escalados).toEqual([12]);
  });

  it('parado < limiar da equipe → nada', async () => {
    const r = await rodar([chamado({ numero: 13, updatedAt: diasAtras(1) })]);
    expect(r.lembrarTecnico).toEqual([]);
    expect(r.escalados).toEqual([]);
  });

  it('PENDENTE_USUARIO interno parado ≥ X → lembrar SOLICITANTE', async () => {
    const r = await rodar([chamado({ numero: 14, status: 'PENDENTE_USUARIO', updatedAt: diasAtras(4) })]);
    expect(r.lembrarSolicitante).toEqual([14]);
  });

  it('PENDENTE_USUARIO de SAC (atendeSac + clienteEmail) → lembrar CLIENTE SAC', async () => {
    const r = await rodar([chamado({
      numero: 15, status: 'PENDENTE_USUARIO', updatedAt: diasAtras(4),
      clienteEmail: 'cliente@x.com', equipeAtual: { atendeSac: true, membros: [] },
    })]);
    expect(r.lembrarClienteSac).toEqual([15]);
    expect(r.lembrarSolicitante).toEqual([]);
  });

  it('PENDENTE_USUARIO com lembretes esgotados e prazo vencido → FECHAR', async () => {
    const r = await rodar([chamado({
      numero: 16, status: 'PENDENTE_USUARIO', updatedAt: diasAtras(10),
      lembretesEnviados: 3, ultimoLembreteEm: diasAtras(4),
    })]);
    expect(r.fechados).toEqual([16]);
    expect(r.lembrarSolicitante).toEqual([]);
  });

  it('respeita o intervalo de reenvio (lembrete recente → não reenvia)', async () => {
    const r = await rodar([chamado({ numero: 17, updatedAt: diasAtras(9), lembretesEnviados: 1, ultimoLembreteEm: diasAtras(1) })]);
    expect(r.escalados).toEqual([]);
    expect(r.lembrarTecnico).toEqual([]);
  });

  it('sem técnico e sem escala → sem destinatário', async () => {
    const r = await rodar([chamado({ numero: 18, updatedAt: diasAtras(4), tecnicoId: null, equipeAtual: { atendeSac: false, membros: [] } })]);
    expect(r.semDestino).toBe(1);
    expect(r.lembrarTecnico).toEqual([]);
  });
});
