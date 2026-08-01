import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, StatusPlanejamento, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { CofreStorageService } from '../cofre/cofre-storage.service.js';
import { LocalClienteService } from '../local/local-cliente.service.js';
import type { ReciboBinario } from '../despesa/despesa.service.js';
import { AdicionarVisitaDto, ApontarVisitaDto, AtualizarAtividadeDto, AtualizarSupervisorDto, CriarAtividadeDto, CriarSupervisorDto, CriarViagemSupervisorDto, EditarDespesaSupervisorDto, EditarViagemSupervisorDto, LancarAdiantamentoDto, LancarDespesaSupervisorDto } from './dto.js';

/** Normaliza matrícula → chapa E-prefixada (E+5díg), colapsando `E01047`/`01047`/
 *  `1047` no mesmo valor. Mesma regra do `frota.service` (match de condutor) — usar
 *  para comparar matrículas sem depender do formato digitado. */
const chapa = (m: string) => 'E' + (m || '').replace(/\D/g, '').slice(-5).padStart(5, '0');
/** Máximo de comprovantes (foto/PDF) por despesa. */
const MAX_ANEXOS_DESPESA = 5;

/**
 * Catálogos do módulo Supervisores/RDV (Fase 3a): Atividade de visita e Região
 * (N:N com município). Escopo por filial: cada filial vê os SEUS + os globais
 * (filialId null). Escrita é gateada a gestor no controller.
 */
