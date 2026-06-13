import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
  ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { StatusViagem, TipoViagem, SituacaoVeiculo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { SaidaFrotaDto, RetornoFrotaDto, AjusteGestorDto } from './dto.js';

// Mesma normalização do toChapaPortal pra comparar matrículas com segurança.
const chapa = (m: string) => 'E' + (m || '').replace(/\D/g, '').slice(-5).padStart(5, '0');

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
  ) {}

  /** Passo 1 da saída: identifica o condutor pelo nome (antes da senha). */
  async buscarCondutor(matricula: string) {
    const r = await this.condutor.buscarNome(matricula);
    if (!r) throw new NotFoundException('Matrícula não encontrada no Protheus.');
    return r;
  }

  private async validarOuErro(matricula: string, senha: string) {
    const r = await this.condutor.validar(matricula, senha);
    if (r.status === 'INDISPONIVEL') {
      throw new ServiceUnavailableException('Portal do RH indisponível. Tente novamente em instantes.');
    }
    if (r.status !== 'VALIDO') throw new UnauthorizedException('Matrícula ou senha inválidas.');
    return r;
  }

  /** Registrar SAÍDA do veículo (condutor autentica). Veículo → EM_USO. */
  async registrarSaida(dto: SaidaFrotaDto, user: JwtPayload) {
    const filialId = user.filialId;
    if (!filialId) throw new BadRequestException('Usuário sem filial definida.');
    const cond = await this.validarOuErro(dto.matricula, dto.senha);

    const veiculo = await this.prisma.veiculo.findFirst({
      where: { id: dto.veiculoId, filialId, ativo: true },
    });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado nesta filial.');
    if (veiculo.situacao !== SituacaoVeiculo.DISPONIVEL) {
      throw new BadRequestException(`Veículo indisponível (situação: ${veiculo.situacao}).`);
    }
    if (dto.kmInicial < veiculo.kmAtual) {
      throw new BadRequestException(`KM inicial (${dto.kmInicial}) menor que o KM atual do veículo (${veiculo.kmAtual}).`);
    }

    return this.prisma.$transaction(async (tx) => {
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
          condutorMatricula: cond.matricula,
          condutorNome: cond.nome,
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
  }

  /** Registrar RETORNO (só o próprio condutor). Veículo → DISPONIVEL + km atualizado. */
  async registrarRetorno(id: string, dto: RetornoFrotaDto, user: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A viagem não está em curso.');

    const cond = await this.validarOuErro(dto.matricula, dto.senha);
    if (chapa(cond.matricula) !== chapa(v.condutorMatricula ?? '')) {
      throw new ForbiddenException('Só o condutor que iniciou pode fechar a viagem. Para corrigir, peça ao gestor de frota.');
    }
    if (dto.kmFinal < (v.kmInicial ?? 0)) {
      throw new BadRequestException(`KM final (${dto.kmFinal}) menor que o KM de saída (${v.kmInicial}).`);
    }
    return this.fechar(id, v.veiculoId, dto.kmFinal, dto.observacoes ?? null);
  }

  /** Ajuste/fechamento por GESTOR_FROTA ou supervisor do veículo. */
  async ajustarPorGestor(id: string, dto: AjusteGestorDto, user: JwtPayload, role?: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { veiculo: { select: { supervisorId: true } } } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');

    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    const ehSupervisor = v.veiculo?.supervisorId === user.sub;
    if (!ehGestor && !ehSupervisor) {
      throw new ForbiddenException('Apenas gestor de frota ou o supervisor do veículo podem ajustar.');
    }

    const kmFinal = dto.kmFinal ?? v.kmFinal ?? undefined;
    if (dto.concluir) {
      if (kmFinal == null) throw new BadRequestException('Informe o KM final para concluir.');
      if (kmFinal < (dto.kmInicial ?? v.kmInicial ?? 0)) throw new BadRequestException('KM final menor que o KM de saída.');
      return this.fechar(id, v.veiculoId, kmFinal, dto.observacoesChegada ?? v.observacoesChegada ?? null, {
        kmInicial: dto.kmInicial, observacoesSaida: dto.observacoesSaida,
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
      },
    });
  }

  private async fechar(id: string, veiculoId: string | null, kmFinal: number, obsChegada: string | null, extra?: { kmInicial?: number; observacoesSaida?: string }) {
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

  /** Lista as viagens de FROTA da filial (com nome do veículo). */
  async listar(filialId: string, situacao?: StatusViagem) {
    const viagens = await this.prisma.viagem.findMany({
      where: { tipo: TipoViagem.FROTA, filialId, ...(situacao ? { situacao } : {}) },
      include: { veiculo: { select: { placa: true, modelo: true } } },
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
    }));
  }
}
