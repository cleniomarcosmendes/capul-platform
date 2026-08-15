import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AlertNotifierService } from '../alert-notifier/alert-notifier.service';
import { ProtheusFuncionarioService, type SituacaoMatricula } from '../usuario/protheus-funcionario.service';

/** Liga o bloqueio automático. Enquanto `false`, a varredura só RELATA. */
const CHAVE_MODO = 'varredura_matricula_bloquear';
/** Teto de "não encontrados" (%) acima do qual a varredura ABORTA sem bloquear. */
const CHAVE_TETO = 'varredura_matricula_teto_pct';
const TETO_PADRAO_PCT = 20;
/** Pausa entre consultas ao Protheus, em ms. */
const INTERVALO_MS = 300;

export interface ResultadoVarredura {
  verificados: number;
  ativos: number;
  naoEncontrados: number;
  falhas: number;
  semMatricula: number;
  bloqueados: number;
  abortada: boolean;
  motivoAborto?: string;
  /** Quem seria (ou foi) desativado — é o que o Configurador mostra. */
  desligados: Array<{ id: string; username: string; nome: string; matricula: string }>;
}

/**
 * Varredura de matrículas: desativa na plataforma quem já não é funcionário.
 *
 * Pedido do Clenio (15/08/2026): *"não ter usuário ativo na nossa plataforma que
 * tenha sido demitido ou desligado da empresa"*. A matrícula gravada em
 * `core.usuarios` é a chapa do cadastro de FUNCIONÁRIO do Protheus, e o Protheus
 * devolve **apenas ativos** — então, quando ele responde e não acha a chapa, a
 * pessoa foi desligada.
 *
 * ⭐ TRÊS FREIOS, porque esta rotina DESATIVA gente sozinha:
 *
 * 1. **Falha nunca bloqueia.** A verificação é tri-estado
 *    (`ProtheusFuncionarioService.verificarMatricula`): 401, timeout, rede ou
 *    endpoint no ambiente errado dão `FALHA`, que é ignorada. Isto não é zelo
 *    abstrato — o `infoFuncionario` já esteve apontado para HOMOLOGAÇÃO em
 *    produção, e uma rotação da credencial do Protheus (pendente) produz 401 em
 *    todas as chamadas. Nos dois casos, a versão ingênua desativaria a empresa
 *    inteira no primeiro dia.
 * 2. **Freio de mão por proporção.** Passando de `varredura_matricula_teto_pct`
 *    (padrão 20%) de não-encontrados, ABORTA e alerta sem desativar ninguém:
 *    dezenas de demissões no mesmo dia é configuração quebrada, não RH.
 * 3. **Começa só RELATANDO.** Com `varredura_matricula_bloquear` ausente ou
 *    `false`, ela lista quem *seria* desativado e não mexe em nada. Ligar o
 *    bloqueio é decisão explícita, depois de conferir a lista.
 *
 * Fora da análise, por decisão do Clenio: contas **PADRÃO** (login compartilhado
 * de caixa/portaria) não têm matrícula. Usuário **INDIVIDUAL sem matrícula** é
 * REPORTADO, nunca bloqueado — não há o que verificar, e bloquear por ausência de
 * cadastro puniria o usuário por uma lacuna nossa.
 */
@Injectable()
export class VarreduraMatriculaService {
  private readonly logger = new Logger(VarreduraMatriculaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertNotifierService,
    private readonly protheus: ProtheusFuncionarioService,
  ) {}

