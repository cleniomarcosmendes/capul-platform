import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, StatusViagem, TipoViagem, SituacaoVeiculo, StatusDespesa, StatusParada, TipoManutencao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { CondutorTokenService } from '../common/condutor-token.service.js';
import { SaidaFrotaDto, SaidaIndividualDto, RetornoFrotaDto, RetornoPortariaDto, AjusteGestorDto, AddParadaDto, RegistrarManutencaoDto, SaidaPortariaDto, PlanejarParadasDto, CheckinParadaDto, CriarLocalParadaDto, AtualizarLocalParadaDto } from './dto.js';

// Mesma normalização do toChapaPortal pra comparar matrículas com segurança.
const chapa = (m: string) => 'E' + (m || '').replace(/\D/g, '').slice(-5).padStart(5, '0');

// Quantos km antes da próxima revisão o Monitor começa a avisar.
const LIMIAR_AVISO_MANUTENCAO_KM = 500;

/**
 * Controle de FROTA (Fase 2) — viagens internas (saída/retorno), o "caderno
 * digital" da portaria. O CONDUTOR se identifica por matrícula+senha (Protheus,
 * só funcionário ativo); gestor de frota / supervisor do veículo podem ajustar.
 */
@Injectable()
export class FrotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly condutor: ProtheusCondutorService,
    private readonly core: CoreLookupService,
    private readonly condutorToken: CondutorTokenService,
  ) {}

  /**
   * Gate do login PADRÃO: ao abrir uma viagem em curso, o condutor se identifica
   * (matrícula+senha do RH) UMA vez. Se for o condutor que iniciou a viagem,
   * emite o token que libera parada/despesa/retorno sem repetir o loginPortal.
   * SEMPRE 200 com {valida, motivo?} (a senha errada nunca vira 401/403 que
   * derruba a sessão do app).
   */
  async autenticarCondutor(viagemId: string, matricula: string, senha: string, user: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A viagem não está em curso.');

    const r = await this.condutor.validar(matricula, senha);
    if (r.status === 'INDISPONIVEL') return { valida: false as const, motivo: 'INDISPONIVEL' as const };
    if (r.status !== 'VALIDO') return { valida: false as const, motivo: 'CREDENCIAIS_INVALIDAS' as const };
    if (chapa(r.matricula) !== chapa(v.condutorMatricula ?? '')) {
      return { valida: false as const, motivo: 'NAO_E_O_CONDUTOR' as const };
    }
    const { token, expiraEmSeg } = this.condutorToken.emitir(v.id, r.matricula);
    return { valida: true as const, token, expiraEmSeg, condutorNome: r.nome };
  }

  /** Passo 1 da saída: identifica o condutor pelo nome (antes da senha). */
  async buscarCondutor(matricula: string) {
    const r = await this.condutor.buscarNome(matricula);
    if (!r) throw new NotFoundException('Matrícula não encontrada no Protheus.');
    return r;
  }

  /**
   * Validação matrícula+senha que SEMPRE responde 200 com {valida, motivo}
   * (mesmo padrão do Chamado PADRAO). O frontend valida por aqui ANTES de
   * registrar — assim a senha errada nunca vira 401/erro que desloga p/ o Hub.
   */
  async validarCondutor(matricula: string, senha: string) {
    const r = await this.condutor.validar(matricula, senha);
    if (r.status === 'VALIDO') return { valida: true as const, matricula: r.matricula, nome: r.nome };
    if (r.status === 'INVALIDO') return { valida: false as const, motivo: 'CREDENCIAIS_INVALIDAS' as const };
    return { valida: false as const, motivo: 'INDISPONIVEL' as const };
  }

  // Revalidação no momento de registrar (defesa em profundidade). 400 (não 401):
  // senha do condutor é dado do formulário, não expiração do JWT do usuário.
  private async validarOuErro(matricula: string, senha: string) {
    const r = await this.condutor.validar(matricula, senha);
    if (r.status === 'INDISPONIVEL') {
      throw new ServiceUnavailableException('Portal do RH indisponível. Tente novamente em instantes.');
    }
    if (r.status !== 'VALIDO') throw new BadRequestException('Matrícula ou senha inválidas.');
    return r;
  }

  /** RDV (viagem SUPERVISOR) a vincular à saída: usa o explícito (validado na
   *  filial) ou auto-vincula pelo RDV do MÊS do condutor (match por matrícula). */
  private async resolverRdvDaSaida(filialId: string, condutorMatricula: string | null, rdvExplicito?: string): Promise<string | null> {
    if (rdvExplicito) {
      const v = await this.prisma.viagem.findFirst({ where: { id: rdvExplicito, tipo: TipoViagem.SUPERVISOR, filialId } });
      return v?.id ?? null;
    }
    if (!condutorMatricula) return null;
    const agora = new Date();
    const mesRef = agora.getFullYear() * 100 + (agora.getMonth() + 1);
    const cands = await this.prisma.viagem.findMany({
      where: { tipo: TipoViagem.SUPERVISOR, filialId, mesReferencia: mesRef, situacao: { not: StatusViagem.CONCLUIDA } },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, condutorMatricula: true },
    });
    const m = chapa(condutorMatricula);
    return cands.find((c) => chapa(c.condutorMatricula ?? '') === m)?.id ?? null;
  }

  /** RDVs (SUPERVISOR) do MÊS do condutor (por matrícula), não concluídos — p/ o
   *  seletor de vínculo no form de Saída. O 1º da lista é o auto-match. */
  async rdvCandidatosDoCondutor(user: JwtPayload, matricula: string) {
    const filialId = user.filialId;
    if (!filialId || !matricula.trim()) return [];
    const agora = new Date();
    const mesRef = agora.getFullYear() * 100 + (agora.getMonth() + 1);
    const cands = await this.prisma.viagem.findMany({
      where: { tipo: TipoViagem.SUPERVISOR, filialId, mesReferencia: mesRef, situacao: { not: StatusViagem.CONCLUIDA } },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, numero: true, mesReferencia: true, condutorMatricula: true, supervisorRegistro: { select: { nome: true } } },
    });
    const m = chapa(matricula);
    return cands
      .filter((c) => chapa(c.condutorMatricula ?? '') === m)
      .map((c) => ({ id: c.id, numero: c.numero, mesReferencia: c.mesReferencia, supervisorNome: c.supervisorRegistro?.nome ?? c.condutorMatricula }));
  }

  /** Registrar SAÍDA do veículo (condutor autentica). Veículo → EM_USO. */
  async registrarSaida(dto: SaidaFrotaDto, user: JwtPayload) {
    // PADRAO: identifica o condutor por matrícula+senha do portal RH.
    const cond = await this.validarOuErro(dto.matricula, dto.senha);
    return this.criarSaida(user, cond.matricula, cond.nome, dto);
  }

  /**
   * INDIVIDUAL: usuário já autenticado é o próprio condutor — NÃO pede senha. A
   * matrícula/nome vêm do cadastro do usuário (core). Se o usuário não tiver
   * matrícula, orienta a cadastrar (ou usar o fluxo com matrícula+senha).
   */
  async registrarSaidaIndividual(dto: SaidaIndividualDto, user: JwtPayload) {
    const col = await this.core.colaboradorDoUsuario(user.sub);
    if (!col) {
      throw new BadRequestException(
        'Seu usuário não tem matrícula cadastrada. Peça ao administrador para cadastrá-la ou registre a saída informando matrícula e senha.',
      );
    }
    return this.criarSaida(user, col.matricula, col.nome, dto);
  }

  /** Núcleo da saída de frota — compartilhado pelos fluxos PADRAO e INDIVIDUAL. */
  private async criarSaida(
    user: JwtPayload,
    condutorMatricula: string,
    condutorNome: string,
    dados: { veiculoId: string; kmInicial: number; finalidade?: string; localSaida?: string; departamentoSolicitanteId?: string; paradasPlanejadas?: string[]; rdvViagemId?: string },
  ) {
    const filialId = user.filialId;
    if (!filialId) throw new BadRequestException('Usuário sem filial definida.');
    const rdvViagemId = await this.resolverRdvDaSaida(filialId, condutorMatricula, dados.rdvViagemId);

    // Frota é recurso COMPARTILHADO: o condutor pode usar veículo de qualquer
    // filial/departamento. A viagem é registrada na filial do login (contexto
    // operacional); o veículo é só emprestado e volta DISPONÍVEL no retorno.
    const veiculo = await this.prisma.veiculo.findFirst({
      where: { id: dados.veiculoId, ativo: true },
    });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado.');
    if (veiculo.situacao !== SituacaoVeiculo.DISPONIVEL) {
      throw new BadRequestException(`Veículo indisponível (situação: ${veiculo.situacao}).`);
    }
    if (dados.kmInicial < veiculo.kmAtual) {
      throw new BadRequestException(`KM inicial (${dados.kmInicial}) menor que o KM atual do veículo (${veiculo.kmAtual}).`);
    }

    const viagem = await this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId, escopo: 'VIAGEM' } },
        create: { filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      const v = await tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId,
          tipo: TipoViagem.FROTA,
          situacao: StatusViagem.EM_CURSO,
          veiculoId: veiculo.id,
          condutorMatricula,
          condutorNome,
          rdvViagemId,
          departamentoSolicitanteId: dados.departamentoSolicitanteId ?? null,
          kmInicial: dados.kmInicial,
          localSaida: dados.localSaida ?? null,
          observacoesSaida: dados.finalidade ?? null,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
      });
      await tx.veiculo.update({ where: { id: veiculo.id }, data: { situacao: SituacaoVeiculo.EM_USO } });
      return v;
    });
    await this.seedParadasPlanejadas(viagem.id, dados.paradasPlanejadas);
    // Anexa a placa/modelo p/ a confirmação do app ("PLACA · viagem #N").
    return { ...viagem, placa: veiculo.placa, modelo: veiculo.modelo };
  }

  /** Cria as paradas PLANEJADAS da rota informada na saída (opcional). */
  private async seedParadasPlanejadas(viagemId: string, locais?: string[]) {
    const limpos = (locais ?? []).map((l) => l.trim()).filter(Boolean);
    if (limpos.length === 0) return;
    let seq = 1;
    await this.prisma.parada.createMany({
      data: limpos.map((local) => ({
        viagemId, sequencia: seq++, status: StatusParada.PLANEJADA, planejadoLocal: local, local,
      })),
    });
  }

  /**
   * Busca condutores por NOME no Protheus (infoPortal) — para a EXCEÇÃO da
   * portaria. Não exige senha; é só consulta. Lista ordenada por nome.
   */
  async buscarCondutoresPorNome(nome: string) {
    if (!nome || nome.trim().length < 3) {
      throw new BadRequestException('Informe ao menos 3 letras do nome.');
    }
    return this.condutor.buscarPorNome(nome);
  }

  /**
   * Registrar SAÍDA pela PORTARIA (exceção): usuário autorizado aponta a viagem
   * ao condutor (escolhido na busca por nome) SEM a senha dele. A accountability
   * é do usuário logado (criadoPorId) — fica registrado `registradaPortaria=true`.
   * Mesma validação de veículo/KM da saída normal.
   */
  async registrarSaidaPortaria(dto: SaidaPortariaDto, user: JwtPayload) {
    const filialId = user.filialId;
    if (!filialId) throw new BadRequestException('Usuário sem filial definida.');

    // Frota COMPARTILHADA (igual à saída normal): veículo de qualquer filial; a
    // viagem nasce na filial do login (contexto operacional).
    const veiculo = await this.prisma.veiculo.findFirst({
      where: { id: dto.veiculoId, ativo: true },
    });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado.');
    if (veiculo.situacao !== SituacaoVeiculo.DISPONIVEL) {
      throw new BadRequestException(`Veículo indisponível (situação: ${veiculo.situacao}).`);
    }
    if (dto.kmInicial < veiculo.kmAtual) {
      throw new BadRequestException(`KM inicial (${dto.kmInicial}) menor que o KM atual do veículo (${veiculo.kmAtual}).`);
    }

    // Porteiro identifica-se por matrícula+senha (Protheus) — accountability e
    // autorização. NÃO é a senha do motorista (que sai apontado por nome).
    const porteiro = await this.validarOuErro(dto.porteiroMatricula, dto.porteiroSenha);
    const rdvViagemId = await this.resolverRdvDaSaida(filialId, dto.condutorMatricula, dto.rdvViagemId);

    const novaViagem = await this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId, escopo: 'VIAGEM' } },
        create: { filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      const viagem = await tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId,
          tipo: TipoViagem.FROTA,
          situacao: StatusViagem.EM_CURSO,
          veiculoId: veiculo.id,
          condutorMatricula: dto.condutorMatricula.trim(),
          condutorNome: dto.condutorNome.trim(),
          registradaPortaria: true,
          porteiroSaidaMatricula: porteiro.matricula,
          porteiroSaidaNome: porteiro.nome,
          rdvViagemId,
          departamentoSolicitanteId: dto.departamentoSolicitanteId ?? null,
          kmInicial: dto.kmInicial,
          localSaida: dto.localSaida ?? null,
          observacoesSaida: dto.finalidade ?? null,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
      });
      await tx.veiculo.update({ where: { id: veiculo.id }, data: { situacao: SituacaoVeiculo.EM_USO } });
      return viagem;
    });
    await this.seedParadasPlanejadas(novaViagem.id, dto.paradasPlanejadas);
    return novaViagem;
  }

  /** Registrar RETORNO (só o próprio condutor). Veículo → DISPONIVEL + km atualizado. */
  async registrarRetorno(id: string, dto: RetornoFrotaDto, user: JwtPayload, condutorToken?: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    // Gestor de frota/ADMIN fecham viagem de qualquer filial (frota da empresa
    // toda). Demais: só a própria filial. A identidade do condutor ("só quem
    // iniciou") segue valendo abaixo — é regra separada da filial.
    if (!this.ehGestorFrota(user) && v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A viagem não está em curso.');

    // PADRÃO (login compartilhado): o token de condutor (do gate ao abrir a viagem)
    // já provou que é o condutor que iniciou. INDIVIDUAL/fallback: matrícula+senha.
    if (user.tipo === 'PADRAO' && condutorToken) {
      this.condutorToken.verificar(condutorToken, v.id);
    } else {
      if (!dto.matricula || !dto.senha) {
        throw new BadRequestException('Informe matrícula e senha do condutor para fechar a viagem.');
      }
      const cond = await this.validarOuErro(dto.matricula, dto.senha);
      if (chapa(cond.matricula) !== chapa(v.condutorMatricula ?? '')) {
        throw new ForbiddenException('Só o condutor que iniciou pode fechar a viagem. Para corrigir, peça ao gestor de frota.');
      }
    }
    if (dto.kmFinal < (v.kmInicial ?? 0)) {
      throw new BadRequestException(`KM final (${dto.kmFinal}) menor que o KM de saída (${v.kmInicial}).`);
    }
    return this.fechar(id, v.veiculoId, dto.kmFinal, dto.observacoes ?? null);
  }

  /**
   * RETORNO pela PORTARIA: encerra a rota SEM a senha do motorista. O porteiro
   * identifica-se por matrícula+senha (accountability e autorização). Gestor de
   * frota/ADMIN fecham em qualquer filial; PORTARIA/demais só na própria. Não exige
   * que a saída tenha sido pela portaria — a portaria encerra qualquer rota em curso.
   */
  async registrarRetornoPortaria(id: string, dto: RetornoPortariaDto, user: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (!this.ehGestorFrota(user) && v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A viagem não está em curso.');
    if (dto.kmFinal < (v.kmInicial ?? 0)) {
      throw new BadRequestException(`KM final (${dto.kmFinal}) menor que o KM de saída (${v.kmInicial}).`);
    }
    // Porteiro autentica-se (matrícula+senha) — NÃO a senha do motorista.
    const porteiro = await this.validarOuErro(dto.porteiroMatricula, dto.porteiroSenha);
    return this.fechar(id, v.veiculoId, dto.kmFinal, dto.observacoes?.trim() ?? null, {
      porteiroRetornoMatricula: porteiro.matricula,
      porteiroRetornoNome: porteiro.nome,
    });
  }

  /** Ajuste/fechamento por GESTOR_FROTA ou supervisor do veículo. */
  async ajustarPorGestor(id: string, dto: AjusteGestorDto, user: JwtPayload, role?: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { veiculo: { select: { supervisorId: true, departamentoLotacaoId: true } } } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');

    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    // Gestor ajusta/fecha viagem de qualquer filial (frota da empresa toda). O dono
    // (registrante/supervisor) só a sua — que está na própria filial de qualquer forma.
    if (!ehGestor && v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    // Dono da operação (registrante OU supervisor do veículo) também ajusta a SUA.
    const ehDono = await this.donoOuEscopo(v, user);
    if (!ehGestor && !ehDono) {
      throw new ForbiddenException('Apenas o gestor de frota, o supervisor do veículo ou quem registrou a saída podem ajustar.');
    }
    // Acerto encerrado trava o adiantamento (financeiro); KM/obs (correção) seguem.
    if (dto.adiantamento !== undefined && v.acertoEncerradoEm) {
      throw new BadRequestException('Acerto encerrado — reabra o acerto para alterar o adiantamento.');
    }

    const kmFinal = dto.kmFinal ?? v.kmFinal ?? undefined;
    if (dto.concluir) {
      if (kmFinal == null) throw new BadRequestException('Informe o KM final para concluir.');
      if (kmFinal < (dto.kmInicial ?? v.kmInicial ?? 0)) throw new BadRequestException('KM final menor que o KM de saída.');
      return this.fechar(id, v.veiculoId, kmFinal, dto.observacoesChegada ?? v.observacoesChegada ?? null, {
        kmInicial: dto.kmInicial, observacoesSaida: dto.observacoesSaida, adiantamento: dto.adiantamento,
      });
    }
    // Só edita (sem fechar).
    return this.prisma.viagem.update({
      where: { id },
      data: {
        kmInicial: dto.kmInicial ?? undefined,
        kmFinal: dto.kmFinal ?? undefined,
        observacoesSaida: dto.observacoesSaida ?? undefined,
        observacoesChegada: dto.observacoesChegada ?? undefined,
        adiantamento: dto.adiantamento !== undefined ? new Prisma.Decimal(dto.adiantamento) : undefined,
      },
    });
  }

  /** Encerra o ACERTO da viagem (independente da conclusão): trava despesa e
   *  adiantamento até reabrir. O veículo já foi liberado ao entregar. Gestor de
   *  frota, supervisor do veículo ou quem registrou a saída. */
  async encerrarAcerto(id: string, user: JwtPayload, role?: string) {
    const v = await this.acertoScope(id, user, role);
    if (v.situacao === StatusViagem.CANCELADA) throw new BadRequestException('Viagem cancelada — não há acerto a encerrar.');
    return this.prisma.viagem.update({ where: { id }, data: { acertoEncerradoEm: new Date(), acertoEncerradoPorId: user.sub } });
  }
  async reabrirAcerto(id: string, user: JwtPayload, role?: string) {
    await this.acertoScope(id, user, role);
    return this.prisma.viagem.update({ where: { id }, data: { acertoEncerradoEm: null, acertoEncerradoPorId: null } });
  }
  private async acertoScope(id: string, user: JwtPayload, role?: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { veiculo: { select: { supervisorId: true, departamentoLotacaoId: true } } } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    if (!ehGestor && v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    const ehDono = await this.donoOuEscopo(v, user);
    if (!ehGestor && !ehDono) throw new ForbiddenException('Apenas o gestor de frota, o supervisor do veículo ou quem registrou a saída podem alterar o acerto.');
    return v;
  }

  /**
   * Registra manutenção feita: marca o odômetro da revisão (kmUltimaManutencao)
   * e agenda a próxima (km + intervalo). Reseta o alerta preventivo do veículo.
   * Gestor de frota ou supervisor do veículo (mesma governança do ajuste).
   */
  async registrarManutencao(veiculoId: string, dto: RegistrarManutencaoDto, user: JwtPayload, role?: string) {
    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: veiculoId } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado.');
    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    // Gestor administra a frota da empresa toda (mantém veículo de qualquer filial,
    // igual ao editar-veículo, que já é cross-filial). Supervisor: só o da sua filial.
    if (!ehGestor && veiculo.filialId !== user.filialId) throw new ForbiddenException('Veículo de outra filial.');
    if (!ehGestor && veiculo.supervisorId !== user.sub) {
      throw new ForbiddenException('Apenas gestor de frota ou o supervisor do veículo podem registrar manutenção.');
    }

    const km = dto.km ?? veiculo.kmAtual;
    if (km < 0) throw new BadRequestException('KM inválido.');
    const tipo = dto.tipo ?? TipoManutencao.PREVENTIVA;
    // Reinicia o ciclo preventivo? Default: sim p/ PREVENTIVA, não p/ CORRETIVA
    // (conserto pontual não conta como revisão) — mas o gestor pode forçar.
    const reiniciar = dto.reiniciarCiclo ?? tipo === TipoManutencao.PREVENTIVA;
    const intervalo = dto.intervaloKm ?? veiculo.intervaloManutencaoKm ?? null;
    const proxima = reiniciar && intervalo != null ? km + intervalo : null;
    const dataManutencao = dto.data ? new Date(dto.data) : new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.manutencaoVeiculo.create({
        data: {
          veiculoId,
          tipo,
          km,
          dataManutencao,
          motivo: dto.observacao?.trim() || null,
          custo: dto.custo != null ? new Prisma.Decimal(dto.custo) : null,
          reiniciouCiclo: reiniciar,
          kmProximaGerada: reiniciar ? proxima : null,
          registradoPorId: user.sub,
        },
      });
      // Só mexe no ciclo preventivo do veículo quando reinicia.
      if (reiniciar) {
        return tx.veiculo.update({
          where: { id: veiculoId },
          data: {
            kmUltimaManutencao: km,
            kmProximaManutencao: proxima,
            ...(dto.intervaloKm != null ? { intervaloManutencaoKm: dto.intervaloKm } : {}),
          },
        });
      }
      // Corretiva sem reiniciar: registra o histórico e não altera o ciclo.
      return tx.veiculo.findUnique({ where: { id: veiculoId } });
    });
  }

  /** Histórico de manutenções do veículo (mais recente primeiro). */
  async listarManutencoes(veiculoId: string, user: JwtPayload) {
    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { filialId: true } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado.');
    // Gestor vê o histórico de manutenção de qualquer filial (frota compartilhável).
    if (!this.ehGestorFrota(user) && veiculo.filialId !== user.filialId) throw new ForbiddenException('Veículo de outra filial.');
    return this.prisma.manutencaoVeiculo.findMany({ where: { veiculoId }, orderBy: { dataManutencao: 'desc' } });
  }

  private async fechar(id: string, veiculoId: string | null, kmFinal: number, obsChegada: string | null, extra?: { kmInicial?: number; observacoesSaida?: string; adiantamento?: number; porteiroRetornoMatricula?: string; porteiroRetornoNome?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const viagem = await tx.viagem.update({
        where: { id },
        data: {
          situacao: StatusViagem.CONCLUIDA,
          kmFinal,
          dataHoraChegada: new Date(),
          observacoesChegada: obsChegada,
          ...(extra?.kmInicial != null ? { kmInicial: extra.kmInicial } : {}),
          ...(extra?.observacoesSaida != null ? { observacoesSaida: extra.observacoesSaida } : {}),
          ...(extra?.adiantamento != null ? { adiantamento: new Prisma.Decimal(extra.adiantamento) } : {}),
          ...(extra?.porteiroRetornoMatricula != null ? { porteiroRetornoMatricula: extra.porteiroRetornoMatricula, porteiroRetornoNome: extra.porteiroRetornoNome ?? null } : {}),
        },
      });
      if (veiculoId) {
        await tx.veiculo.update({
          where: { id: veiculoId },
          data: { situacao: SituacaoVeiculo.DISPONIVEL, kmAtual: kmFinal },
        });
      }
      return viagem;
    });
  }

  /** Cancela uma saída registrada errada (EM_CURSO → CANCELADA) e libera o veículo.
   *  Gestor de frota cancela em qualquer filial; gestor de entrega só na própria.
   *  Bloqueia se houver despesas lançadas (remover antes). Motivo/quem em obs. */
  async cancelarSaida(id: string, dto: { motivo: string }, user: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Saída de frota não encontrada.');
    if (!this.ehGestorFrota(user) && v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('Só é possível cancelar uma saída em curso.');
    const motivo = (dto.motivo ?? '').trim();
    if (!motivo) throw new BadRequestException('Informe o motivo do cancelamento.');
    const nDespesas = await this.prisma.despesaVeiculo.count({ where: { viagemId: id } });
    if (nDespesas > 0) throw new BadRequestException(`Há ${nDespesas} despesa(s) nesta saída — remova-as antes de cancelar.`);
    // Nome de quem cancela (o JWT não traz nome) — p/ a trilha na observação.
    const uRows = await this.prisma.$queryRaw<{ nome: string }[]>(Prisma.sql`SELECT TRIM(nome) AS nome FROM "core"."usuarios" WHERE id = ${user.sub} LIMIT 1`);
    const quem = uRows[0]?.nome ?? user.sub;
    return this.prisma.$transaction(async (tx) => {
      const viagem = await tx.viagem.update({
        where: { id },
        data: {
          situacao: StatusViagem.CANCELADA,
          dataHoraChegada: new Date(),
          observacoesChegada: `❌ CANCELADA por ${quem}: ${motivo}`,
        },
      });
      if (v.veiculoId) {
        await tx.veiculo.update({ where: { id: v.veiculoId }, data: { situacao: SituacaoVeiculo.DISPONIVEL } });
      }
      return viagem;
    });
  }

  // ---- Linha do KM (hodômetro) — segmentos por viagem + lacunas "não apontadas" ----
  /**
   * Monta a "linha do KM" de UM veículo a partir das suas viagens (já filtradas
   * por mês, se for o caso): cada viagem (kmInicial→kmFinal) vira um segmento
   * rotulado e as lacunas de KM entre viagens (e até o KM atual, só no mês
   * corrente) viram "não apontadas" — prestação de contas do odômetro.
   */
  private montarLinhaKm(
    veiculo: { id: string; placa: string; modelo: string | null; kmAtual: number },
    viagens: Array<{ numero: number; kmInicial: number | null; kmFinal: number | null; observacoesSaida: string | null; dataHoraSaida: Date | null; dataHoraChegada: Date | null; condutorNome: string | null }>,
    incluirAteKmAtual: boolean,
  ) {
    type Seg = { tipo: 'viagem' | 'gap'; kmInicio: number; kmFim: number; km: number; label: string; viagemNumero?: number; data?: string | null; dataChegada?: string | null; condutor?: string | null };
    const segViagens: Seg[] = viagens
      .filter((v) => v.kmInicial != null && v.kmFinal != null && v.kmFinal > v.kmInicial)
      .map((v) => ({
        tipo: 'viagem' as const, kmInicio: v.kmInicial!, kmFim: v.kmFinal!, km: v.kmFinal! - v.kmInicial!,
        label: v.observacoesSaida?.trim() || `Rota #${v.numero}`,
        viagemNumero: v.numero, data: v.dataHoraSaida?.toISOString() ?? null,
        dataChegada: v.dataHoraChegada?.toISOString() ?? null, condutor: v.condutorNome,
      }))
      .sort((a, b) => a.kmInicio - b.kmInicio);

    const segmentos: Seg[] = [];
    let cursor: number | null = null;
    for (const s of segViagens) {
      if (cursor != null && s.kmInicio > cursor) {
        segmentos.push({ tipo: 'gap', kmInicio: cursor, kmFim: s.kmInicio, km: s.kmInicio - cursor, label: 'Não apontadas' });
      }
      segmentos.push(s);
      cursor = Math.max(cursor ?? s.kmFim, s.kmFim);
    }
    // Lacuna final (do último kmFinal até o KM atual) só faz sentido no mês corrente.
    if (incluirAteKmAtual && cursor != null && veiculo.kmAtual > cursor) {
      segmentos.push({ tipo: 'gap', kmInicio: cursor, kmFim: veiculo.kmAtual, km: veiculo.kmAtual - cursor, label: 'Não apontadas (até o KM atual)' });
      cursor = veiculo.kmAtual;
    }

    const kmMin = segmentos.length ? segmentos[0].kmInicio : 0;
    const kmMax = segmentos.length ? cursor! : veiculo.kmAtual;
    const kmViagens = segmentos.filter((s) => s.tipo === 'viagem').reduce((a, s) => a + s.km, 0);
    const kmNaoApontadas = segmentos.filter((s) => s.tipo === 'gap').reduce((a, s) => a + s.km, 0);
    const qtdViagens = segViagens.length;

    return { veiculoId: veiculo.id, placa: veiculo.placa, modelo: veiculo.modelo, kmAtual: veiculo.kmAtual, kmMin, kmMax, kmViagens, kmNaoApontadas, qtdViagens, segmentos };
  }

  /**
   * Linha do KM da FROTA no mês: uma linha por veículo da filial (ou de um
   * veículo específico). Page dedicada `/frota/linha-km`. Leitura (escopo de
   * filial). Sem mês → considera todas as viagens e inclui a lacuna até o KM
   * atual; com mês passado, recorta no mês e não projeta até o KM atual.
   */
  async hodometroFrota(user: JwtPayload, mes?: number, ano?: number, veiculoId?: string, departamentoId?: string) {
    // Gestor de frota/ADMIN veem a Linha do KM da frota toda (cross-filial).
    const ehGestor = this.ehGestorFrota(user);
    if (!ehGestor && !user.filialId) throw new BadRequestException('Usuário sem filial definida.');
    const filialId = ehGestor ? undefined : user.filialId;
    // Supervisor de Departamento: recorta a Linha do KM aos veículos do(s) seu(s)
    // departamento(s). Gestor/ADMIN veem a frota toda.
    const deptoScope = this.ehSupervisorFrota(user)
      ? { departamentoLotacaoId: { in: await this.deptosSupervisionados(user) } }
      : {};

    const veiculos = await this.prisma.veiculo.findMany({
      where: {
        filialId,
        ...deptoScope,
        ...(veiculoId ? { id: veiculoId } : {}),
        ...(departamentoId ? { departamentoLotacaoId: departamentoId } : {}),
      },
      select: { id: true, placa: true, modelo: true, kmAtual: true, departamentoLotacaoId: true },
      orderBy: { placa: 'asc' },
    });
    const nomesDepto = await this.core.nomesDepartamentos(veiculos.map((v) => v.departamentoLotacaoId));

    const agora = new Date();
    const semMes = !mes || !ano;
    const mesCorrente = semMes || (mes === agora.getMonth() + 1 && ano === agora.getFullYear());

    const linhas = [];
    for (const v of veiculos) {
      const where: Prisma.ViagemWhereInput = { veiculoId: v.id, filialId, kmInicial: { not: null }, kmFinal: { not: null } };
      if (mes && ano) where.dataHoraSaida = { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) };
      const viagens = await this.prisma.viagem.findMany({
        where,
        select: { numero: true, kmInicial: true, kmFinal: true, observacoesSaida: true, dataHoraSaida: true, dataHoraChegada: true, condutorNome: true },
        orderBy: { kmInicial: 'asc' },
      });
      linhas.push({
        ...this.montarLinhaKm(v, viagens, mesCorrente),
        departamentoLotacaoId: v.departamentoLotacaoId,
        departamentoNome: nomesDepto.get(v.departamentoLotacaoId) ?? null,
      });
    }
    return { mes: mes ?? null, ano: ano ?? null, veiculos: linhas };
  }

  // ---- Painel tempo real da frota (monitoramento com recorte interno) ----
  async painelFrota(user: JwtPayload, role: string | undefined, mes: number, ano: number) {
    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    if (!ehGestor && !user.filialId) throw new BadRequestException('Usuário sem filial definida.');
    // Gestor de frota/ADMIN monitoram a frota da empresa toda (cross-filial):
    // filialId undefined = sem filtro de filial nas queries abaixo. Demais: a sua.
    const filialId = ehGestor ? undefined : user.filialId;
    const ini = new Date(Date.UTC(ano, mes - 1, 1));
    const fimExcl = new Date(Date.UTC(ano, mes, 1));

    // Despesas pendentes: gestor vê a filial; supervisor (do veículo ou de
    // departamento) só os veículos do seu escopo.
    const veicSupervisor = ehGestor ? null : await this.veiculoIdsNoEscopo(user);
    const despesaScope = veicSupervisor ? { veiculoId: { in: veicSupervisor } } : {};
    // Supervisor de Departamento: contadores, "na rua agora" e rankings do Monitor
    // também são recortados ao escopo (senão vazavam a filial inteira — placas, KM e
    // condutor de outros departamentos). Gestor de Frota/ADMIN veem a filial toda.
    const veicIdScope = veicSupervisor ? { id: { in: veicSupervisor } } : {};
    const viagemVeicScope = veicSupervisor ? { veiculoId: { in: veicSupervisor } } : {};

    const [
      veicDisponiveis, veicEmUso, veicManutencao, veicBaixados,
      emCurso, manutencaoLista, preventivaLista, despesasPendentes,
      concluidasMes, despesasMes, viagensMes,
    ] = await Promise.all([
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.DISPONIVEL, ...veicIdScope } }),
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.EM_USO, ...veicIdScope } }),
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.EM_MANUTENCAO, ...veicIdScope } }),
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.BAIXADO, ...veicIdScope } }),
      // "Na rua agora": TODAS as viagens em curso (ENTREGA + FROTA) — alinha com o
      // mapa ao vivo (que mostra os dois tipos). O nome do condutor de ENTREGA
      // vem do motoristaId (core), resolvido logo abaixo.
      this.prisma.viagem.findMany({
        where: { filialId, situacao: StatusViagem.EM_CURSO, ...viagemVeicScope },
        select: {
          id: true, numero: true, tipo: true, condutorNome: true, motoristaId: true,
          dataHoraSaida: true, observacoesSaida: true, kmInicial: true,
          veiculo: { select: { placa: true, modelo: true } },
          _count: { select: { paradas: true } },
        },
        orderBy: { dataHoraSaida: 'asc' },
      }),
      this.prisma.veiculo.findMany({
        where: { filialId, ativo: true, situacao: SituacaoVeiculo.EM_MANUTENCAO, ...veicIdScope },
        select: { placa: true, modelo: true },
      }),
      // Manutenção preventiva: veículos com próxima revisão definida cujo odômetro
      // já chegou perto (LIMIAR) ou passou do alvo.
      this.prisma.veiculo.findMany({
        where: { filialId, ativo: true, kmProximaManutencao: { not: null }, ...veicIdScope },
        select: { id: true, placa: true, modelo: true, kmAtual: true, kmProximaManutencao: true },
      }),
      this.prisma.despesaVeiculo.count({ where: { filialId, situacao: StatusDespesa.PENDENTE, ...despesaScope } }),
      // Concluídas no mês (km rodado) — janela pela chegada.
      this.prisma.viagem.findMany({
        where: { filialId, tipo: TipoViagem.FROTA, situacao: StatusViagem.CONCLUIDA, dataHoraChegada: { gte: ini, lt: fimExcl }, ...viagemVeicScope },
        select: { kmInicial: true, kmFinal: true, veiculoId: true, veiculo: { select: { placa: true } } },
      }),
      this.prisma.despesaVeiculo.findMany({
        // ...despesaScope: custo do mês respeita o mesmo escopo das pendentes (linha
        // acima) — Gestor de Frota/ADMIN veem a filial; demais só veículos que
        // supervisionam. Sem isso, o custo total vazava a filial inteira no Monitor.
        where: { filialId, situacao: StatusDespesa.APROVADA, dataDespesa: { gte: ini, lt: fimExcl }, ...despesaScope },
        select: { valor: true },
      }),
      // Viagens de frota do mês p/ ranking por departamento solicitante (pela saída).
      this.prisma.viagem.findMany({
        where: { filialId, tipo: TipoViagem.FROTA, dataHoraSaida: { gte: ini, lt: fimExcl }, ...viagemVeicScope },
        select: { departamentoSolicitanteId: true },
      }),
    ]);

    // Nome do condutor das viagens de ENTREGA em curso (motoristaId → core).
    const nomesCondutor = await this.core.nomesUsuarios(
      emCurso.map((v) => v.motoristaId).filter((x): x is string => !!x),
    );

    const kmRodadoMes = concluidasMes.reduce((s, v) => s + ((v.kmFinal ?? 0) - (v.kmInicial ?? 0)), 0);
    const custoTotalMes = despesasMes.reduce((s, d) => s + Number(d.valor), 0);

    // Ranking de uso por veículo (km rodado no mês).
    const kmPorVeiculo = new Map<string, number>();
    for (const v of concluidasMes) {
      const placa = v.veiculo?.placa ?? '—';
      kmPorVeiculo.set(placa, (kmPorVeiculo.get(placa) ?? 0) + ((v.kmFinal ?? 0) - (v.kmInicial ?? 0)));
    }
    const rankingVeiculo = [...kmPorVeiculo.entries()]
      .map(([placa, km]) => ({ placa, km })).sort((a, b) => b.km - a.km).slice(0, 5);

    // Ranking por departamento solicitante (nº de viagens) — resolve nome via core.
    const porDepto = new Map<string, number>();
    for (const v of viagensMes) {
      if (!v.departamentoSolicitanteId) continue;
      porDepto.set(v.departamentoSolicitanteId, (porDepto.get(v.departamentoSolicitanteId) ?? 0) + 1);
    }
    const nomesDepto = await this.core.nomesDepartamentos([...porDepto.keys()]);
    const rankingDepartamento = [...porDepto.entries()]
      .map(([id, viagens]) => ({ departamento: nomesDepto.get(id) ?? id.slice(0, 8), viagens }))
      .sort((a, b) => b.viagens - a.viagens).slice(0, 5);

    return {
      veiculos: {
        disponivel: veicDisponiveis, emUso: veicEmUso, manutencao: veicManutencao, baixado: veicBaixados,
        total: veicDisponiveis + veicEmUso + veicManutencao + veicBaixados,
      },
      emCurso: emCurso.map((v) => ({
        id: v.id, numero: v.numero, tipo: v.tipo,
        placa: v.veiculo?.placa ?? '—', modelo: v.veiculo?.modelo ?? null,
        condutorNome: v.condutorNome ?? (v.motoristaId ? nomesCondutor.get(v.motoristaId) ?? null : null),
        dataHoraSaida: v.dataHoraSaida, finalidade: v.observacoesSaida,
        kmInicial: v.kmInicial, paradas: v._count.paradas,
      })),
      alertas: {
        veiculosManutencao: manutencaoLista.map((v) => v.placa + (v.modelo ? ` (${v.modelo})` : '')),
        manutencaoPreventiva: preventivaLista
          .map((v) => ({
            id: v.id, placa: v.placa, modelo: v.modelo,
            kmAtual: v.kmAtual, kmProxima: v.kmProximaManutencao!,
            faltam: v.kmProximaManutencao! - v.kmAtual,
            vencida: v.kmAtual >= v.kmProximaManutencao!,
          }))
          .filter((v) => v.faltam <= LIMIAR_AVISO_MANUTENCAO_KM)
          .sort((a, b) => a.faltam - b.faltam),
        despesasPendentes,
      },
      indicadores: {
        custoTotalMes, kmRodadoMes,
        custoPorKm: kmRodadoMes > 0 ? custoTotalMes / kmRodadoMes : null,
        rankingVeiculo, rankingDepartamento,
      },
    };
  }

  // ---- Paradas (pontos de rota / "caderno" da viagem de frota) ----

  /** Garante que a viagem existe, é de frota e da filial do usuário. */
  private async viagemDaFilial(id: string, user: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: { veiculo: { select: { supervisorId: true, departamentoLotacaoId: true } } },
    });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    return v;
  }

  // Próxima sequência da rota.
  private async proximaSequencia(viagemId: string): Promise<number> {
    const ultima = await this.prisma.parada.findFirst({
      where: { viagemId }, orderBy: { sequencia: 'desc' }, select: { sequencia: true },
    });
    return (ultima?.sequencia ?? 0) + 1;
  }

  /** Lista as paradas da viagem (ordem da rota) — com status/planejamento/GPS. */
  async listarParadas(id: string, user: JwtPayload) {
    await this.assertViagemVisivel(await this.viagemDaFilial(id, user), user);
    const paradas = await this.prisma.parada.findMany({
      where: { viagemId: id },
      orderBy: { sequencia: 'asc' },
      select: {
        id: true, sequencia: true, status: true, local: true, planejadoLocal: true,
        km: true, dataHora: true, realizadaEm: true, observacao: true, latitude: true, longitude: true,
      },
    });
    return paradas.map((p) => ({
      ...p,
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
    }));
  }

  /** Adiciona uma parada REALIZADA (ad-hoc) ao log da viagem (não em cancelada). */
  async adicionarParada(id: string, dto: AddParadaDto, user: JwtPayload, condutorToken?: string) {
    const v = await this.viagemDaFilial(id, user);
    this.condutorToken.assertOpera(user, v, condutorToken);
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A rota não está em curso — não é possível alterar paradas.');
    // Idempotência (fila offline): se já chegou com essa chave, devolve a existente.
    if (dto.idempotencyKey) {
      const ja = await this.prisma.parada.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (ja) return ja;
    }
    return this.prisma.parada.create({
      data: {
        viagemId: id,
        sequencia: await this.proximaSequencia(id),
        status: StatusParada.REALIZADA,
        local: dto.local,
        km: dto.km ?? null,
        observacao: dto.observacao ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        dataHora: new Date(),
        realizadaEm: new Date(),
        idempotencyKey: dto.idempotencyKey ?? null,
      },
      select: { id: true, sequencia: true, status: true, local: true, km: true, dataHora: true, observacao: true },
    });
  }

  /** Planeja N paradas (status PLANEJADA) — visitas que o condutor pretende fazer. */
  async planejarParadas(id: string, dto: PlanejarParadasDto, user: JwtPayload, condutorToken?: string) {
    const v = await this.viagemDaFilial(id, user);
    this.condutorToken.assertOpera(user, v, condutorToken);
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A rota não está em curso — não é possível alterar paradas.');
    const locais = dto.locais.map((l) => l.trim()).filter(Boolean);
    if (locais.length === 0) throw new BadRequestException('Informe ao menos um local.');
    let seq = await this.proximaSequencia(id);
    await this.prisma.parada.createMany({
      data: locais.map((local) => ({
        viagemId: id, sequencia: seq++, status: StatusParada.PLANEJADA, planejadoLocal: local, local,
      })),
    });
    return this.listarParadas(id, user);
  }

  /** Check-in numa parada planejada → REALIZADA (KM + GPS opcional + obs). */
  async checkinParada(id: string, paradaId: string, dto: CheckinParadaDto, user: JwtPayload, condutorToken?: string) {
    const v = await this.viagemDaFilial(id, user);
    this.condutorToken.assertOpera(user, v, condutorToken);
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A rota não está em curso — não é possível alterar paradas.');
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== id) throw new NotFoundException('Parada não encontrada nesta viagem.');
    return this.prisma.parada.update({
      where: { id: paradaId },
      data: {
        status: StatusParada.REALIZADA,
        local: dto.local?.trim() || p.local || p.planejadoLocal,
        km: dto.km ?? p.km,
        observacao: dto.observacao?.trim() || p.observacao,
        latitude: dto.latitude ?? p.latitude,
        longitude: dto.longitude ?? p.longitude,
        dataHora: new Date(),
        realizadaEm: new Date(),
      },
      select: { id: true, sequencia: true, status: true, local: true, km: true, realizadaEm: true },
    });
  }

  /** Marca uma parada planejada como PULADA (visita não realizada). */
  async pularParada(id: string, paradaId: string, user: JwtPayload, condutorToken?: string) {
    const v = await this.viagemDaFilial(id, user);
    this.condutorToken.assertOpera(user, v, condutorToken);
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A rota não está em curso — não é possível alterar paradas.');
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== id) throw new NotFoundException('Parada não encontrada nesta viagem.');
    return this.prisma.parada.update({
      where: { id: paradaId }, data: { status: StatusParada.PULADA },
      select: { id: true, status: true },
    });
  }

  /** Remove uma parada do log da viagem. */
  async removerParada(id: string, paradaId: string, user: JwtPayload, condutorToken?: string) {
    const v = await this.viagemDaFilial(id, user);
    this.condutorToken.assertOpera(user, v, condutorToken);
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A rota não está em curso — não é possível alterar paradas.');
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== id) throw new NotFoundException('Parada não encontrada nesta viagem.');
    await this.prisma.parada.delete({ where: { id: paradaId } });
    return { ok: true };
  }

  // ---- Cadastro de locais/pontos de parada (pick-list do planejamento) ----
  /**
   * Lista locais. Sem `scope` → cadastro (todos, com os campos de escopo).
   * Com `scope` (saída) → só os RELEVANTES: da filial (ou globais) E do veículo
   * selecionado OU do depto solicitante OU globais (sem veículo nem depto).
   */
  listarLocais(opts: { somenteAtivos?: boolean; scope?: boolean; filialId?: string; veiculoId?: string; departamentoId?: string }) {
    const where: Prisma.LocalParadaWhereInput = {};
    if (opts.somenteAtivos) where.ativo = true;
    const and: Prisma.LocalParadaWhereInput[] = [];
    // Filial: da filial informada OU global (todas) — vale com ou sem scope.
    if (opts.filialId) and.push({ OR: [{ filialId: opts.filialId }, { filialId: null }] });
    // Scope da saída: veículo selecionado OU depto solicitante OU global.
    if (opts.scope) {
      and.push({
        OR: [
          ...(opts.veiculoId ? [{ veiculoId: opts.veiculoId }] : []),
          ...(opts.departamentoId ? [{ departamentoId: opts.departamentoId }] : []),
          { veiculoId: null, departamentoId: null },
        ],
      });
    }
    if (and.length) where.AND = and;
    return this.prisma.localParada.findMany({ where, orderBy: { nome: 'asc' } });
  }

  async criarLocal(dto: CriarLocalParadaDto) {
    const nome = dto.nome.trim();
    // Dedup no MESMO escopo (mesmo nome pode existir em filiais/escopos distintos).
    const existe = await this.prisma.localParada.findFirst({
      where: { nome, filialId: dto.filialId || null, departamentoId: dto.departamentoId || null, veiculoId: dto.veiculoId || null },
    });
    if (existe) throw new BadRequestException('Já existe um local com esse nome neste escopo.');
    return this.prisma.localParada.create({
      data: {
        nome,
        filialId: dto.filialId || null,
        departamentoId: dto.departamentoId || null,
        veiculoId: dto.veiculoId || null,
      },
    });
  }

  async atualizarLocal(id: string, dto: AtualizarLocalParadaDto) {
    const l = await this.prisma.localParada.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Local não encontrado.');
    return this.prisma.localParada.update({
      where: { id },
      data: {
        nome: dto.nome?.trim() ?? undefined,
        ativo: dto.ativo ?? undefined,
        // string vazia limpa o escopo (vira global/todas); undefined não toca.
        filialId: dto.filialId !== undefined ? (dto.filialId || null) : undefined,
        departamentoId: dto.departamentoId !== undefined ? (dto.departamentoId || null) : undefined,
        veiculoId: dto.veiculoId !== undefined ? (dto.veiculoId || null) : undefined,
      },
    });
  }

  /** Lista as viagens de FROTA da filial (com nome do veículo). */
  /** Gestor de Frota / ADMIN veem TODA a frota da filial (mesma governança do ajuste). */
  private roleDe(user: JwtPayload): string | undefined {
    return user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;
  }
  private ehGestorFrota(user: JwtPayload): boolean {
    const role = this.roleDe(user);
    return role === 'GESTOR_FROTA' || role === 'ADMIN';
  }
  /** Supervisor de Departamento: age nos veículos do(s) seu(s) departamento(s). */
  private ehSupervisorFrota(user: JwtPayload): boolean {
    return this.roleDe(user) === 'SUPERVISOR_FROTA';
  }
  /** Departamentos (de lotação) que o usuário supervisiona = onde é encarregado
   *  (veiculo.supervisorId) de ≥ 1 veículo na sua filial. Base do escopo "por
   *  departamento" do Supervisor de Departamento. Vazio → não cobre nada. */
  private async deptosSupervisionados(user: JwtPayload): Promise<string[]> {
    const rows = await this.prisma.veiculo.findMany({
      where: { filialId: user.filialId ?? undefined, supervisorId: user.sub },
      select: { departamentoLotacaoId: true },
      distinct: ['departamentoLotacaoId'],
    });
    return rows.map((r) => r.departamentoLotacaoId);
  }
  /** Escopo de leitura de viagens de frota para um NÃO-gestor. Supervisor de
   *  Departamento: viagens dos veículos dos seus departamentos (+ as que registrou).
   *  Demais: só as suas (registrou OU é supervisor do veículo). */
  private async escopoViagemNaoGestor(user: JwtPayload): Promise<Prisma.ViagemWhereInput> {
    if (this.ehSupervisorFrota(user)) {
      const deps = await this.deptosSupervisionados(user);
      return { OR: [{ criadoPorId: user.sub }, { veiculo: { departamentoLotacaoId: { in: deps } } }] };
    }
    return { OR: [{ criadoPorId: user.sub }, { veiculo: { supervisorId: user.sub } }] };
  }
  /** Ids de veículos no escopo do usuário (despesa/custo). Supervisor de
   *  Departamento: veículos dos seus departamentos. Demais: os que supervisiona. */
  private async veiculoIdsNoEscopo(user: JwtPayload): Promise<string[]> {
    if (this.ehSupervisorFrota(user)) {
      const deps = await this.deptosSupervisionados(user);
      const vs = await this.prisma.veiculo.findMany({ where: { filialId: user.filialId ?? undefined, departamentoLotacaoId: { in: deps } }, select: { id: true } });
      return vs.map((v) => v.id);
    }
    const vs = await this.prisma.veiculo.findMany({ where: { filialId: user.filialId ?? undefined, supervisorId: user.sub }, select: { id: true } });
    return vs.map((v) => v.id);
  }
  /** Pode AGIR (ajuste/acerto) na viagem: quem registrou a saída; o supervisor do
   *  veículo; ou o Supervisor de Departamento, se o veículo é de um depto seu. */
  private async donoOuEscopo(v: { criadoPorId: string; veiculo: { supervisorId: string | null; departamentoLotacaoId?: string | null } | null }, user: JwtPayload): Promise<boolean> {
    if (v.criadoPorId === user.sub) return true;
    if (this.ehSupervisorFrota(user)) {
      const dep = v.veiculo?.departamentoLotacaoId;
      return dep != null && (await this.deptosSupervisionados(user)).includes(dep);
    }
    return v.veiculo?.supervisorId === user.sub;
  }
  /** Visibilidade de UMA viagem (leitura): gestor de frota/ADMIN veem todas; os demais
   *  só as SUAS — quem registrou a saída (criadoPorId) ou é supervisor do veículo; o
   *  Supervisor de Departamento vê as dos veículos do(s) seu(s) departamento(s).
   *  404 (não "403") para não vazar a existência de viagem de outro. */
  private async assertViagemVisivel(v: { criadoPorId: string; veiculo: { supervisorId: string | null; departamentoLotacaoId?: string | null } | null }, user: JwtPayload) {
    // Gestor de frota vê tudo; PORTARIA vê qualquer viagem da sua filial (é o portão
    // — precisa abrir/encerrar a rota de qualquer veículo). O escopo de filial já é
    // aplicado antes (viagemDaFilial/obterViagem). Demais perfis: só as próprias.
    const role = this.roleDe(user);
    if (this.ehGestorFrota(user) || role === 'PORTARIA') return;
    if (this.ehSupervisorFrota(user)) {
      const deps = await this.deptosSupervisionados(user);
      const dep = v.veiculo?.departamentoLotacaoId;
      const ok = v.criadoPorId === user.sub || (dep != null && deps.includes(dep));
      if (!ok) throw new NotFoundException('Viagem de frota não encontrada.');
      return;
    }
    const ehMinha = v.criadoPorId === user.sub || v.veiculo?.supervisorId === user.sub;
    if (!ehMinha) throw new NotFoundException('Viagem de frota não encontrada.');
  }

  async listar(user: JwtPayload, situacao?: StatusViagem) {
    // Escopo: Gestor de Frota / ADMIN veem TODAS as viagens da filial; os demais
    // (operador, registrador, gestor de entregas) só veem as SUAS — quem registrou
    // a saída (criadoPorId) ou é supervisor de área do veículo (mesmo dono do ajuste).
    const ehGestor = this.ehGestorFrota(user);
    const escopo = ehGestor ? {} : await this.escopoViagemNaoGestor(user);
    // Supervisor de Departamento: "minha operação" abrange os veículos do(s) seu(s)
    // departamento(s) — deps computados uma vez p/ o flag ehMinha da lista.
    const depsSup = this.ehSupervisorFrota(user) ? await this.deptosSupervisionados(user) : [];
    const viagens = await this.prisma.viagem.findMany({
      where: {
        tipo: TipoViagem.FROTA, filialId: ehGestor ? undefined : user.filialId!, ...(situacao ? { situacao } : {}),
        ...escopo,
      },
      include: { veiculo: { select: { placa: true, modelo: true, supervisorId: true, departamentoLotacaoId: true } }, _count: { select: { paradas: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    return viagens.map((v) => ({
      id: v.id, numero: v.numero, situacao: v.situacao,
      placa: v.veiculo?.placa ?? '—', modelo: v.veiculo?.modelo ?? null,
      condutorNome: v.condutorNome, condutorMatricula: v.condutorMatricula,
      kmInicial: v.kmInicial, kmFinal: v.kmFinal,
      kmRodado: v.kmFinal != null && v.kmInicial != null ? v.kmFinal - v.kmInicial : null,
      finalidade: v.observacoesSaida, localSaida: v.localSaida,
      dataHoraSaida: v.dataHoraSaida, dataHoraChegada: v.dataHoraChegada,
      paradas: v._count.paradas,
      // "Minha operação": quem registrou a saída, o supervisor do veículo, ou o
      // Supervisor de Departamento (veículo de um depto seu).
      ehMinha: v.criadoPorId === user.sub || v.veiculo?.supervisorId === user.sub
        || (v.veiculo?.departamentoLotacaoId != null && depsSup.includes(v.veiculo.departamentoLotacaoId)),
    }));
  }

  /** Despesas lançadas numa viagem de frota (lista da tela de detalhe). */
  /** ACERTO da viagem de frota: info + despesas + adiantamento + saldo (a pagar/receber).
   *  Espelha a RDV, mas para UMA viagem. Escopado (assertViagemVisivel). */
  async acertoViagem(id: string, user: JwtPayload) {
    const v = await this.prisma.viagem.findFirst({
      where: { id, tipo: TipoViagem.FROTA, filialId: this.ehGestorFrota(user) ? undefined : user.filialId! },
      include: {
        veiculo: { select: { placa: true, modelo: true, supervisorId: true, departamentoLotacaoId: true } },
        despesas: {
          include: { tipoDespesa: { select: { nome: true, categoria: true } }, fornecedorRef: { select: { nome: true } } },
          orderBy: { dataDespesa: 'asc' },
        },
      },
    });
    if (!v) throw new NotFoundException('Viagem de frota não encontrada.');
    await this.assertViagemVisivel(v, user);

    const despesas = v.despesas.map((d) => ({
      id: d.id, data: d.dataDespesa, tipo: d.tipoDespesa?.nome ?? '—',
      categoria: d.tipoDespesa?.categoria ?? 'VEICULO', valor: Number(d.valor),
      situacao: d.situacao, fornecedor: d.fornecedorRef?.nome ?? d.fornecedor ?? null,
      temComprovante: !!d.comprovanteObjectKey,
    }));
    // Só despesas APROVADAS entram no saldo (mesma regra da RDV); as demais aparecem
    // na lista com o status, mas não somam.
    const totalDespesas = despesas.filter((d) => d.situacao === 'APROVADA').reduce((s, d) => s + d.valor, 0);
    const adiantamento = v.adiantamento != null ? Number(v.adiantamento) : 0;
    // saldo > 0 = sobra do adiantamento (a devolver à empresa); < 0 = a pagar ao condutor.
    const saldo = adiantamento - totalDespesas;

    return {
      viagem: {
        id: v.id, numero: v.numero, situacao: v.situacao,
        placa: v.veiculo?.placa ?? '—', modelo: v.veiculo?.modelo ?? null,
        condutorNome: v.condutorNome, condutorMatricula: v.condutorMatricula,
        finalidade: v.observacoesSaida, localSaida: v.localSaida,
        dataHoraSaida: v.dataHoraSaida, dataHoraChegada: v.dataHoraChegada,
        kmInicial: v.kmInicial, kmFinal: v.kmFinal,
        kmRodado: v.kmFinal != null && v.kmInicial != null ? v.kmFinal - v.kmInicial : null,
      },
      despesas, totalDespesas, adiantamento, saldo,
    };
  }

  async despesasDaViagem(viagemId: string, user: JwtPayload) {
    const v = await this.prisma.viagem.findFirst({
      where: { id: viagemId, filialId: this.ehGestorFrota(user) ? undefined : user.filialId! },
      select: { id: true, criadoPorId: true, veiculo: { select: { supervisorId: true, departamentoLotacaoId: true } } },
    });
    if (!v) throw new NotFoundException('Viagem de frota não encontrada.');
    await this.assertViagemVisivel(v, user);
    const despesas = await this.prisma.despesaVeiculo.findMany({
      where: { viagemId },
      include: { tipoDespesa: { select: { nome: true } }, fornecedorRef: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    return despesas.map((d) => ({
      id: d.id,
      tipo: d.tipoDespesa?.nome ?? '—',
      valor: Number(d.valor),
      fornecedor: d.fornecedorRef?.nome ?? d.fornecedor ?? null,
      situacao: d.situacao,
      dataDespesa: d.dataDespesa,
    }));
  }

  /** Uma viagem de FROTA por id (detalhe — mesma forma do listar). */
  async obterViagem(id: string, user: JwtPayload) {
    const v = await this.prisma.viagem.findFirst({
      where: { id, tipo: TipoViagem.FROTA, filialId: this.ehGestorFrota(user) ? undefined : user.filialId! },
      include: { veiculo: { select: { placa: true, modelo: true, supervisorId: true, departamentoLotacaoId: true } }, _count: { select: { paradas: true } } },
    });
    if (!v) throw new NotFoundException('Viagem de frota não encontrada.');
    await this.assertViagemVisivel(v, user);
    return {
      id: v.id, numero: v.numero, situacao: v.situacao,
      placa: v.veiculo?.placa ?? '—', modelo: v.veiculo?.modelo ?? null,
      condutorNome: v.condutorNome, condutorMatricula: v.condutorMatricula,
      kmInicial: v.kmInicial, kmFinal: v.kmFinal,
      kmRodado: v.kmFinal != null && v.kmInicial != null ? v.kmFinal - v.kmInicial : null,
      finalidade: v.observacoesSaida, localSaida: v.localSaida,
      dataHoraSaida: v.dataHoraSaida, dataHoraChegada: v.dataHoraChegada,
      paradas: v._count.paradas,
      adiantamento: v.adiantamento != null ? Number(v.adiantamento) : null,
      acertoEncerradoEm: v.acertoEncerradoEm,
      // "Minha operação": quem registrou a saída, o supervisor do veículo, ou o
      // Supervisor de Departamento (viagem de um veículo do seu departamento).
      ehMinha: await this.donoOuEscopo(v, user),
    };
  }
}
