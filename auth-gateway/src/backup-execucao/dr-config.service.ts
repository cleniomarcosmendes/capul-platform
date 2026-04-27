import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Configurações de Backup/DR — armazenadas em `core.system_config` com
 * prefixo `dr_*` para evitar nova migration. UI em
 * `configurador/src/pages/backup-dr/BackupDrPage.tsx`.
 *
 * Auditoria 26/04/2026 Sprint 4 — visibilidade no Configurador.
 */
export interface DrConfig {
  rtoHoras: number | null;
  rpoHoras: number | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  retencaoDiarios: number | null;
  retencaoSemanas: number | null;
  retencaoMeses: number | null;
  destinoOffsite: string | null;
  emailAlerta: string | null;
  webhookAlerta: string | null;
  agendamentoCron: string | null;
  proximaRevisao: string | null;
}

const KEYS: Record<keyof DrConfig, string> = {
  rtoHoras: 'dr_rto_horas',
  rpoHoras: 'dr_rpo_horas',
  aprovadoPor: 'dr_aprovado_por',
  aprovadoEm: 'dr_aprovado_em',
  retencaoDiarios: 'dr_retencao_diarios',
  retencaoSemanas: 'dr_retencao_semanas',
  retencaoMeses: 'dr_retencao_meses',
  destinoOffsite: 'dr_destino_offsite',
  emailAlerta: 'dr_email_alerta',
  webhookAlerta: 'dr_webhook_alerta',
  agendamentoCron: 'dr_agendamento_cron',
  proximaRevisao: 'dr_proxima_revisao',
};

/**
 * Defaults sugeridos quando o valor ainda nao foi configurado. Vem da
 * proposta aprovada em `docs/DR_OBJETIVOS.md`. ADMIN ajusta no Configurador
 * e o save persiste os defaults junto com as customizacoes.
 */
function buildDefaults(): DrConfig {
  // Proxima revisao: 6 meses a frente (semestral, conforme DR_OBJETIVOS.md §"Proximos passos")
  const proxRev = new Date();
  proxRev.setMonth(proxRev.getMonth() + 6);

  return {
    rtoHoras: 4,                       // aprovado pelo Diretor TI
    rpoHoras: 24,                      // aprovado pelo Diretor TI
    aprovadoPor: null,                 // ADMIN preenche
    aprovadoEm: null,                  // ADMIN preenche
    retencaoDiarios: 30,               // GFS — diarios 30d
    retencaoSemanas: 8,                // GFS — semanais 8 semanas
    retencaoMeses: 12,                 // GFS — mensais 12 meses
    destinoOffsite: null,              // ADMIN preenche (s3://... ou similar)
    emailAlerta: 'ti@capul.com.br',
    webhookAlerta: null,               // ADMIN preenche (Slack/Teams URL)
    agendamentoCron: '0 2 * * *',      // diario 02:00 (alinhado com systemd timer)
    proximaRevisao: proxRev.toISOString(),
  };
}

@Injectable()
export class DrConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<DrConfig> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { in: Object.values(KEYS) } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string) => {
      const v = map.get(k);
      return v != null && v !== '' ? Number(v) : null;
    };
    const persisted: DrConfig = {
      rtoHoras: num(KEYS.rtoHoras),
      rpoHoras: num(KEYS.rpoHoras),
      aprovadoPor: map.get(KEYS.aprovadoPor) ?? null,
      aprovadoEm: map.get(KEYS.aprovadoEm) ?? null,
      retencaoDiarios: num(KEYS.retencaoDiarios),
      retencaoSemanas: num(KEYS.retencaoSemanas),
      retencaoMeses: num(KEYS.retencaoMeses),
      destinoOffsite: map.get(KEYS.destinoOffsite) ?? null,
      emailAlerta: map.get(KEYS.emailAlerta) ?? null,
      webhookAlerta: map.get(KEYS.webhookAlerta) ?? null,
      agendamentoCron: map.get(KEYS.agendamentoCron) ?? null,
      proximaRevisao: map.get(KEYS.proximaRevisao) ?? null,
    };

    // Aplica defaults sugeridos pra campos ainda nao configurados.
    // ADMIN ve a sugestao ja preenchida e so ajusta o que for diferente.
    const defaults = buildDefaults();
    const result = {} as DrConfig;
    (Object.keys(defaults) as Array<keyof DrConfig>).forEach((k) => {
      const v = persisted[k];
      // @ts-expect-error union dinamica entre string|number|null
      result[k] = v ?? defaults[k];
    });
    return result;
  }

  async update(patch: Partial<DrConfig>): Promise<DrConfig> {
    const entries = Object.entries(patch) as [keyof DrConfig, unknown][];
    for (const [field, value] of entries) {
      const key = KEYS[field];
      if (!key) continue;
      const stringValue = value == null ? null : String(value);
      await this.prisma.systemConfig.upsert({
        where: { key },
        create: {
          key,
          value: stringValue,
          categoria: 'backup_dr',
          descricao: `Configuração DR — ${field}`,
        },
        update: { value: stringValue },
      });
    }
    return this.get();
  }
}