@Injectable()
export class SupervisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly condutor: ProtheusCondutorService,
    private readonly core: CoreLookupService,
    private readonly storage: CofreStorageService,
    private readonly locais: LocalClienteService,
  ) {}

  /** Anexa o recibo (foto/PDF) à despesa: sobe no cofre (MinIO) e grava
   *  objectKey/hash/mime no registro. Mesmo mecanismo da frota. */
  private async anexarReciboDespesa(despesaId: string, filialId: string, recibo: ReciboBinario) {
    const { objectKey, hash } = await this.storage.put(recibo.buffer, { filialId, refId: despesaId, mimeType: recibo.mimetype });
    return this.prisma.despesaVeiculo.update({
      where: { id: despesaId },
      data: { comprovanteObjectKey: objectKey, comprovanteHash: hash, comprovanteMime: recibo.mimetype ?? null },
    });
  }

  /** Anexa N comprovantes (foto/PDF) à despesa — até MAX_ANEXOS_DESPESA no total. Cada
   *  binário vai pro cofre (MinIO); grava chave/hash/mime/ordem. Excedente é ignorado. */
  private async anexarComprovantes(despesaId: string, filialId: string, recibos: ReciboBinario[]) {
    if (!recibos.length) return;
    const jaTem = await this.prisma.anexoDespesa.count({ where: { despesaId } });
    const espaco = MAX_ANEXOS_DESPESA - jaTem;
    if (espaco <= 0) throw new BadRequestException(`Máximo de ${MAX_ANEXOS_DESPESA} comprovantes por despesa.`);
    let ordem = jaTem;
    for (const r of recibos.slice(0, espaco)) {
      const { objectKey, hash } = await this.storage.put(r.buffer, { filialId, refId: despesaId, mimeType: r.mimetype });
      await this.prisma.anexoDespesa.create({ data: { despesaId, objectKey, hash, mime: r.mimetype ?? null, tamanho: r.size, ordem: ordem++ } });
    }
  }

  /** Baixa um anexo específico da despesa (stream). Escopo por filial/viagem-supervisor. */
  async obterAnexoDespesa(viagemId: string, despesaId: string, anexoId: string, user: JwtPayload): Promise<{ buffer: Buffer; mimeType: string }> {
    await this.planejamentoDoDono(viagemId, user);
    const a = await this.prisma.anexoDespesa.findUnique({ where: { id: anexoId }, include: { despesa: { select: { viagemId: true } } } });
    if (!a || a.despesaId !== despesaId || a.despesa.viagemId !== viagemId) throw new NotFoundException('Anexo não encontrado.');
    const buffer = await this.storage.get(a.objectKey);
    return { buffer, mimeType: a.mime ?? 'application/octet-stream' };
  }

  /** Remove um anexo da despesa (some do cofre + do banco). */
  async removerAnexoDespesa(viagemId: string, despesaId: string, anexoId: string, user: JwtPayload) {
    await this.planejamentoDoDono(viagemId, user);
    const a = await this.prisma.anexoDespesa.findUnique({ where: { id: anexoId }, include: { despesa: { select: { viagemId: true } } } });
    if (!a || a.despesaId !== despesaId || a.despesa.viagemId !== viagemId) throw new NotFoundException('Anexo não encontrado.');
    await this.storage.remove(a.objectKey).catch(() => undefined);
    await this.prisma.anexoDespesa.delete({ where: { id: anexoId } });
    return { ok: true };
  }

  // ---- Cadastro de Supervisor de Área + vínculo com o coordenador (Fase 6a) ----
  /**
   * Filial em que a aba Equipe está operando.
   *
   * O JWT carrega UMA filial ativa e o módulo inteiro trabalha com ela. Mas o ADMIN é
   * global por política (ver `podeVerOutrasFiliais` em filial-scope) e a Equipe é tela
   * de CONFIGURAÇÃO: obrigá-lo a trocar a filial da SESSÃO no Hub para montar o time de
   * cada uma das 35 filiais é atrito sem ganho de segurança. Então ele pode informar
   * `filialId` e a aba inteira segue esse alvo — a sessão não muda.
   *
   * Para os demais papéis o parâmetro é IGNORADO (não 403): a filial vem sempre do
   * token, como em todo o resto do módulo. Ignorar em vez de barrar evita que um
   * cliente desatualizado quebre, e o efeito é o mesmo — ninguém sai da própria filial.
   */
  private async filialAlvo(user: JwtPayload, filialId?: string): Promise<string> {
    const propria = filialDoUsuario(user);
    const alvo = filialId?.trim();
    if (!alvo || alvo === propria || !this.ehAdmin(user)) return propria;
    await this.core.validarFilial(alvo);
    return alvo;
  }

  /**
   * Filiais que já têm RDV montado (representante ativo ou responsável definido), da
   * que tem mais gente para a que tem menos.
   *
   * Serve para o ADMIN abrir a aba Equipe já na filial onde o RDV acontece. A filial
   * principal dele é a matriz administrativa, que normalmente não tem representante
   * nenhum — abrir ali mostra tela vazia e passa a impressão de que sumiu tudo.
   * Preferimos isto a fixar uma filial no código: se amanhã outra começar a usar o RDV,
   * o padrão continua certo sozinho.
   */
  async filiaisComRdv(user: JwtPayload): Promise<{ filialId: string; representantes: number }[]> {
    const propria = filialDoUsuario(user);
    if (!this.ehAdmin(user)) return [{ filialId: propria, representantes: 0 }];
    const [comDepto, quaisquer, amarracoes] = await Promise.all([
      // O peso é o representante COM departamento: é ele que vira linha na tela. Contar
      // representante sem departamento levaria o padrão para a matriz — que tem 11 de
      // seed, nenhum com departamento, e abriria igualmente vazia.
      this.prisma.supervisor.groupBy({ by: ['filialId'], where: { ativo: true, departamentoId: { not: null } }, _count: { _all: true } }),
      this.prisma.supervisor.groupBy({ by: ['filialId'], where: { ativo: true }, _count: { _all: true } }),
      this.prisma.supervisorDepartamento.groupBy({ by: ['filialId'], _count: { _all: true } }),
    ]);
    const mapa = new Map<string, number>();
    // Entram na lista (peso 0) as filiais que têm alguma coisa de RDV; o peso vem de quem
    // realmente aparece na tela.
    for (const a of amarracoes) mapa.set(a.filialId, 0);
    for (const q of quaisquer) mapa.set(q.filialId, 0);
    for (const c of comDepto) mapa.set(c.filialId, c._count._all);
    return [...mapa.entries()]
      .map(([filialId, representantes]) => ({ filialId, representantes }))
      .sort((a, b) => b.representantes - a.representantes);
  }

  async listarSupervisores(user: JwtPayload, somenteAtivos?: boolean, filialIdAlvo?: string) {
    const filialId = await this.filialAlvo(user, filialIdAlvo);
    const escopo = await this.escopoSupervisorWhere(user);
    const lista = await this.prisma.supervisor.findMany({
      where: { filialId, ...escopo, ...(somenteAtivos ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
    });
    const coordIds = [...new Set(lista.map((s) => s.coordenadorId).filter((x): x is string => !!x))];
    // Papel vem da role no módulo (Configurador), não do cadastro do RDV — a Equipe
    // mostra "Coordenador" x "Supervisor de Área" em vez de tratar todos como supervisor.
    const [nomes, papeis] = await Promise.all([
      coordIds.length ? this.core.nomesUsuarios(coordIds) : Promise.resolve(new Map<string, string>()),
      this.papeisDosRepresentantes(lista.map((s) => s.matricula)),
    ]);
    return lista.map((s) => ({
      ...s,
      coordenadorNome: s.coordenadorId ? (nomes.get(s.coordenadorId) ?? null) : null,
      papel: papeis.get(chapa(s.matricula)) ?? null,
    }));
  }

  async criarSupervisor(dto: CriarSupervisorDto, user: JwtPayload, filialIdAlvo?: string) {
    const filialId = await this.filialAlvo(user, filialIdAlvo);
    const departamentoId = dto.departamentoId?.trim() || null;
    await this.assertPodeGerirDepartamento(departamentoId, user);
    const matricula = dto.matricula.trim().toUpperCase();
    const ja = await this.prisma.supervisor.findFirst({ where: { filialId, matricula } });
    if (ja) throw new BadRequestException('Já existe um supervisor com essa matrícula nesta filial.');
    if (dto.coordenadorId) await this.core.validarUsuario(dto.coordenadorId, 'Coordenador');
    return this.prisma.supervisor.create({
      data: { matricula, nome: dto.nome.trim(), filialId, departamentoId, coordenadorId: dto.coordenadorId || null },
    });
  }

  async atualizarSupervisor(id: string, dto: AtualizarSupervisorDto, user: JwtPayload, filialIdAlvo?: string) {
    const filialId = await this.filialAlvo(user, filialIdAlvo);
    const s = await this.prisma.supervisor.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Supervisor não encontrado.');
    if (s.filialId !== filialId) throw new ForbiddenException('Supervisor de outra filial.');
    // Pode mexer NESTE registro (departamento atual dele é do seu escopo)…
    await this.assertPodeGerirDepartamento(s.departamentoId, user);
    // …e, se está movendo de departamento, o destino também precisa ser do seu escopo.
    if (dto.departamentoId !== undefined) await this.assertPodeGerirDepartamento(dto.departamentoId?.trim() || null, user);
    if (dto.coordenadorId) await this.core.validarUsuario(dto.coordenadorId, 'Coordenador');
    return this.prisma.supervisor.update({
      where: { id },
      data: {
        nome: dto.nome?.trim() ?? undefined,
        departamentoId: dto.departamentoId !== undefined ? (dto.departamentoId?.trim() || null) : undefined,
        coordenadorId: dto.coordenadorId !== undefined ? (dto.coordenadorId || null) : undefined,
        ativo: dto.ativo ?? undefined,
      },
    });
  }

  // ---- Atividades ----
  listarAtividades(user: JwtPayload, somenteAtivas?: boolean) {
    const filialId = filialDoUsuario(user);
    return this.prisma.atividadeVisita.findMany({
      where: { OR: [{ filialId }, { filialId: null }], ...(somenteAtivas ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
    });
  }

  /** Tipos de despesa (catálogo) p/ o fluxo Supervisores/RDV — endpoint PRÓPRIO
   *  (gateado pelas roles do supervisor), evitando depender do controller da frota. */
  listarTiposDespesa(somenteAtivos?: boolean) {
    return this.prisma.tipoDespesa.findMany({
      where: somenteAtivos ? { ativo: true } : {},
      orderBy: { nome: 'asc' },
    });
  }
  async criarAtividade(dto: CriarAtividadeDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const nome = dto.nome.trim();
    const ja = await this.prisma.atividadeVisita.findFirst({ where: { filialId, nome } });
    if (ja) throw new BadRequestException('Já existe uma atividade com esse nome.');
    return this.prisma.atividadeVisita.create({ data: { nome, filialId } });
  }
  async atualizarAtividade(id: string, dto: AtualizarAtividadeDto, user: JwtPayload) {
    const a = await this.prisma.atividadeVisita.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Atividade não encontrada.');
    if (a.filialId && a.filialId !== user.filialId) throw new BadRequestException('Atividade de outra filial.');
    return this.prisma.atividadeVisita.update({
      where: { id },
      data: { nome: dto.nome?.trim() ?? undefined, ativo: dto.ativo ?? undefined },
    });
  }


  // ---- Viagem mensal do supervisor (container da RDV) ----
  async criarViagemSupervisor(dto: CriarViagemSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const mm = dto.mesReferencia % 100;
    if (mm < 1 || mm > 12) throw new BadRequestException('Mês de referência inválido — use AAAAMM (ex.: 202605).');
    if (dto.veiculoId) {
      const v = await this.prisma.veiculo.findFirst({ where: { id: dto.veiculoId, filialId } });
      if (!v) throw new BadRequestException('Veículo não encontrado nesta filial.');
    }

    // Supervisor identifica-se por matrícula+senha (Protheus loginPortal), como o
    // condutor da frota. Se veio matrícula, a senha é obrigatória e validada aqui
    // (400 se inválida — não 401, que deslogaria). O nome vem do Protheus (fonte).
    let supMatricula: string | null = null;
    let supNome: string | null = null;
    // Registro selecionado (quando o gestor escolhe do time) — evita re-consultar abaixo.
    let regSel: { id: string; matricula: string; nome: string; coordenadorId: string | null; departamentoId: string | null } | null = null;
    if (dto.supervisorRegistroId?.trim()) {
      // Gestor/Supervisor de Departamento seleciona um representante JÁ CADASTRADO no time
      // (aba Equipe) — SEM senha. A identidade vem do cadastro; a autorização é o escopo
      // do gestor (assertEscopoSupervisor: ADMIN todos, Sup. Depto por departamento,
      // coordenador por vínculo) + auditoria (criadoPorId).
      regSel = await this.prisma.supervisor.findFirst({
        where: { id: dto.supervisorRegistroId.trim(), filialId, ativo: true },
        select: { id: true, matricula: true, nome: true, coordenadorId: true, departamentoId: true },
      });
      if (!regSel) throw new BadRequestException('Representante não encontrado no time desta filial.');
      await this.assertEscopoSupervisor(regSel, user);
      supMatricula = regSel.matricula;
      supNome = regSel.nome;
    } else if (dto.supervisorMatricula?.trim()) {
      if (!dto.supervisorSenha?.trim()) throw new BadRequestException('Informe a senha do supervisor.');
      const r = await this.condutor.validar(dto.supervisorMatricula.trim(), dto.supervisorSenha);
      if (r.status === 'INDISPONIVEL') throw new ServiceUnavailableException('Portal do RH indisponível. Tente novamente em instantes.');
      if (r.status !== 'VALIDO') throw new BadRequestException('Matrícula ou senha do supervisor inválidas.');
      supMatricula = r.matricula ?? dto.supervisorMatricula.trim().toUpperCase();
      supNome = r.nome ?? null;
    } else if (['SUPERVISOR', 'COORDENADOR', 'SUPERVISOR_FROTA'].includes(this.roleLog(user) ?? '')) {
      // Auto-serviço (híbrido): o próprio usuário logado É o dono do RDV — o JWT já
      // autenticou, então dispensa matrícula+senha. Identifica pela matrícula do login
      // (liga ao cadastro adiante). Vale para supervisor de área, COORDENADOR (RDV próprio,
      // aprovado pelo supervisor de departamento) e supervisor de departamento (RDV próprio,
      // aprova a si mesmo). Para criar POR um representante, usa-se o ramo acima (matrícula+senha).
      const u = await this.matriculaDoUsuario(user.sub);
      if (!u?.matricula?.trim()) {
        throw new BadRequestException('Seu usuário não tem matrícula cadastrada. Peça ao administrador ou informe a matrícula e a senha do supervisor.');
      }
      supMatricula = u.matricula.trim().toUpperCase();
      supNome = u.nome;
    }

    // O planejamento PRECISA estar vinculado a um cadastro que ROTEIE para aprovação:
    // um COORDENADOR (supervisor de área → coordenador) OU um DEPARTAMENTO (coordenador
    // e supervisor de departamento → supervisor de departamento). Sem um dos dois nasceria
    // órfão (ninguém o veria). O "montar o time" tem que vir antes.
    if (!supMatricula) {
      throw new BadRequestException('Informe a matrícula do supervisor de área (ou entre como o próprio supervisor) — o planejamento precisa estar vinculado a um cadastro.');
    }
    const reg = regSel
      ? { id: regSel.id, coordenadorId: regSel.coordenadorId, departamentoId: regSel.departamentoId }
      : await this.prisma.supervisor.findFirst({
          where: { filialId, matricula: supMatricula, ativo: true },
          select: { id: true, coordenadorId: true, departamentoId: true },
        });
    if (!reg) {
      throw new BadRequestException('Cadastro não encontrado na equipe desta filial. Peça ao Supervisor de Departamento para te cadastrar (montar o time) com um coordenador ou departamento antes de criar o planejamento.');
    }
    if (!reg.coordenadorId && !reg.departamentoId) {
      throw new BadRequestException('Seu cadastro não tem coordenador nem departamento vinculado (quem aprova). Peça ao Supervisor de Departamento para vincular antes de criar o planejamento.');
    }
    const supervisorRegistroId = reg.id;

    return this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId, escopo: 'VIAGEM' } },
        create: { filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      return tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId,
          tipo: TipoViagem.SUPERVISOR,
          situacao: StatusViagem.EM_CURSO,
          // Planejamento nasce RASCUNHO (o supervisor envia p/ aprovação depois).
          statusPlanejamento: 'RASCUNHO',
          supervisorRegistroId,
          mesReferencia: dto.mesReferencia,
          veiculoId: dto.veiculoId ?? null,
          condutorMatricula: supMatricula,
          condutorNome: supNome,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
        include: { supervisorRegistro: { select: { id: true, nome: true, coordenadorId: true } } },
      });
    });
  }

  /** Role da Logística no token (p/ checar gestor/admin). */
  private roleLog(user: JwtPayload): string | undefined {
    return user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;
  }
  /** RDV do mês encerrado? (TEMA 2) — bloqueia despesa/adiantamento/visita. Sem
   *  supervisor cadastrado ou mês → não trava (nada a fechar). */
  private async assertRdvAberto(supervisorId: string | null | undefined, mes: number | null | undefined) {
    if (!supervisorId || mes == null) return;
    const f = await this.prisma.fechamentoRdv.findUnique({ where: { supervisorId_mesReferencia: { supervisorId, mesReferencia: mes } } });
    if (f) throw new BadRequestException('RDV do mês encerrado — reabra o mês (coordenador/gestor) para alterar despesas, adiantamentos ou visitas.');
  }
  /** Matrícula+nome do usuário logado (core, read-only) — usado no auto-serviço do
   *  supervisor (identifica o supervisor pelo próprio login, sem matrícula+senha). */
  private async matriculaDoUsuario(userId: string): Promise<{ matricula: string | null; nome: string } | null> {
    const rows = await this.prisma.$queryRaw<{ matricula: string | null; nome: string }[]>(
      Prisma.sql`SELECT matricula, TRIM(nome) AS nome FROM "core"."usuarios" WHERE id = ${userId} LIMIT 1`);
    return rows[0] ?? null;
  }
  private ehAdmin(user: JwtPayload): boolean { return this.roleLog(user) === 'ADMIN'; }
  private ehSupervisorDepto(user: JwtPayload): boolean { return this.roleLog(user) === 'SUPERVISOR_FROTA'; }

  /** Departamentos que o Supervisor de Departamento (SUPERVISOR_FROTA) cobre NO RDV.
   *  Fonte: a amarração EXPLÍCITA `supervisor_departamento`, mantida na aba Equipe.
   *
   *  Antes vinha dos veículos que ele supervisiona (`veiculo.supervisorId`) — mas
   *  aquele campo diz quem responde pelo VEÍCULO (controle de frota), não quem tem
   *  autoridade sobre prestação de contas. Além de conceitualmente errado, falhava em
   *  silêncio: tirar o último veículo da pessoa a removia do RDV do departamento sem
   *  nenhum aviso. A FROTA segue derivando do veículo (lá o significado é o certo) —
   *  não unificar as duas de novo. Vazio → não cobre nenhum departamento. */
  private async deptosDoSupervisorDepto(user: JwtPayload): Promise<string[]> {
    const rows = await this.prisma.supervisorDepartamento.findMany({
      where: { filialId: user.filialId ?? undefined, usuarioId: user.sub },
      select: { departamentoId: true },
    });
    return rows.map((r) => r.departamentoId);
  }

  // ---- Amarração Supervisor de Departamento × departamento (aba Equipe) ----

  /**
   * Quem responde por cada departamento no RDV, NA FILIAL DO USUÁRIO.
   *
   * Devolve só os departamentos que participam do RDV: os que têm representante
   * cadastrado na Equipe + os que já têm responsável. O catálogo inteiro não serve
   * aqui — `core.departamentos` é POR FILIAL (unique filial+nome), então listar tudo
   * traz dezenas de linhas com nomes repetidos ("Agroveterinaria" existe em 16
   * filiais) e transforma o aviso de "sem responsável" numa parede de vermelho sobre
   * departamentos que não têm ninguém no RDV.
   *
   * `representantes` (quantos estão cadastrados) é o que diz se a falta de
   * responsável é grave: departamento com gente e sem aprovador trava a prestação de
   * contas; sem gente, é só um departamento que ainda não entrou no RDV.
   */
  async listarSupervisoresDepartamento(user: JwtPayload, filialIdAlvo?: string) {
    const filialId = await this.filialAlvo(user, filialIdAlvo);
    const [amarracoes, porDepto] = await Promise.all([
      this.prisma.supervisorDepartamento.findMany({ where: { filialId } }),
      this.prisma.supervisor.groupBy({
        by: ['departamentoId'],
        where: { filialId, ativo: true, departamentoId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const ids = [...new Set([
      ...amarracoes.map((a) => a.departamentoId),
      ...porDepto.map((s) => s.departamentoId).filter((x): x is string => !!x),
    ])];
    const [nomesDep, nomesUsr] = await Promise.all([
      this.core.nomesDepartamentos(ids),
      this.core.nomesUsuarios(amarracoes.map((a) => a.usuarioId)),
    ]);
    const contagem = new Map(porDepto.map((s) => [s.departamentoId, s._count._all]));
    return ids
      .map((id) => {
        const a = amarracoes.find((x) => x.departamentoId === id);
        return {
          departamentoId: id,
          departamentoNome: nomesDep.get(id) ?? id.slice(0, 8),
          usuarioId: a?.usuarioId ?? null,
          responsavelNome: a ? (nomesUsr.get(a.usuarioId) ?? a.usuarioId.slice(0, 8)) : null,
          representantes: contagem.get(id) ?? 0,
        };
      })
      .sort((x, y) => x.departamentoNome.localeCompare(y.departamentoNome, 'pt-BR'));
  }

  /** Departamentos da filial do usuário — alimenta o seletor "adicionar departamento"
   *  da amarração. Escopado por filial: o catálogo global deixaria escolher um
   *  departamento de outra filial e gravar uma amarração que nunca teria efeito. */
  async departamentosDaFilial(user: JwtPayload, filialIdAlvo?: string) {
    return this.core.departamentosDaFilial(await this.filialAlvo(user, filialIdAlvo));
  }

  /**
   * Define (ou troca) o responsável por um departamento.
   *
   * ⚠️ Só ADMIN escreve — e isto é deliberado. Esta tabela é a FONTE da autoridade do
   * SUPERVISOR_FROTA no RDV: se ele pudesse editá-la, se acrescentaria em qualquer
   * departamento e passaria a aprovar a prestação de contas de quem quisesse. É a
   * mesma classe de furo do gate de 14/07 (quem é supervisionado não escreve o
   * cadastro que define quem o supervisiona). O Supervisor de Departamento VÊ a
   * amarração; quem muda é a administração.
   */
  async definirSupervisorDepartamento(departamentoId: string, usuarioId: string, user: JwtPayload, filialIdAlvo?: string) {
    if (!this.ehAdmin(user)) throw new ForbiddenException('Só a administração define o responsável por um departamento.');
    const filialId = await this.filialAlvo(user, filialIdAlvo);
    if (!departamentoId?.trim() || !usuarioId?.trim()) throw new BadRequestException('Informe o departamento e o responsável.');
    await this.core.validarDepartamento(departamentoId);
    await this.core.validarUsuario(usuarioId, 'Responsável');
    // O departamento tem que ser DESTA filial. `core.departamentos` é por filial, e a
    // amarração grava a filial do usuário: aceitar um departamento de outra filial
    // criaria uma linha (minha filial × departamento alheio) que nunca casaria com
    // representante nenhum — autoridade fantasma, silenciosa.
    if (!(await this.core.departamentoEhDaFilial(departamentoId, filialId))) {
      throw new BadRequestException('Este departamento é de outra filial — troque de filial para definir o responsável dele.');
    }
    return this.prisma.supervisorDepartamento.upsert({
      where: { filialId_departamentoId: { filialId, departamentoId } },
      update: { usuarioId, criadoPorId: user.sub, criadoEm: new Date() },
      create: { filialId, departamentoId, usuarioId, criadoPorId: user.sub },
    });
  }

  /** Remove o responsável de um departamento (fica sem supervisor — ninguém aprova por
   *  ele até que se defina outro; falha fechada, de propósito). */
  async removerSupervisorDepartamento(departamentoId: string, user: JwtPayload, filialIdAlvo?: string) {
    if (!this.ehAdmin(user)) throw new ForbiddenException('Só a administração remove o responsável por um departamento.');
    const filialId = await this.filialAlvo(user, filialIdAlvo);
    await this.prisma.supervisorDepartamento.deleteMany({ where: { filialId, departamentoId } });
    return { ok: true };
  }

  /** Filtro Prisma de quais representantes o usuário alcança no RDV: ADMIN todos da
   *  filial; Supervisor de Departamento os dos SEUS departamentos; demais (coordenador)
   *  só os SEUS (vínculo). Gestores de entrega/frota NÃO participam do RDV. */
  private async escopoSupervisorWhere(user: JwtPayload): Promise<Prisma.SupervisorWhereInput> {
    if (this.ehAdmin(user)) return {};
    if (this.ehSupervisorDepto(user)) return { departamentoId: { in: await this.deptosDoSupervisorDepto(user) } };
    return { coordenadorId: user.sub };
  }

  /** O usuário logado É o próprio representante? (auto-serviço) — casa a matrícula do
   *  login (core, read-only) com a do cadastro, tolerando prefixo/zeros como o
   *  owner-check do workflow. Só consulta se o cadastro tiver matrícula. */
  private async ehProprioSupervisor(matriculaSup: string | null | undefined, user: JwtPayload): Promise<boolean> {
    if (!matriculaSup) return false;
    const u = await this.matriculaDoUsuario(user.sub);
    return !!u?.matricula && chapa(u.matricula) === chapa(matriculaSup);
  }

  /** Alcança um representante específico? ADMIN sim; Supervisor de Departamento se o
   *  depto do representante é um dos seus; coordenador se é supervisor dele; e o PRÓPRIO
   *  representante (auto-serviço, por matrícula) alcança o SEU. Usado no
   *  Fechamento/RDV/adiantamentos. */
  private async assertEscopoSupervisor(sup: { coordenadorId: string | null; departamentoId: string | null; matricula?: string | null } | null, user: JwtPayload) {
    if (!sup || this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const deps = await this.deptosDoSupervisorDepto(user);
      if (sup.departamentoId && deps.includes(sup.departamentoId)) return;
      throw new ForbiddenException('Representante fora do seu departamento.');
    }
    if (sup.coordenadorId === user.sub) return;
    // Auto-serviço: o próprio supervisor de área alcança o SEU RDV/adiantamentos.
    if (await this.ehProprioSupervisor(sup.matricula, user)) return;
    throw new ForbiddenException('Representante fora da sua coordenação.');
  }

  /** "Montar o time" (escrever o cadastro) e escolher o departamento: ADMIN em qualquer
   *  depto; Supervisor de Departamento só nos SEUS; ninguém mais. deptId null → só ADMIN
   *  (representante sem depto fica fora do escopo de qualquer Supervisor de Departamento). */
  private async assertPodeGerirDepartamento(deptId: string | null, user: JwtPayload) {
    if (this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const deps = await this.deptosDoSupervisorDepto(user);
      if (deptId && deps.includes(deptId)) return;
      throw new ForbiddenException('Departamento fora do seu escopo.');
    }
    throw new ForbiddenException('Sem permissão para gerir o cadastro de representantes.');
  }

  /** Decide (aprova/ajusta/rejeita) planejamento/despesa: ADMIN; o Supervisor de
   *  Departamento (se o representante é de um depto seu); o COORDENADOR do representante.
   *  O supervisionado nunca decide o seu. */
  private async assertPodeDecidir(reg: { coordenadorId: string | null; departamentoId: string | null } | null | undefined, user: JwtPayload) {
    if (this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const deps = await this.deptosDoSupervisorDepto(user);
      if (reg?.departamentoId && deps.includes(reg.departamentoId)) return;
      throw new ForbiddenException('Representante fora do seu departamento.');
    }
    if (reg?.coordenadorId && reg.coordenadorId === user.sub) return;
    throw new ForbiddenException('Apenas o coordenador do representante (ou o Supervisor de Departamento) pode decidir.');
  }

  /** Versão booleana do `assertPodeDecidir`: este usuário é a AUTORIDADE que decide
   *  sobre ESTE representante? Note que é por representante, não por papel — um
   *  COORDENADOR que também tem RDV próprio NÃO é autoridade sobre o seu (o cadastro
   *  dele roteia para o coordenador/departamento dele), então a despesa dele continua
   *  precisando de aval. É essa distinção que impede o papel de virar auto-aprovação. */
  private async ehAutoridadeSobre(reg: { coordenadorId: string | null; departamentoId: string | null } | null | undefined, user: JwtPayload): Promise<boolean> {
    try {
      await this.assertPodeDecidir(reg, user);
      return true;
    } catch {
      return false;
    }
  }

  // ---- Workflow do planejamento (supervisor envia · coordenador decide) ----
  private async planejamentoOuErro(id: string, filialId: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { supervisorRegistro: { select: { coordenadorId: true, matricula: true, departamentoId: true } } } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Planejamento não encontrado.');
    if (v.filialId !== filialId) throw new ForbiddenException('Planejamento de outra filial.');
    return v;
  }

  /** Transições que o PRÓPRIO supervisor dispara (enviar/iniciar): quem pode é o
   *  representante DONO do RDV (por matrícula), o coordenador dele, o Supervisor de
   *  Departamento (se é de um depto seu), ou ADMIN. Sem isso, qualquer supervisor da
   *  mesma filial avançaria o planejamento alheio (a filial já foi checada em
   *  planejamentoOuErro). Planejamento sem cadastro vinculado (não roteia): o criador. */
  private async assertDonoOuGestorPlanejamento(
    v: { criadoPorId: string | null; supervisorRegistro: { coordenadorId: string | null; matricula: string; departamentoId: string | null } | null },
    user: JwtPayload,
  ) {
    if (this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const dep = v.supervisorRegistro?.departamentoId;
      const deps = await this.deptosDoSupervisorDepto(user);
      if (dep && deps.includes(dep)) return;
      throw new ForbiddenException('Planejamento fora do seu departamento.');
    }
    const coord = v.supervisorRegistro?.coordenadorId;
    if (coord && coord === user.sub) return; // coordenador do supervisor
    const supMat = v.supervisorRegistro?.matricula;
    if (supMat) {
      const u = await this.matriculaDoUsuario(user.sub);
      if (u?.matricula && chapa(u.matricula) === chapa(supMat)) return; // é o próprio representante
    } else if (v.criadoPorId && v.criadoPorId === user.sub) {
      return; // planejamento sem cadastro vinculado: o criador é o dono
    }
    throw new ForbiddenException('Apenas o representante dono do planejamento, o coordenador dele ou o Supervisor de Departamento pode fazer isso.');
  }

  /** Carrega o planejamento JÁ com o dono/gestor conferido — atalho para as operações
   *  de CONTEÚDO do RDV (visita e despesa). Antes essas rotas checavam só a filial, de
   *  modo que qualquer papel do @Roles da classe (inclusive OPERADOR_ENTREGA e um
   *  supervisor COLEGA) lançava/removia visita e despesa no RDV alheio — o mesmo furo
   *  que `enviar`/`iniciar` já fechavam. O escopo agora é único: dono (por matrícula),
   *  coordenador dele, Supervisor de Departamento do depto, ou ADMIN. */
  private async planejamentoDoDono(id: string, user: JwtPayload) {
    const v = await this.planejamentoOuErro(id, filialDoUsuario(user));
    await this.assertDonoOuGestorPlanejamento(v, user);
    return v;
  }

  /**
   * EXECUÇÃO é ato do representante — só o dono (ou ADMIN, para suporte).
   *
   * Planejar e executar são coisas diferentes e estavam no mesmo cadeado
   * (`assertDonoOuGestorPlanejamento`): como o aprovador PODE mexer nos itens do
   * roteiro durante a aprovação, ele também apontava a visita como realizada e
   * concluía o RDV do subordinado. No app — que é execução em campo — isso apareceu
   * como o coordenador executando o planejamento do supervisor de área junto com o
   * seu, no mesmo aparelho e no mesmo ponto de GPS.
   *
   * A autoridade continua inteira no que é dela: incluir/alterar/excluir item,
   * aprovar, ajustar, devolver, rejeitar, cancelar e reabrir. O que ela não faz é
   * dizer que ESTEVE no cliente.
   */
  private async assertDonoDoPlanejamento(
    v: { criadoPorId: string | null; supervisorRegistro: { matricula: string } | null },
    user: JwtPayload,
  ) {
    if (this.ehAdmin(user)) return;
    const supMat = v.supervisorRegistro?.matricula;
    if (supMat) {
      const u = await this.matriculaDoUsuario(user.sub);
      if (u?.matricula && chapa(u.matricula) === chapa(supMat)) return;
    } else if (v.criadoPorId && v.criadoPorId === user.sub) {
      return; // planejamento sem cadastro vinculado: o criador é o dono
    }
    throw new ForbiddenException(
      'Só o representante dono do planejamento aponta a visita e conclui o RDV. Como aprovador você pode incluir, alterar e excluir itens do roteiro, aprovar, devolver ou cancelar.',
    );
  }

  /** Carrega o planejamento conferindo o DONO — para os atos de execução
   *  (apontar visita, concluir). Ver `assertDonoDoPlanejamento`. */
  private async planejamentoParaExecutar(id: string, user: JwtPayload) {
    const v = await this.planejamentoOuErro(id, filialDoUsuario(user));
    await this.assertDonoDoPlanejamento(v, user);
    return v;
  }

  /** Versão booleana do `assertDonoDoPlanejamento` — vai no detalhe do planejamento
   *  (`souDono`) para a tela esconder os botões de execução em vez de deixar o
   *  aprovador clicar e tomar 403. A regra de dono é por matrícula (`chapa`), que o
   *  frontend não tem; então quem responde é o backend. */
  private async ehDonoDoPlanejamento(
    v: { criadoPorId: string | null; supervisorRegistro: { matricula: string } | null },
    user: JwtPayload,
  ): Promise<boolean> {
    try {
      await this.assertDonoDoPlanejamento(v, user);
      return true;
    } catch {
      return false;
    }
  }

  /** Planejamento cancelado é histórico: não recebe visita, despesa nem conclusão.
   *  Reabrir (Supervisor de Departamento) reativa se o cancelamento foi engano. */
  private assertNaoCancelado(v: { statusPlanejamento: StatusPlanejamento | null; situacao: StatusViagem }) {
    if (v.statusPlanejamento === 'CANCELADO' || v.situacao === StatusViagem.CANCELADA) {
      throw new BadRequestException('Planejamento cancelado — reative pelo Supervisor de Departamento para voltar a lançar.');
    }
  }

  /** ids dos cadastros de representante que correspondem à matrícula do usuário logado
   *  — `chapa` normaliza prefixo/zeros, mesma regra do owner-check da escrita. */
  private async registrosDoUsuario(user: JwtPayload): Promise<string[]> {
    const u = await this.matriculaDoUsuario(user.sub);
    if (!u?.matricula?.trim()) return [];
    const alvo = chapa(u.matricula);
    const regs = await this.prisma.supervisor.findMany({
      where: { filialId: filialDoUsuario(user) },
      select: { id: true, matricula: true },
    });
    return regs.filter((r) => chapa(r.matricula) === alvo).map((r) => r.id);
  }

  /** Quais planejamentos o usuário ALCANÇA na LEITURA — espelha o escopo da escrita
   *  (`assertDonoOuGestorPlanejamento`). Sem isso a listagem devolvia todos os RDVs da
   *  filial: no app, o supervisor via a prestação de contas dos colegas (valores,
   *  despesas e comprovantes de terceiros). ADMIN vê a filial inteira. */
  private async escopoPlanejamentoWhere(user: JwtPayload, somenteMeus = false): Promise<Prisma.ViagemWhereInput> {
    if (somenteMeus) return this.escopoSomenteMeusWhere(user);
    if (this.ehAdmin(user)) return {};
    const or: Prisma.ViagemWhereInput[] = [{ criadoPorId: user.sub }];
    if (this.ehSupervisorDepto(user)) {
      or.push({ supervisorRegistro: { departamentoId: { in: await this.deptosDoSupervisorDepto(user) } } });
    } else {
      or.push({ supervisorRegistro: { coordenadorId: user.sub } });
    }
    const meus = await this.registrosDoUsuario(user);
    if (meus.length) or.push({ supervisorRegistroId: { in: meus } });
    return { OR: or };
  }

  /**
   * Escopo do APP (execução em campo): só o MEU RDV — nada do time.
   *
   * A listagem larga acima é a do desktop, e ali ela está certa: o coordenador
   * monta e ajusta o planejamento do seu supervisor de área, e o Supervisor de
   * Departamento faz o mesmo com o do coordenador. Mas o app é execução, e o que
   * ele lista o usuário entende como "para eu executar" — foi assim que um
   * coordenador realizou, no mesmo aparelho, o próprio RDV e o do subordinado.
   *
   * Note que não é filtro de papel e sim de VÍNCULO: o coordenador continua vendo o
   * RDV dele aqui (ele também é representante, com cadastro e matrícula). Quem não
   * tem cadastro vinculado cai no `criadoPorId` — mesmo dono que a execução exige.
   */
  private async escopoSomenteMeusWhere(user: JwtPayload): Promise<Prisma.ViagemWhereInput> {
    const meus = await this.registrosDoUsuario(user);
    const or: Prisma.ViagemWhereInput[] = [{ supervisorRegistroId: null, criadoPorId: user.sub }];
    if (meus.length) or.push({ supervisorRegistroId: { in: meus } });
    return { OR: or };
  }

  async enviarPlanejamento(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    // ENVIAR é do representante: significa "meu plano está pronto, avalie". Com o
    // gestor podendo enviar, o ciclo fechava numa pessoa só — o aprovador enviava em
    // nome do representante e aprovava em seguida, e o aval virava formalidade (foi o
    // que apareceu no DEV: a Supervisora de Departamento enviou e aprovou o
    // planejamento do coordenador em sequência). Quem monta o roteiro continua sendo
    // os dois; quem declara que ele está pronto é o dono.
    await this.assertDonoDoPlanejamento(v, user);
    // Sem coordenador NEM departamento não há para quem enviar (órfão). Coordenador roteia
    // p/ o coordenador; departamento roteia p/ o supervisor de departamento (caso do RDV
    // do próprio coordenador). Barra o envio se não houver nenhum dos dois.
    if (!v.supervisorRegistro?.coordenadorId && !v.supervisorRegistro?.departamentoId) {
      throw new BadRequestException('Este planejamento não tem coordenador nem departamento vinculado — não há para quem enviar. Peça ao Supervisor de Departamento para vincular ao seu cadastro.');
    }
    if (!['RASCUNHO', 'AJUSTADO', 'REJEITADO'].includes(v.statusPlanejamento ?? '')) {
      throw new BadRequestException('Só envia planejamento em rascunho, ajustado ou rejeitado.');
    }
    return this.prisma.viagem.update({ where: { id }, data: { statusPlanejamento: 'ENVIADO' } });
  }

  async decidirPlanejamento(id: string, decisao: 'APROVADO' | 'AJUSTADO' | 'REJEITADO', comentario: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    if (v.statusPlanejamento !== 'ENVIADO') throw new BadRequestException('Só decide planejamento que foi ENVIADO para aprovação.');
    await this.assertPodeDecidir(v.supervisorRegistro, user);
    if (decisao !== 'APROVADO' && !comentario?.trim()) throw new BadRequestException('Informe o comentário do ajuste/rejeição.');
    return this.prisma.viagem.update({
      where: { id },
      data: { statusPlanejamento: decisao, aprovadoPorId: user.sub, aprovadoEm: new Date(), comentarioCoordenador: comentario?.trim() || null },
    });
  }

  /**
   * Cancela o planejamento por FORÇA MAIOR (representante afastado, veículo quebrado,
   * região remanejada) — o caminho que faltava depois do aval: Ajustar/Rejeitar só
   * valem no ENVIADO, e sem isto o planejamento aprovado ficava pendurado para sempre
   * (ou virava um RDV concluído e vazio, sujando histórico e fechamento).
   *
   * Quem cancela é a autoridade que aprova (coordenador do representante / Supervisor
   * de Departamento / ADMIN) e o motivo é obrigatório — cancelamento sem justificativa
   * é o que apaga o rastro de uma viagem que já consumiu dinheiro.
   *
   * Dinheiro: despesa já APROVADA barra o cancelamento (o valor entrou na prestação de
   * contas — resolva antes, contestando ou fechando o mês). As PENDENTES são
   * contestadas junto, com o motivo do cancelamento: senão ficariam órfãs na fila do
   * coordenador, esperando decisão sobre uma viagem que não existe mais.
   */
  async cancelarPlanejamento(id: string, motivo: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    await this.assertPodeDecidir(v.supervisorRegistro, user);
    if (!motivo?.trim()) throw new BadRequestException('Informe o motivo do cancelamento.');
    if (v.statusPlanejamento === 'CANCELADO') throw new BadRequestException('Planejamento já cancelado.');
    if (v.statusPlanejamento === 'CONCLUIDO' || v.situacao === StatusViagem.CONCLUIDA) {
      throw new BadRequestException('Planejamento concluído — reabra (Supervisor de Departamento) antes de cancelar.');
    }
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
    const aprovadas = await this.prisma.despesaVeiculo.count({ where: { viagemId: id, situacao: 'APROVADA' } });
    if (aprovadas > 0) {
      throw new BadRequestException(`Este planejamento tem ${aprovadas} despesa(s) já APROVADA(s) — resolva-as antes de cancelar (o valor já entrou na prestação de contas).`);
    }
    const just = motivo.trim();
    return this.prisma.$transaction(async (tx) => {
      await tx.despesaVeiculo.updateMany({
        where: { viagemId: id, situacao: 'PENDENTE' },
        data: { situacao: 'CONTESTADA', motivoContestacao: `Planejamento cancelado: ${just}`, aprovadoPorId: user.sub, aprovadoEm: new Date() },
      });
      return tx.viagem.update({
        where: { id },
        data: {
          statusPlanejamento: 'CANCELADO',
          situacao: StatusViagem.CANCELADA,
          motivoCancelamento: just,
          canceladoPorId: user.sub,
          canceladoEm: new Date(),
        },
      });
    });
  }

  /**
   * Devolve o planejamento APROVADO/EM_EXECUCAO para reconfiguração — o meio-termo
   * entre seguir e cancelar (mudou a rota, trocou a região). Volta para AJUSTADO, que
   * é o estado que o `enviar` já aceita reenviar, então o ciclo fecha sem status novo.
   * Não desfaz o que já foi executado: visitas apontadas e despesas lançadas
   * continuam lá — é reconfiguração, não estorno.
   */
  async devolverPlanejamento(id: string, comentario: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    await this.assertPodeDecidir(v.supervisorRegistro, user);
    if (!comentario?.trim()) throw new BadRequestException('Informe o que precisa ser reconfigurado.');
    if (!['APROVADO', 'EM_EXECUCAO'].includes(v.statusPlanejamento ?? '')) {
      throw new BadRequestException('Só devolve para reconfiguração planejamento aprovado ou em execução (no ENVIADO use Ajustar/Rejeitar).');
    }
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Planejamento concluído — reabra antes de devolver.');
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
    return this.prisma.viagem.update({
      where: { id },
      data: {
        statusPlanejamento: 'AJUSTADO',
        comentarioCoordenador: comentario.trim(),
        aprovadoPorId: user.sub,
        aprovadoEm: new Date(),
      },
    });
  }

  async iniciarExecucao(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    // "Liberar para execução" abre o apontamento em campo — é o representante dizendo
    // que vai sair. Mesmo dono de apontar/concluir; o app tem o botão, então isso não
    // prende ninguém ao desktop.
    await this.assertDonoDoPlanejamento(v, user);
    if (!['APROVADO', 'AJUSTADO'].includes(v.statusPlanejamento ?? '')) {
      throw new BadRequestException('Só inicia execução de planejamento aprovado/ajustado.');
    }
    return this.prisma.viagem.update({ where: { id }, data: { statusPlanejamento: 'EM_EXECUCAO' } });
  }

  /** Fila de aprovação: o COORDENADOR vê os planejamentos dos SEUS supervisores (via
   *  vínculo); o Supervisor de Departamento vê os dos SEUS departamentos; ADMIN vê
   *  TODOS da filial. Espelha o `decidir`. */
  async listarPlanejamentosCoordenador(user: JwtPayload, status?: string) {
    const filialId = filialDoUsuario(user);
    let regFiltro: Prisma.ViagemWhereInput = {};
    if (this.ehAdmin(user)) regFiltro = {};
    else if (this.ehSupervisorDepto(user)) regFiltro = { supervisorRegistro: { departamentoId: { in: await this.deptosDoSupervisorDepto(user) } } };
    else regFiltro = { supervisorRegistro: { coordenadorId: user.sub } };
    return this.prisma.viagem.findMany({
      where: {
        filialId,
        tipo: TipoViagem.SUPERVISOR,
        ...regFiltro,
        ...(status ? { statusPlanejamento: status as StatusPlanejamento } : {}),
      },
      orderBy: [{ mesReferencia: 'desc' }, { numero: 'desc' }],
      include: {
        supervisorRegistro: { select: { id: true, nome: true, matricula: true } },
        _count: { select: { paradas: true, despesas: true } },
      },
    });
  }

  /**
   * Papel do representante no RDV, a partir da role dele no módulo LOGISTICA.
   *
   * O cadastro (`logistica.supervisor`) guarda matrícula e nome — o papel está na
   * permissão do módulo, no Configurador. Sem isto a tela chamava todo mundo de
   * "Supervisor", inclusive o coordenador. Quem não tem conta/papel no módulo fica
   * `null` e a tela mostra o rótulo neutro.
   */
  private async papeisDosRepresentantes(matriculas: (string | null | undefined)[]): Promise<Map<string, string>> {
    const chapas = [...new Set(matriculas.filter((m): m is string => !!m?.trim()).map(chapa))];
    return chapas.length ? this.core.papeisLogisticaPorChapa(chapas) : new Map();
  }

  /**
   * Acrescenta ao planejamento QUEM EXECUTA e QUEM APROVA — as duas perguntas que a
   * lista não respondia (mostrava só o nome, sem papel, departamento ou aprovador).
   *
   * O aprovador segue a mesma rota do `enviar`: quem tem coordenador vinculado roteia
   * para ele; quem não tem (caso do próprio coordenador) roteia para o responsável do
   * departamento. Se não houver nenhum dos dois o planejamento é órfão — e agora isso
   * fica visível na lista, em vez de só estourar no envio.
   */
  private async enriquecerRepresentantes<
    T extends { supervisorRegistro?: { matricula: string; departamentoId: string | null; coordenadorId: string | null } | null },
  >(itens: T[], filialId: string) {
    if (!itens.length) return itens.map((v) => ({ ...v, papelRepresentante: null as string | null, departamentoNome: null as string | null, aprovadorNome: null as string | null }));
    const deptoIds = [...new Set(itens.map((v) => v.supervisorRegistro?.departamentoId).filter((x): x is string => !!x))];
    const coordIds = [...new Set(itens.map((v) => v.supervisorRegistro?.coordenadorId).filter((x): x is string => !!x))];
    const amarracoes = deptoIds.length
      ? await this.prisma.supervisorDepartamento.findMany({ where: { filialId, departamentoId: { in: deptoIds } } })
      : [];
    const [papeis, nomesDep, nomesUsr] = await Promise.all([
      this.papeisDosRepresentantes(itens.map((v) => v.supervisorRegistro?.matricula)),
      deptoIds.length ? this.core.nomesDepartamentos(deptoIds) : Promise.resolve(new Map<string, string>()),
      this.core.nomesUsuarios([...coordIds, ...amarracoes.map((a) => a.usuarioId)]),
    ]);
    const respDoDepto = new Map(amarracoes.map((a) => [a.departamentoId, a.usuarioId]));
    return itens.map((v) => {
      const reg = v.supervisorRegistro;
      const respId = reg?.coordenadorId ?? (reg?.departamentoId ? respDoDepto.get(reg.departamentoId) : undefined);
      return {
        ...v,
        papelRepresentante: reg?.matricula ? (papeis.get(chapa(reg.matricula)) ?? null) : null,
        departamentoNome: reg?.departamentoId ? (nomesDep.get(reg.departamentoId) ?? null) : null,
        aprovadorNome: respId ? (nomesUsr.get(respId) ?? null) : null,
      };
    });
  }

  /** `escopo='meus'` (app) devolve SÓ o RDV do próprio usuário; sem o parâmetro
   *  mantém a listagem do desktop (o meu + o do time que eu coordeno/aprovo). */
  async listarViagensSupervisor(user: JwtPayload, mes?: number, situacao?: string, escopo?: string) {
    const filialId = filialDoUsuario(user);
    const viagens = await this.prisma.viagem.findMany({
      where: {
        filialId,
        tipo: TipoViagem.SUPERVISOR,
        ...(await this.escopoPlanejamentoWhere(user, escopo === 'meus')),
        ...(mes ? { mesReferencia: mes } : {}),
        ...(situacao ? { situacao: situacao as StatusViagem } : {}),
      },
      orderBy: [{ mesReferencia: 'desc' }, { numero: 'desc' }],
      include: {
        supervisorRegistro: { select: { id: true, nome: true, matricula: true, departamentoId: true, coordenadorId: true } },
        _count: { select: { paradas: true, despesas: true } },
      },
    });
    return this.enriquecerRepresentantes(viagens, filialId);
  }

  async obterViagemSupervisor(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: {
        supervisorRegistro: { select: { id: true, nome: true, coordenadorId: true, matricula: true, departamentoId: true } },
        paradas: {
          orderBy: { sequencia: 'asc' },
          include: {
            atividade: { select: { nome: true } },
            // Local consolidado → o "Ver no mapa" usa a coordenada APRENDIDA (não o ponto bruto).
            localCliente: { select: { id: true, nome: true, tipo: true, latConsolidada: true, longConsolidada: true, confianca: true, nMarcacoes: true } },
          },
        },
        despesas: { include: { tipoDespesa: { select: { nome: true, categoria: true } }, anexos: { select: { id: true, mime: true, ordem: true }, orderBy: { ordem: 'asc' } } } },
        // Saídas de veículo (frota) vinculadas a este RDV → o KM vem daqui.
        saidasVinculadas: {
          orderBy: { dataHoraSaida: 'asc' },
          select: {
            id: true, numero: true, kmInicial: true, kmFinal: true, situacao: true,
            dataHoraSaida: true, dataHoraChegada: true,
            veiculo: { select: { placa: true, modelo: true } },
          },
        },
      },
    });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    // Abrir o RDV alheio expõe despesas e comprovantes de terceiros — mesmo escopo da escrita.
    await this.assertDonoOuGestorPlanejamento(v, user);
    // KM total rodado no RDV = soma dos KMs das saídas vinculadas já fechadas.
    const kmTotalSaidas = (v.saidasVinculadas ?? []).reduce(
      (s, sd) => s + (sd.kmFinal != null && sd.kmInicial != null ? sd.kmFinal - sd.kmInicial : 0), 0);
    // `souDono` separa planejar de executar na tela: o aprovador edita o roteiro,
    // mas apontar visita e concluir são do representante.
    const souDono = await this.ehDonoDoPlanejamento(v, user);
    // Papel/departamento/aprovador: a tela chamava todo representante de "Supervisor".
    const [enriquecida] = await this.enriquecerRepresentantes([v], filialId);
    return { ...enriquecida, kmTotalSaidas, souDono };
  }

  // ---- Visitas (paradas) da viagem ----
  async adicionarVisita(viagemId: string, dto: AdicionarVisitaDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoDoDono(viagemId, user);
    this.assertNaoCancelado(v);
    // Montar o roteiro é do aprovador também (ele inclui/altera/exclui item na
    // aprovação). Mas DEPOIS de liberado para execução a visita incluída nasce
    // REALIZADA (ver abaixo) — aí é o mesmo ato de `apontarVisita` por outra porta,
    // e só o dono declara que esteve no cliente.
    if (v.statusPlanejamento === 'EM_EXECUCAO') await this.assertDonoDoPlanejamento(v, user);
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para adicionar visitas.');
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
    if (dto.atividadeId) {
      const a = await this.prisma.atividadeVisita.findUnique({ where: { id: dto.atividadeId } });
      if (!a || (a.filialId && a.filialId !== filialId)) throw new BadRequestException('Atividade inválida para esta filial.');
    }
    // ANTES da execução (rascunho/enviado/aprovado/ajustado/rejeitado) a visita
    // nasce PLANEJADA — inclusive em APROVADO, que ainda é planejamento até o
    // "Liberar para execução". Só durante a EXECUÇÃO (EM_EXECUCAO) uma visita
    // incluída em campo é exceção e nasce REALIZADA. Espelha o rótulo do desktop
    // ("Incluir no planejamento" × "Registrar visita").
    // Fila offline (app): reenvio com a mesma chave não duplica a visita.
    if (dto.idempotencyKey) {
      const ja = await this.prisma.parada.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: { atividade: { select: { nome: true } } } });
      if (ja) return ja;
    }
    const emPlanejamento = v.statusPlanejamento !== 'EM_EXECUCAO' && v.statusPlanejamento !== 'CONCLUIDO';
    const clienteMatricula = dto.clienteMatricula?.trim().toUpperCase() || null;
    const propriedade = dto.propriedade?.trim() || null;
    const localId = await this.resolverLocalDaMarcacao(dto.localClienteId, dto.noLocal, {
      clienteMatricula, clienteNome: dto.clienteNome?.trim() || null, propriedade, municipio: dto.municipio?.trim() || null,
    }, user);
    const criada = await this.prisma.$transaction(async (tx) => {
      const seq = (await tx.parada.count({ where: { viagemId } })) + 1;
      return tx.parada.create({
        data: {
          viagemId,
          sequencia: seq,
          atividadeId: dto.atividadeId ?? null,
          clienteMatricula,
          clienteNome: dto.clienteNome?.trim() || null,
          municipio: dto.municipio?.trim() || null,
          propriedade,
          local: dto.local?.trim() || null,
          observacao: dto.observacao?.trim() || null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          precisaoM: dto.precisaoM ?? null,
          noLocal: dto.noLocal ?? null,
          localClienteId: localId,
          dataHora: this.parseData(dto.dataVisita),
          status: emPlanejamento ? 'PLANEJADA' : 'REALIZADA',
          idempotencyKey: dto.idempotencyKey ?? null,
        },
        include: { atividade: { select: { nome: true } } },
      });
    });
    // Visita já REALIZADA em campo (execução) com marcação confiável → consolida o local.
    if (criada.localClienteId && criada.status === 'REALIZADA' && criada.noLocal && criada.latitude != null) {
      await this.locais.consolidar(criada.localClienteId).catch(() => undefined);
    }
    return criada;
  }

  /** Resolve o local do cliente que esta marcação alimenta: o já escolhido; ou, se o
   *  usuário confirmou "no local" e há cliente+propriedade, cria/reaproveita o local
   *  (PROPRIEDADE) por essa chave (bootstrap do cadastro). Senão, null. */
  private async resolverLocalDaMarcacao(
    localIdAtual: string | null | undefined,
    noLocal: boolean | undefined,
    m: { clienteMatricula: string | null; clienteNome: string | null; propriedade: string | null; municipio: string | null },
    user: JwtPayload,
  ): Promise<string | null> {
    if (localIdAtual) return localIdAtual;
    if (!noLocal || !m.clienteMatricula?.trim() || !m.propriedade?.trim()) return null;
    const local = await this.locais.criar(
      { clienteMatricula: m.clienteMatricula, clienteNome: m.clienteNome ?? undefined, tipo: 'PROPRIEDADE', nome: m.propriedade, municipio: m.municipio ?? undefined },
      user,
    );
    return local.id;
  }

  /** Apontamento (6c): marca a visita PLANEJADA como REALIZADA (com a atividade
   *  efetiva / obs / data) ou PULADA. Só faz sentido em execução. */
  async apontarVisita(viagemId: string, paradaId: string, dto: ApontarVisitaDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    // Apontar é execução: só o dono (ver assertDonoDoPlanejamento).
    const v = await this.planejamentoParaExecutar(viagemId, user);
    this.assertNaoCancelado(v);
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Planejamento concluído — reabra para apontar.');
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== viagemId) throw new NotFoundException('Visita não encontrada.');
    if (dto.atividadeId) {
      const a = await this.prisma.atividadeVisita.findUnique({ where: { id: dto.atividadeId } });
      if (!a || (a.filialId && a.filialId !== filialId)) throw new BadRequestException('Atividade inválida para esta filial.');
    }
    // Local do cliente: usa o escolhido (dto/parada) ou, se confirmou "no local" e não há
    // um, AUTO-RESOLVE por cliente+propriedade (bootstrap do cadastro de locais a partir
    // do dado que já existe — o app não precisa de seletor).
    const localId = await this.resolverLocalDaMarcacao(dto.localClienteId ?? p.localClienteId, dto.noLocal, p, user);
    const atualizada = await this.prisma.parada.update({
      where: { id: paradaId },
      data: {
        status: dto.status,
        // Motivo só na PULADA; ao (re)marcar REALIZADA limpamos qualquer justificativa antiga.
        motivoPulada: dto.status === 'PULADA' ? (dto.motivoPulada?.trim() || null) : null,
        atividadeId: dto.atividadeId !== undefined ? (dto.atividadeId || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao?.trim() || null) : undefined,
        latitude: dto.latitude ?? undefined,
        longitude: dto.longitude ?? undefined,
        precisaoM: dto.precisaoM ?? undefined,
        noLocal: dto.noLocal ?? undefined,
        localClienteId: localId ?? undefined,
        dataHora: dto.dataVisita ? this.parseData(dto.dataVisita) : undefined,
      },
      include: { atividade: { select: { nome: true } } },
    });
    // Marcação confiável (no local, com GPS) → reconsolida a localização do local.
    // Best-effort: uma falha aqui não derruba o apontamento.
    if (atualizada.localClienteId && atualizada.status === 'REALIZADA' && atualizada.noLocal && atualizada.latitude != null) {
      await this.locais.consolidar(atualizada.localClienteId).catch(() => undefined);
    }
    return atualizada;
  }

  async removerVisita(viagemId: string, paradaId: string, user: JwtPayload) {
    const v = await this.planejamentoDoDono(viagemId, user);
    this.assertNaoCancelado(v);
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== viagemId) throw new NotFoundException('Visita não encontrada.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para remover visitas.');
    await this.prisma.parada.delete({ where: { id: paradaId } });
    return { ok: true };
  }

  async concluirViagemSupervisor(id: string, user: JwtPayload) {
    // Concluir encerra a execução — mesmo dono de `apontarVisita`.
    const v = await this.planejamentoParaExecutar(id, user);
    this.assertNaoCancelado(v);
    if (v.situacao === StatusViagem.CONCLUIDA) return v;
    return this.prisma.viagem.update({
      where: { id },
      data: { situacao: StatusViagem.CONCLUIDA, statusPlanejamento: 'CONCLUIDO', dataHoraChegada: new Date() },
    });
  }

  // ---- Despesas da viagem do supervisor (compõem a RDV) ----
  async lancarDespesa(viagemId: string, dto: LancarDespesaSupervisorDto, user: JwtPayload, recibos?: ReciboBinario[]) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoDoDono(viagemId, user);
    this.assertNaoCancelado(v);
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para lançar despesas.');
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
    // Fila offline (app): reenvio com a mesma chave não duplica a despesa.
    if (dto.idempotencyKey) {
      const ja = await this.prisma.despesaVeiculo.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: { tipoDespesa: { select: { nome: true, categoria: true } } } });
      if (ja) return ja;
    }
    const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
    if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
    const autoridade = await this.ehAutoridadeSobre(v.supervisorRegistro, user);
    // INDIVÍDUO não tem veículo; VEÍCULO usa o veículo da viagem (se houver).
    const veiculoId = tipo.categoria === 'INDIVIDUO' ? null : v.veiculoId;
    const dataDespesa = this.parseData(dto.data);
    this.assertDataNoMes(dataDespesa, v.mesReferencia, 'despesa');
    const d = await this.prisma.despesaVeiculo.create({
      data: {
        filialId,
        veiculoId,
        viagemId,
        tipoDespesaId: tipo.id,
        valor: new Prisma.Decimal(dto.valor),
        dataDespesa,
        fornecedor: dto.fornecedor?.trim() || null,
        observacao: dto.observacao?.trim() || null,
        // Redesenho 6d: a despesa do representante nasce PENDENTE — o coordenador
        // aprova/rejeita (comprovante é opcional, mas lastreia a decisão) e só
        // APROVADA entra na RDV.
        // 27/07: quando quem lança É a autoridade que decidiria essa despesa
        // (coordenador daquele representante / Supervisor de Departamento do depto /
        // ADMIN), ela JÁ NASCE APROVADA — pedir aval de si mesmo não acrescenta
        // controle, só trava o lançamento. Mesma regra que o adiantamento já usa.
        situacao: autoridade ? 'APROVADA' : 'PENDENTE',
        aprovadoPorId: autoridade ? user.sub : null,
        aprovadoEm: autoridade ? new Date() : null,
        criadoPorId: user.sub,
        idempotencyKey: dto.idempotencyKey ?? null,
      },
      include: { tipoDespesa: { select: { nome: true, categoria: true } } },
    });
    if (recibos?.length) await this.anexarComprovantes(d.id, filialId, recibos);
    return d;
  }

  /** Decisão do coordenador sobre a despesa (6d): APROVADA ou CONTESTADA (rejeita,
   *  com motivo). Só o coordenador do supervisor (ou gestor) decide — e nunca quem
   *  lançou (segregação de função). */
  async decidirDespesa(viagemId: string, despesaId: string, decisao: 'APROVADA' | 'CONTESTADA', motivo: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id: despesaId },
      include: { viagem: { select: { tipo: true, filialId: true, supervisorRegistro: { select: { coordenadorId: true, departamentoId: true } } } } },
    });
    if (!d || d.viagemId !== viagemId || d.viagem?.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Despesa não encontrada.');
    if (d.filialId !== filialId) throw new ForbiddenException('Despesa de outra filial.');
    await this.assertPodeDecidir(d.viagem.supervisorRegistro, user);
    // Segregação de função: NÃO é um `if` aqui, é estrutural. Quem lança sendo a
    // autoridade daquele representante já cria APROVADA (não passa por aqui); quem
    // lança sem ser (o próprio representante) cria PENDENTE e o `assertPodeDecidir`
    // acima nunca o deixa decidir o próprio. Uma trava de "quem lançou não decide"
    // só atrapalharia a autoridade a contestar depois um lançamento que ela mesma fez.
    if (decisao === 'CONTESTADA' && !motivo?.trim()) throw new BadRequestException('Informe o motivo da rejeição da despesa.');
    return this.prisma.despesaVeiculo.update({
      where: { id: despesaId },
      data: {
        situacao: decisao,
        aprovadoPorId: user.sub,
        aprovadoEm: new Date(),
        motivoContestacao: decisao === 'CONTESTADA' ? motivo!.trim() : null,
      },
      include: { tipoDespesa: { select: { nome: true, categoria: true } } },
    });
  }

  async removerDespesa(viagemId: string, despesaId: string, user: JwtPayload) {
    const v = await this.planejamentoDoDono(viagemId, user);
    this.assertNaoCancelado(v);
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id: despesaId },
      include: { anexos: { select: { objectKey: true } } },
    });
    if (!d || d.viagemId !== viagemId) throw new NotFoundException('Despesa não encontrada.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para remover despesas.');
    // Limpa os binários (comprovante legado + anexos) — as linhas AnexoDespesa somem por cascade.
    const chaves = [d.comprovanteObjectKey, ...d.anexos.map((a) => a.objectKey)].filter((k): k is string => !!k);
    for (const k of chaves) {
      try { await this.storage.remove(k); } catch { /* objeto órfão é tolerável */ }
    }
    await this.prisma.despesaVeiculo.delete({ where: { id: despesaId } });
    return { ok: true };
  }

  /** Download do comprovante da despesa (o coordenador vê antes de decidir).
   *  Quem enxerga o planejamento enxerga o recibo — e o escopo do planejamento é o
   *  dono/coordenador/depto, não a filial inteira (nota fiscal é dado de terceiro). */
  async obterReciboDespesa(viagemId: string, despesaId: string, user: JwtPayload): Promise<{ buffer: Buffer; mimeType: string }> {
    await this.planejamentoDoDono(viagemId, user);
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id: despesaId } });
    if (!d || d.viagemId !== viagemId) throw new NotFoundException('Despesa não encontrada.');
    if (!d.comprovanteObjectKey) throw new NotFoundException('Esta despesa não tem comprovante anexado.');
    const buffer = await this.storage.get(d.comprovanteObjectKey);
    return { buffer, mimeType: d.comprovanteMime ?? 'application/octet-stream' };
  }

  // ---- Administração (Fase 5): correções do gestor ----
  async editarViagem(id: string, dto: EditarViagemSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { supervisorRegistro: { select: { coordenadorId: true, departamentoId: true } } } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    await this.assertEscopoSupervisor(v.supervisorRegistro, user);
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para editar.');
    return this.prisma.viagem.update({
      where: { id },
      data: {
        adiantamento: dto.adiantamento !== undefined ? new Prisma.Decimal(dto.adiantamento) : undefined,
      },
    });
  }

  async reabrirViagem(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { supervisorRegistro: { select: { coordenadorId: true, departamentoId: true } } } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    await this.assertEscopoSupervisor(v.supervisorRegistro, user);
    // Cancelado por engano: reabrir REATIVA e devolve para AJUSTADO (o representante
    // reconfigura e reenvia), limpando o rastro do cancelamento. As despesas que o
    // cancelamento contestou NÃO voltam sozinhas para PENDENTE — quem decidiu que
    // eram inválidas foi o coordenador, e ressuscitá-las em massa reabriria valores
    // que ele já recusou; ele reavalia uma a uma se for o caso.
    if (v.situacao === StatusViagem.CANCELADA || v.statusPlanejamento === 'CANCELADO') {
      return this.prisma.viagem.update({
        where: { id },
        data: { situacao: StatusViagem.EM_CURSO, statusPlanejamento: 'AJUSTADO', canceladoPorId: null, canceladoEm: null, motivoCancelamento: null },
      });
    }
    if (v.situacao !== StatusViagem.CONCLUIDA) return v;
    return this.prisma.viagem.update({
      where: { id },
      data: { situacao: StatusViagem.EM_CURSO, statusPlanejamento: 'EM_EXECUCAO', dataHoraChegada: null },
    });
  }

  async editarVisita(viagemId: string, paradaId: string, dto: AdicionarVisitaDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoDoDono(viagemId, user);
    this.assertNaoCancelado(v);
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== viagemId) throw new NotFoundException('Visita não encontrada.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para editar.');
    if (dto.atividadeId) {
      const a = await this.prisma.atividadeVisita.findUnique({ where: { id: dto.atividadeId } });
      if (!a || (a.filialId && a.filialId !== filialId)) throw new BadRequestException('Atividade inválida para esta filial.');
    }
    return this.prisma.parada.update({
      where: { id: paradaId },
      data: {
        atividadeId: dto.atividadeId !== undefined ? (dto.atividadeId || null) : undefined,
        clienteMatricula: dto.clienteMatricula !== undefined ? (dto.clienteMatricula.trim().toUpperCase() || null) : undefined,
        clienteNome: dto.clienteNome !== undefined ? (dto.clienteNome.trim() || null) : undefined,
        municipio: dto.municipio !== undefined ? (dto.municipio.trim() || null) : undefined,
        propriedade: dto.propriedade !== undefined ? (dto.propriedade.trim() || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao.trim() || null) : undefined,
        dataHora: dto.dataVisita !== undefined ? this.parseData(dto.dataVisita) : undefined,
      },
      include: { atividade: { select: { nome: true } } },
    });
  }

  async editarDespesa(viagemId: string, despesaId: string, dto: EditarDespesaSupervisorDto, user: JwtPayload, recibo?: ReciboBinario) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoDoDono(viagemId, user);
    this.assertNaoCancelado(v);
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id: despesaId } });
    if (!d || d.viagemId !== viagemId) throw new NotFoundException('Despesa não encontrada.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para editar.');
    // Trocar o tipo reclassifica a categoria → recalcula se tem veículo.
    let tipoId: string | undefined;
    let veiculoId: string | null | undefined;
    if (dto.tipoDespesaId) {
      const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
      if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
      tipoId = tipo.id;
      veiculoId = tipo.categoria === 'INDIVIDUO' ? null : v.veiculoId;
    }
    // Editar a data também respeita o mês do planejamento (RDV é mensal).
    if (dto.data !== undefined) this.assertDataNoMes(this.parseData(dto.data), v.mesReferencia, 'despesa');
    // Troca do comprovante: sobe o novo e remove o antigo (best-effort).
    if (recibo) {
      if (d.comprovanteObjectKey) {
        try { await this.storage.remove(d.comprovanteObjectKey); } catch { /* órfão tolerável */ }
      }
      await this.anexarReciboDespesa(despesaId, filialId, recibo);
    }
    return this.prisma.despesaVeiculo.update({
      where: { id: despesaId },
      data: {
        tipoDespesaId: tipoId,
        veiculoId,
        valor: dto.valor !== undefined ? new Prisma.Decimal(dto.valor) : undefined,
        dataDespesa: dto.data !== undefined ? this.parseData(dto.data) : undefined,
        fornecedor: dto.fornecedor !== undefined ? (dto.fornecedor.trim() || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao.trim() || null) : undefined,
      },
      include: { tipoDespesa: { select: { nome: true, categoria: true } } },
    });
  }

  /**
   * RDV (Relatório de Despesas de Viagem): agrega DIA × TIPO de despesa, com o
   * município do dia (das visitas), totais por tipo/categoria e o SALDO contra o
   * adiantamento. Espelha a planilha "RDV Maio".
   */
  async rdv(viagemId: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    // A folha do RDV é a prestação de contas de UMA pessoa: mesmo escopo do detalhe.
    await this.planejamentoDoDono(viagemId, user);
    const v = await this.prisma.viagem.findUnique({
      where: { id: viagemId },
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        // Só despesas APROVADAS entram na RDV (mesma regra da RDV mensal/Fechamento);
        // PENDENTE/CONTESTADA não somam no relatório de prestação de contas.
        despesas: { where: { situacao: 'APROVADA' }, include: { tipoDespesa: { select: { id: true, nome: true, categoria: true } } } },
        paradas: { select: { dataHora: true, municipio: true } },
      },
    });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');

    const diaDe = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '—');

    // Colunas = tipos distintos usados nas despesas (ordem por nome).
    const tiposMap = new Map<string, { id: string; nome: string; categoria: string }>();
    for (const d of v.despesas) {
      if (d.tipoDespesa) tiposMap.set(d.tipoDespesa.id, { id: d.tipoDespesa.id, nome: d.tipoDespesa.nome, categoria: d.tipoDespesa.categoria });
    }
    const tipos = [...tiposMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // Municípios por dia (das visitas).
    const munsPorDia = new Map<string, Set<string>>();
    for (const p of v.paradas) {
      if (!p.municipio) continue;
      const dia = diaDe(p.dataHora);
      if (!munsPorDia.has(dia)) munsPorDia.set(dia, new Set());
      munsPorDia.get(dia)!.add(p.municipio);
    }

    // Grade dia × tipo.
    const diasMap = new Map<string, { valores: Record<string, number>; total: number }>();
    const totaisPorTipo: Record<string, number> = {};
    const totaisPorCategoria = { VEICULO: 0, INDIVIDUO: 0 };
    let total = 0;
    for (const d of v.despesas) {
      const dia = diaDe(d.dataDespesa);
      const tid = d.tipoDespesaId;
      const val = Number(d.valor);
      if (!diasMap.has(dia)) diasMap.set(dia, { valores: {}, total: 0 });
      const linha = diasMap.get(dia)!;
      linha.valores[tid] = (linha.valores[tid] ?? 0) + val;
      linha.total += val;
      totaisPorTipo[tid] = (totaisPorTipo[tid] ?? 0) + val;
      const cat = d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'INDIVIDUO' : 'VEICULO';
      totaisPorCategoria[cat] += val;
      total += val;
    }
    const dias = [...diasMap.entries()]
      .map(([data, o]) => ({ data, municipios: [...(munsPorDia.get(data) ?? [])], valores: o.valores, total: o.total }))
      .sort((a, b) => a.data.localeCompare(b.data));

    // Adiantamento migrou p/ a tabela Adiantamento (mensal, por supervisor) no
    // redesenho 6b — v.adiantamento é OBSOLETO (fica nulo). Soma os adiantamentos
    // do supervisor no mês (como o rdvMensal); fallback = campo legado.
    let adiantamento = v.adiantamento != null ? Number(v.adiantamento) : 0;
    if (v.supervisorRegistroId && v.mesReferencia != null) {
      const advs = await this.prisma.adiantamento.findMany({
        where: { supervisorId: v.supervisorRegistroId, mesReferencia: v.mesReferencia, situacao: 'APROVADO' },
        select: { valor: true },
      });
      if (advs.length) adiantamento = advs.reduce((s, a) => s + Number(a.valor), 0);
    }
    // saldo > 0 = sobra do adiantamento (a devolver à CAPUL); < 0 = a reembolsar.
    const saldo = adiantamento - total;

    return {
      viagem: { id: v.id, numero: v.numero, mesReferencia: v.mesReferencia, situacao: v.situacao },
      supervisor: { matricula: v.condutorMatricula, nome: v.condutorNome },
      veiculo: v.veiculo,
      tipos,
      dias,
      totaisPorTipo,
      totaisPorCategoria,
      total,
      adiantamento,
      saldo,
    };
  }

  /** Cadastro do supervisor de área LOGADO (auto-serviço) — resolve pela matrícula do
   *  login, na filial dele (mesmo lookup do criarViagemSupervisor). null se ainda não
   *  foi montado no time. Serve p/ o front fixar o "meu" supervisorId no Fechamento. */
  async meuCadastroSupervisor(user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const u = await this.matriculaDoUsuario(user.sub);
    if (!u?.matricula?.trim()) return null;
    const reg = await this.prisma.supervisor.findFirst({
      where: { filialId, matricula: u.matricula.trim().toUpperCase(), ativo: true },
      select: { id: true, nome: true, matricula: true, coordenadorId: true },
    });
    return reg ?? null;
  }

  // ---- Adiantamentos (mensais, vários por supervisor/mês) ----
  async lancarAdiantamento(dto: LancarAdiantamentoDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: dto.supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new BadRequestException('Supervisor inválido para esta filial.');
    await this.assertEscopoSupervisor(sup, user);
    if (dto.mesReferencia % 100 < 1 || dto.mesReferencia % 100 > 12) throw new BadRequestException('Mês de referência inválido (AAAAMM).');
    await this.assertRdvAberto(dto.supervisorId, dto.mesReferencia);
    // Auto-serviço do supervisor de área nasce PENDENTE (o coordenador aprova). O
    // lançamento do coordenador/departamento/admin já nasce APROVADO (são a autoridade).
    const ehAutoServico = this.roleLog(user) === 'SUPERVISOR';
    const dataAdiantamento = this.parseData(dto.data);
    this.assertDataNoMes(dataAdiantamento, dto.mesReferencia, 'adiantamento');
    return this.prisma.adiantamento.create({
      data: {
        supervisorId: dto.supervisorId, mesReferencia: dto.mesReferencia,
        valor: new Prisma.Decimal(dto.valor), dataAdiantamento,
        observacao: dto.observacao?.trim() || null, lancadoPorId: user.sub,
        situacao: ehAutoServico ? 'PENDENTE' : 'APROVADO',
        decididoPorId: ehAutoServico ? null : user.sub,
        decididoEm: ehAutoServico ? null : new Date(),
      },
    });
  }

  /** Coordenador / Supervisor de Departamento decide um adiantamento PENDENTE (lançado
   *  em auto-serviço pelo supervisor de área). O supervisionado NUNCA decide o próprio
   *  (assertPodeDecidir barra). Rejeitar exige motivo. Só mexe em mês aberto. */
  async decidirAdiantamento(id: string, decisao: 'APROVAR' | 'REJEITAR', motivo: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const a = await this.prisma.adiantamento.findUnique({ where: { id }, include: { supervisor: { select: { filialId: true, coordenadorId: true, departamentoId: true } } } });
    if (!a || a.supervisor.filialId !== filialId) throw new NotFoundException('Adiantamento não encontrado.');
    await this.assertPodeDecidir(a.supervisor, user);
    await this.assertRdvAberto(a.supervisorId, a.mesReferencia);
    if (a.situacao !== 'PENDENTE') throw new BadRequestException('Este adiantamento já foi decidido.');
    const aprovar = decisao === 'APROVAR';
    if (!aprovar && !motivo?.trim()) throw new BadRequestException('Informe o motivo da rejeição.');
    return this.prisma.adiantamento.update({
      where: { id },
      data: {
        situacao: aprovar ? 'APROVADO' : 'REJEITADO',
        decididoPorId: user.sub, decididoEm: new Date(),
        motivoRejeicao: aprovar ? null : motivo!.trim(),
      },
    });
  }
  async listarAdiantamentos(user: JwtPayload, supervisorId: string, mes: number) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user);
    return this.prisma.adiantamento.findMany({ where: { supervisorId, mesReferencia: mes }, orderBy: { dataAdiantamento: 'asc' } });
  }
  async removerAdiantamento(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const a = await this.prisma.adiantamento.findUnique({ where: { id }, include: { supervisor: { select: { filialId: true, coordenadorId: true, departamentoId: true, matricula: true } } } });
    if (!a || a.supervisor.filialId !== filialId) throw new NotFoundException('Adiantamento não encontrado.');
    await this.assertEscopoSupervisor(a.supervisor, user);
    await this.prisma.adiantamento.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Encerramento mensal do RDV (TEMA 2) ----
  async fecharRdv(supervisorId: string, mes: number, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user); // coordenador do supervisor ou gestor
    await this.prisma.fechamentoRdv.upsert({
      where: { supervisorId_mesReferencia: { supervisorId, mesReferencia: mes } },
      create: { supervisorId, mesReferencia: mes, fechadoPorId: user.sub },
      update: {},
    });
    return { fechado: true as const };
  }
  async reabrirRdv(supervisorId: string, mes: number, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user);
    await this.prisma.fechamentoRdv.deleteMany({ where: { supervisorId, mesReferencia: mes } });
    return { fechado: false as const };
  }

  /** RDV MENSAL: agrega TODOS os planejamentos do supervisor no mês (despesas
   *  aprovadas, dia × tipo) + os adiantamentos → saldo. */
  async rdvMensal(supervisorId: string, mes: number, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user);

    const planejamentos = await this.prisma.viagem.findMany({
      where: { filialId, tipo: TipoViagem.SUPERVISOR, supervisorRegistroId: supervisorId, mesReferencia: mes },
      include: {
        despesas: { where: { situacao: 'APROVADA' }, include: { tipoDespesa: { select: { id: true, nome: true, categoria: true } } } },
        paradas: { orderBy: { sequencia: 'asc' }, include: { atividade: { select: { nome: true } } } },
      },
      orderBy: { numero: 'asc' },
    });
    const despesas = planejamentos.flatMap((p) => p.despesas);
    const paradas = planejamentos.flatMap((p) => p.paradas);
    // Relatórios MENSAIS (fechamento é mensal): a lista de planejamentos do mês e
    // TODAS as visitas do mês (de todos os planejamentos), com o nº do planejamento.
    const planejamentosLista = planejamentos.map((p) => ({ id: p.id, numero: p.numero, statusPlanejamento: p.statusPlanejamento }));
    const visitas = planejamentos.flatMap((p) => p.paradas.map((v) => ({
      id: v.id, planejamentoNumero: p.numero, sequencia: v.sequencia,
      clienteNome: v.clienteNome, clienteMatricula: v.clienteMatricula,
      municipio: v.municipio, propriedade: v.propriedade, observacao: v.observacao,
      dataHora: v.dataHora, status: v.status, motivoPulada: v.motivoPulada,
      atividade: v.atividade ? { nome: v.atividade.nome } : null,
    })));
    // Lista COMPLETA de municípios visitados no mês (de TODAS as visitas, não só dos
    // dias com despesa — a grade por dia é orientada por despesa e omitia cidades).
    const municipios = [...new Set(
      visitas.map((v) => v.municipio?.trim()).filter((m): m is string => !!m).map((m) => m.toLocaleUpperCase('pt-BR')),
    )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const diaDe = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '—');

    const tiposMap = new Map<string, { id: string; nome: string; categoria: string }>();
    for (const d of despesas) if (d.tipoDespesa) tiposMap.set(d.tipoDespesa.id, { id: d.tipoDespesa.id, nome: d.tipoDespesa.nome, categoria: d.tipoDespesa.categoria });
    const tipos = [...tiposMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const munsPorDia = new Map<string, Set<string>>();
    for (const p of paradas) { if (!p.municipio) continue; const dia = diaDe(p.dataHora); if (!munsPorDia.has(dia)) munsPorDia.set(dia, new Set()); munsPorDia.get(dia)!.add(p.municipio); }

    const diasMap = new Map<string, { valores: Record<string, number>; total: number }>();
    const totaisPorTipo: Record<string, number> = {};
    const totaisPorCategoria = { VEICULO: 0, INDIVIDUO: 0 };
    let total = 0;
    for (const d of despesas) {
      const dia = diaDe(d.dataDespesa); const tid = d.tipoDespesaId; const val = Number(d.valor);
      if (!diasMap.has(dia)) diasMap.set(dia, { valores: {}, total: 0 });
      const linha = diasMap.get(dia)!; linha.valores[tid] = (linha.valores[tid] ?? 0) + val; linha.total += val;
      totaisPorTipo[tid] = (totaisPorTipo[tid] ?? 0) + val;
      totaisPorCategoria[d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'INDIVIDUO' : 'VEICULO'] += val;
      total += val;
    }
    const dias = [...diasMap.entries()].map(([data, o]) => ({ data, municipios: [...(munsPorDia.get(data) ?? [])], valores: o.valores, total: o.total })).sort((a, b) => a.data.localeCompare(b.data));

    const adiantamentos = await this.prisma.adiantamento.findMany({ where: { supervisorId, mesReferencia: mes }, orderBy: { dataAdiantamento: 'asc' } });
    // Só APROVADO entra no saldo; PENDENTE fica à parte (aguardando o coordenador).
    const totalAdiantamento = adiantamentos.filter((a) => a.situacao === 'APROVADO').reduce((s, a) => s + Number(a.valor), 0);
    const totalAdiantamentoPendente = adiantamentos.filter((a) => a.situacao === 'PENDENTE').reduce((s, a) => s + Number(a.valor), 0);
    const saldo = totalAdiantamento - total; // >0 devolver à CAPUL; <0 reembolsar
    // TEMA 2: mês encerrado? (trava novos lançamentos até reabrir)
    const fech = await this.prisma.fechamentoRdv.findUnique({ where: { supervisorId_mesReferencia: { supervisorId, mesReferencia: mes } } });

    return {
      supervisor: { id: sup.id, matricula: sup.matricula, nome: sup.nome },
      mesReferencia: mes, planejamentos: planejamentos.length,
      planejamentosLista, visitas, municipios,
      tipos, dias, totaisPorTipo, totaisPorCategoria, total,
      adiantamentos, totalAdiantamento, totalAdiantamentoPendente, saldo,
      fechado: !!fech, fechadoEm: fech?.fechadoEm ?? null,
    };
  }

  /** Parseia data do formulário. Date-only ("YYYY-MM-DD") vira MEIO-DIA em SP p/
   *  não recuar 1 dia no fuso (UTC midnight → dia anterior no Brasil). */
  private parseData(s?: string): Date {
    if (!s) return new Date();
    return s.includes('T') ? new Date(s) : new Date(`${s}T12:00:00-03:00`);
  }

  /** AAAA-MM da data (em -03:00) como inteiro AAAAMM — para comparar com mesReferencia. */
  private mesDaData(d: Date): number {
    const s = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
    return Number(s.slice(0, 4)) * 100 + Number(s.slice(5, 7));
  }
  /** Barra lançamento com data fora do mês do planejamento (RDV é mensal). */
  private assertDataNoMes(d: Date, mesReferencia: number | null | undefined, rotulo: 'despesa' | 'adiantamento') {
    if (!mesReferencia) return;
    const m = this.mesDaData(d);
    if (m !== mesReferencia) {
      const fmt = (mm: number) => `${String(mm % 100).padStart(2, '0')}/${Math.floor(mm / 100)}`;
      throw new BadRequestException(`Data da ${rotulo} (${fmt(m)}) fora do mês do planejamento (${fmt(mesReferencia)}). Informe uma data dentro de ${fmt(mesReferencia)}.`);
    }
  }

}