  /** Diária, 04:00 — depois do backup (03:00) e antes do expediente. */
  @Cron('0 4 * * *', { name: 'core:varredura-matricula', timeZone: 'America/Sao_Paulo' })
  async run(): Promise<ResultadoVarredura> {
    const bloquear = await this.leBool(CHAVE_MODO, false);
    const tetoPct = await this.leNum(CHAVE_TETO, TETO_PADRAO_PCT);
    const inicio = Date.now();

    // Só INDIVIDUAL ATIVO: PADRÃO é login compartilhado e não tem matrícula.
    const usuarios = await this.prisma.usuario.findMany({
      where: { status: 'ATIVO', tipo: 'INDIVIDUAL' },
      select: { id: true, username: true, nome: true, matricula: true },
    });

    const comMatricula = usuarios.filter((u) => (u.matricula ?? '').trim() !== '');
    const semMatricula = usuarios.length - comMatricula.length;

    const r: ResultadoVarredura = {
      verificados: 0, ativos: 0, naoEncontrados: 0, falhas: 0,
      semMatricula, bloqueados: 0, abortada: false, desligados: [],
    };

    for (const u of comMatricula) {
      const situacao: SituacaoMatricula = await this.protheus.verificarMatricula(u.matricula!);
      r.verificados++;
      if (situacao === 'ATIVO') r.ativos++;
      else if (situacao === 'FALHA') r.falhas++;
      else {
        r.naoEncontrados++;
        r.desligados.push({ id: u.id, username: u.username, nome: u.nome, matricula: u.matricula! });
      }
      // Espaça TODAS as consultas, não só as que acharam algo: são ~130 chamadas
      // seguidas ao ERP, e o Protheus é sistema de terceiro em produção.
      await this.pausa();
    }

    // Freio de mão: proporção alta = problema nosso, não demissão em massa.
    const base = r.ativos + r.naoEncontrados; // só quem o Protheus REALMENTE respondeu
    const pct = base > 0 ? (r.naoEncontrados / base) * 100 : 0;
    if (base > 0 && pct > tetoPct) {
      r.abortada = true;
      r.motivoAborto =
        `${r.naoEncontrados} de ${base} matrículas não foram encontradas (${pct.toFixed(1)}%), ` +
        `acima do teto de ${tetoPct}%. Nada foi bloqueado — verifique o ambiente do endpoint ` +
        `infoFuncionario e a credencial do Protheus antes de concluir que houve desligamento.`;
      await this.alerta('error', r.motivoAborto, r);
      await this.registrar(r, bloquear, Date.now() - inicio);
      return r;
    }

    if (bloquear && r.desligados.length > 0) {
      const ids = r.desligados.map((d) => d.id);
      const upd = await this.prisma.usuario.updateMany({
        where: { id: { in: ids } },
        data: { status: 'INATIVO' },
      });
      r.bloqueados = upd.count;
    }

    await this.registrar(r, bloquear, Date.now() - inicio);

    if (r.desligados.length > 0) {
      const verbo = bloquear ? 'desativados' : 'seriam desativados (modo relatório)';
      await this.alerta(
        'warn',
        `${r.desligados.length} usuário(s) ${verbo}: ` +
          r.desligados.map((d) => `${d.username} (${d.matricula})`).join(', '),
        r,
      );
    }
    if (r.semMatricula > 0) {
      // Não é erro do usuário: é cadastro por completar — e enquanto estiver
      // vazio, um desligado com esse login NÃO é alcançado pela varredura.
      this.logger.warn(
        `${r.semMatricula} usuário(s) INDIVIDUAL ativo(s) sem matrícula — ficam FORA da verificação. ` +
          'Preencher no Configurador para que a varredura os alcance.',
      );
    }
    return r;
  }

  /** Última execução, para a tela do Configurador. */
  async ultimaExecucao() {
    return this.prisma.systemLog.findFirst({
      where: { module: 'VARREDURA_MATRICULA' },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async registrar(r: ResultadoVarredura, bloquear: boolean, ms: number) {
    const msg = r.abortada
      ? `Varredura ABORTADA: ${r.motivoAborto}`
      : `Varredura: ${r.verificados} verificados · ${r.ativos} ativos · ${r.naoEncontrados} desligados · ` +
        `${r.falhas} falhas · ${r.semMatricula} sem matrícula · ${r.bloqueados} bloqueados`;
    this.logger.log(`${msg} (${ms}ms, modo=${bloquear ? 'BLOQUEIO' : 'RELATORIO'})`);
    await this.prisma.systemLog.create({
      data: {
        level: r.abortada ? 'ERROR' : r.desligados.length > 0 ? 'WARN' : 'INFO',
        message: msg,
        module: 'VARREDURA_MATRICULA',
        action: bloquear ? 'BLOQUEIO' : 'RELATORIO',
        metadata: { ...r, duracaoMs: ms } as unknown as object,
      },
    });
  }

  private async alerta(nivel: 'warn' | 'error', mensagem: string, r: ResultadoVarredura) {
    try {
      await this.alerts.notify({
        severity: nivel,
        title: 'Varredura de matrículas (Protheus)',
        message: mensagem,
        source: 'auth',
        context: { verificados: r.verificados, naoEncontrados: r.naoEncontrados, falhas: r.falhas },
      });
    } catch {
      /* alerta é best-effort: não pode derrubar a varredura */
    }
  }

  private pausa() {
    return new Promise((r) => setTimeout(r, INTERVALO_MS));
  }

  private async leBool(key: string, padrao: boolean): Promise<boolean> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (!row?.value) return padrao;
    return ['true', '1', 'sim'].includes(row.value.trim().toLowerCase());
  }

  private async leNum(key: string, padrao: number): Promise<number> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    const n = Number(row?.value);
    return Number.isFinite(n) && n > 0 ? n : padrao;
  }
}
