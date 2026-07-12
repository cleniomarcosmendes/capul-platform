import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SituacaoVeiculo, StatusViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { assertPodeVerRegistro } from '../common/filial-scope.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { CreateVeiculoDto, UpdateVeiculoDto } from './dto.js';

@Injectable()
export class VeiculoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
  ) {}

  /** Anexa os nomes do core (filial/depto/supervisor) a cada veículo. */
  private async enriquecer<T extends { filialId: string; departamentoLotacaoId: string; supervisorId: string }>(veiculos: T[]) {
    const [filiais, deptos, usuarios] = await Promise.all([
      this.core.nomesFiliais(veiculos.map((v) => v.filialId)),
      this.core.nomesDepartamentos(veiculos.map((v) => v.departamentoLotacaoId)),
      this.core.nomesUsuarios(veiculos.map((v) => v.supervisorId)),
    ]);
    return veiculos.map((v) => ({
      ...v,
      filialNome: filiais.get(v.filialId) ?? null,
      departamentoNome: deptos.get(v.departamentoLotacaoId) ?? null,
      supervisorNome: usuarios.get(v.supervisorId) ?? null,
    }));
  }

  /**
   * Cria o veículo + registra o supervisor inicial no histórico (entidade
   * separada — exigência Fase 2: preservar mudanças de supervisor).
   */
  async create(dto: CreateVeiculoDto, criadoPorId: string) {
    // Valida os FKs do core antes de gravar (evita ID órfão).
    await Promise.all([
      this.core.validarFilial(dto.filialId),
      this.core.validarDepartamento(dto.departamentoLotacaoId),
      this.core.validarUsuario(dto.supervisorId, 'Supervisor'),
    ]);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const v = await tx.veiculo.create({
          data: {
            filialId: dto.filialId,
            placa: dto.placa.trim().toUpperCase(),
            renavam: dto.renavam?.trim() || null,
            chassi: dto.chassi?.trim().toUpperCase() || null,
            modelo: dto.modelo?.trim() || null,
            marca: dto.marca?.trim() || null,
            ano: dto.ano ?? null,
            cor: dto.cor?.trim() || null,
            tipo: dto.tipo ?? 'CARRO',
            propriedade: dto.propriedade ?? 'PROPRIO',
            porte: dto.porte ?? null,
            finalidade: dto.finalidade ?? null,
            kmAtual: dto.kmAtual ?? 0,
            capacidadeCarga: dto.capacidadeCarga?.trim() || null,
            situacao: dto.situacao ?? 'DISPONIVEL',
            intervaloManutencaoKm: dto.intervaloManutencaoKm ?? null,
            // Auto-agenda a 1ª revisão a partir do intervalo (km atual + intervalo).
            // Sem manutenção registrada ainda → base = km atual do cadastro.
            kmProximaManutencao: dto.intervaloManutencaoKm
              ? (dto.kmAtual ?? 0) + dto.intervaloManutencaoKm
              : null,
            departamentoLotacaoId: dto.departamentoLotacaoId,
            supervisorId: dto.supervisorId,
            supervisorAreaMatricula: dto.supervisorAreaMatricula?.trim().toUpperCase() || null,
            supervisorAreaNome: dto.supervisorAreaNome?.trim() || null,
          },
        });
        await tx.veiculoSupervisorHistorico.create({
          data: {
            veiculoId: v.id,
            supervisorAnteriorId: null,
            supervisorNovoId: dto.supervisorId,
            alteradoPorId: criadoPorId,
          },
        });
        // Supervisor de área definido no cadastro → 1ª entrada do histórico.
        if (v.supervisorAreaMatricula) {
          await tx.veiculoSupervisorAreaHistorico.create({
            data: {
              veiculoId: v.id,
              matriculaAnterior: null,
              matriculaNova: v.supervisorAreaMatricula,
              nomeNovo: v.supervisorAreaNome,
              alteradoPorId: criadoPorId,
            },
          });
        }
        return v;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Já existe veículo com essa placa nesta filial.');
      }
      throw e;
    }
  }

  /** Departamentos que o usuário supervisiona (encarregado de ≥1 veículo na filial). */
  async deptosSupervisionados(user: JwtPayload): Promise<string[]> {
    const rows = await this.prisma.veiculo.findMany({
      where: { filialId: user.filialId ?? undefined, supervisorId: user.sub },
      select: { departamentoLotacaoId: true },
      distinct: ['departamentoLotacaoId'],
    });
    return rows.map((r) => r.departamentoLotacaoId);
  }

  async list(params: {
    filialId?: string;
    situacao?: SituacaoVeiculo;
    incluirInativos?: boolean;
    departamentoLotacaoId?: string;
    busca?: string;
    // Supervisor de Departamento: recorta aos veículos do(s) seu(s) departamento(s)
    // (na sua filial) — ignora todasFiliais (não é cross-filial como o Gestor).
    supervisorFrotaUser?: JwtPayload;
  }) {
    const termo = params.busca?.trim();
    let deptoWhere: Record<string, unknown> = {};
    let filialId = params.filialId;
    if (params.supervisorFrotaUser) {
      filialId = params.supervisorFrotaUser.filialId ?? undefined;
      const deps = await this.deptosSupervisionados(params.supervisorFrotaUser);
      // O filtro ?departamentoLotacaoId RESPEITA o escopo (interseção) — não pode
      // sobrepor a chave e vazar veículos de outro departamento na mesma filial.
      const escopo = params.departamentoLotacaoId
        ? (deps.includes(params.departamentoLotacaoId) ? [params.departamentoLotacaoId] : [])
        : deps;
      deptoWhere = { departamentoLotacaoId: { in: escopo } };
    } else if (params.departamentoLotacaoId) {
      deptoWhere = { departamentoLotacaoId: params.departamentoLotacaoId };
    }
    const veiculos = await this.prisma.veiculo.findMany({
      where: {
        ...(filialId ? { filialId } : {}),
        ...deptoWhere,
        ...(params.situacao ? { situacao: params.situacao } : {}),
        ...(params.incluirInativos ? {} : { ativo: true }),
        ...(termo
          ? {
              OR: [
                { placa: { contains: termo, mode: 'insensitive' } },
                { modelo: { contains: termo, mode: 'insensitive' } },
                { marca: { contains: termo, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { placa: 'asc' },
      take: 300,
    });
    return this.enriquecer(veiculos);
  }

  async findOne(id: string, user?: JwtPayload) {
    const v = await this.prisma.veiculo.findUnique({
      where: { id },
      include: { historicoSupervisor: { orderBy: { alteradoEm: 'desc' } } },
    });
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    if (user) {
      assertPodeVerRegistro(user, v.filialId);
      // Supervisor de Departamento: o detalhe respeita o MESMO escopo da lista (só
      // veículos do[s] seu[s] departamento[s]) — senão vazaria o cadastro por URL,
      // já que a filial é a mesma dos veículos de outros departamentos.
      const role = user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;
      if (role === 'SUPERVISOR_FROTA') {
        const deps = await this.deptosSupervisionados(user);
        if (!deps.includes(v.departamentoLotacaoId)) throw new NotFoundException('Veículo não encontrado.');
      }
    }
    // Nomes do veículo + nomes dos usuários citados no histórico de supervisor.
    const [enriquecido] = await this.enriquecer([v]);
    const usuariosHist = await this.core.nomesUsuarios(
      v.historicoSupervisor.flatMap((h) => [h.supervisorAnteriorId, h.supervisorNovoId, h.alteradoPorId].filter((x): x is string => !!x)),
    );
    return {
      ...enriquecido,
      historicoSupervisor: v.historicoSupervisor.map((h) => ({
        ...h,
        supervisorAnteriorNome: h.supervisorAnteriorId ? usuariosHist.get(h.supervisorAnteriorId) ?? null : null,
        supervisorNovoNome: usuariosHist.get(h.supervisorNovoId) ?? null,
        alteradoPorNome: usuariosHist.get(h.alteradoPorId) ?? null,
      })),
    };
  }

  async update(id: string, dto: UpdateVeiculoDto, alteradoPorId: string, userFilialId?: string) {
    const atual = await this.prisma.veiculo.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Veículo não encontrado.');
    if (userFilialId && atual.filialId !== userFilialId) throw new ForbiddenException('Veículo de outra filial.');

    // Troca de FILIAL (só gestor/admin — quem tem userFilialId=undefined via
    // podeVerOutrasFiliais). Bloqueada se houver viagem em curso; valida a filial
    // de destino e a colisão de placa. O histórico fica na filial de origem.
    const trocaFilial = !!dto.filialId && dto.filialId !== atual.filialId;
    if (trocaFilial) {
      if (userFilialId) throw new ForbiddenException('Apenas gestor de frota ou admin pode trocar a filial do veículo.');
      await this.core.validarFilial(dto.filialId!);
      const emCurso = await this.prisma.viagem.count({ where: { veiculoId: id, situacao: StatusViagem.EM_CURSO } });
      if (emCurso > 0) throw new BadRequestException('Não é possível trocar a filial: o veículo tem viagem em curso.');
      const placaAlvo = dto.placa?.trim().toUpperCase() ?? atual.placa;
      const colisao = await this.prisma.veiculo.findFirst({ where: { filialId: dto.filialId!, placa: placaAlvo, id: { not: id } } });
      if (colisao) throw new BadRequestException(`Já existe um veículo com a placa ${placaAlvo} na filial de destino.`);
    }

    // Valida FKs do core que vierem no update.
    await Promise.all([
      dto.departamentoLotacaoId ? this.core.validarDepartamento(dto.departamentoLotacaoId) : Promise.resolve(),
      dto.supervisorId ? this.core.validarUsuario(dto.supervisorId, 'Supervisor') : Promise.resolve(),
    ]);

    const trocaSupervisor = dto.supervisorId && dto.supervisorId !== atual.supervisorId;
    // Supervisor de área (matrícula): undefined = não mexe; '' = remover; senão troca.
    const novaMatriculaArea = dto.supervisorAreaMatricula === undefined
      ? undefined
      : dto.supervisorAreaMatricula.trim().toUpperCase() || null;
    const trocaArea = novaMatriculaArea !== undefined && novaMatriculaArea !== atual.supervisorAreaMatricula;

    // Re-agenda a próxima revisão quando o intervalo vier no update. Base = km da
    // última manutenção (se já houve) ou o km atual do veículo. Intervalo 0 = sem
    // agendamento. undefined (não veio) = não mexe no que já está.
    const baseKmManut = atual.kmUltimaManutencao ?? (dto.kmAtual ?? atual.kmAtual);
    const proximaManut = dto.intervaloManutencaoKm != null
      ? (dto.intervaloManutencaoKm > 0 ? baseKmManut + dto.intervaloManutencaoKm : null)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const v = await tx.veiculo.update({
        where: { id },
        data: {
          filialId: trocaFilial ? dto.filialId : undefined,
          placa: dto.placa?.trim().toUpperCase(),
          renavam: dto.renavam?.trim(),
          chassi: dto.chassi?.trim().toUpperCase(),
          modelo: dto.modelo?.trim(),
          marca: dto.marca?.trim(),
          ano: dto.ano,
          cor: dto.cor?.trim(),
          tipo: dto.tipo,
          propriedade: dto.propriedade,
          porte: dto.porte,
          finalidade: dto.finalidade,
          kmAtual: dto.kmAtual,
          capacidadeCarga: dto.capacidadeCarga?.trim(),
          situacao: dto.situacao,
          intervaloManutencaoKm: dto.intervaloManutencaoKm,
          kmProximaManutencao: proximaManut,
          departamentoLotacaoId: dto.departamentoLotacaoId,
          supervisorId: dto.supervisorId,
          ...(novaMatriculaArea !== undefined ? {
            supervisorAreaMatricula: novaMatriculaArea,
            supervisorAreaNome: novaMatriculaArea ? (dto.supervisorAreaNome?.trim() || null) : null,
          } : {}),
          ativo: dto.ativo,
        },
      });
      if (trocaSupervisor) {
        await tx.veiculoSupervisorHistorico.create({
          data: {
            veiculoId: id,
            supervisorAnteriorId: atual.supervisorId,
            supervisorNovoId: dto.supervisorId!,
            alteradoPorId,
          },
        });
      }
      // Troca do supervisor de área (registra quando atribui/muda p/ uma matrícula).
      if (trocaArea && novaMatriculaArea) {
        await tx.veiculoSupervisorAreaHistorico.create({
          data: {
            veiculoId: id,
            matriculaAnterior: atual.supervisorAreaMatricula,
            matriculaNova: novaMatriculaArea,
            nomeNovo: dto.supervisorAreaNome?.trim() || null,
            alteradoPorId,
          },
        });
      }
      return v;
    });
  }

  /** Inativa (soft-delete, ativo=false) — preserva histórico/viagens. Bloqueado se
   *  houver viagem em curso (registrar retorno/cancelar antes). Reativar = update
   *  com { ativo: true }. */
  async remove(id: string, userFilialId?: string) {
    const v = await this.prisma.veiculo.findUnique({ where: { id }, select: { id: true, filialId: true } });
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Veículo de outra filial.');
    const emCurso = await this.prisma.viagem.count({ where: { veiculoId: id, situacao: StatusViagem.EM_CURSO } });
    if (emCurso > 0) throw new BadRequestException('Não é possível inativar: o veículo tem viagem em curso.');
    return this.prisma.veiculo.update({ where: { id }, data: { ativo: false } });
  }
}
