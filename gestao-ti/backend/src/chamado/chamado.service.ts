import { Injectable } from '@nestjs/common';
import { ChamadoCoreService } from './services/chamado-core.service.js';
import { ChamadoColaboradorService } from './services/chamado-colaborador.service.js';
import { ChamadoTempoService } from './services/chamado-tempo.service.js';
import { ChamadoAnexoService } from './services/chamado-anexo.service.js';
import { CreateChamadoDto } from './dto/create-chamado.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from './dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from './dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from './dto/resolver-chamado.dto.js';
import { UpdateRegistroTempoChamadoDto } from './dto/update-registro-tempo-chamado.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusChamado, Visibilidade } from '@prisma/client';

@Injectable()
export class ChamadoService {
  constructor(
    private readonly core: ChamadoCoreService,
    private readonly colaboradores: ChamadoColaboradorService,
    private readonly tempo: ChamadoTempoService,
    private readonly anexos: ChamadoAnexoService,
  ) {}

  // ─── Core ───

  async findAll(user: JwtPayload, role: string, filters: {
    status?: StatusChamado | string;
    equipeId?: string;
    visibilidade?: Visibilidade;
    meusChamados?: boolean;
    projetoId?: string;
    filialId?: string;
    departamentoId?: string;
    pendentesAvaliacao?: boolean;
    search?: string;
    tecnicoId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) {
    return this.core.findAll(user, role, filters);
  }

  async findOne(id: string, user: JwtPayload, role: string) {
    return this.core.findOne(id, user, role);
  }

  async create(dto: CreateChamadoDto, user: JwtPayload, role: string) {
    return this.core.create(dto, user, role);
  }

  async assumir(id: string, user: JwtPayload) {
    return this.core.assumir(id, user);
  }

  async transferirEquipe(id: string, dto: TransferirEquipeDto, user: JwtPayload, role: string) {
    return this.core.transferirEquipe(id, dto, user, role);
  }

  async transferirTecnico(id: string, dto: TransferirTecnicoDto, user: JwtPayload, role: string) {
    return this.core.transferirTecnico(id, dto, user, role);
  }

  async comentar(id: string, dto: ComentarioChamadoDto, user: JwtPayload, role: string) {
    return this.core.comentar(id, dto, user, role);
  }

  async editarComentario(chamadoId: string, historicoId: string, descricao: string, user: JwtPayload, role: string) {
    return this.core.editarComentario(chamadoId, historicoId, descricao, user, role);
  }

  async resolver(id: string, dto: ResolverChamadoDto, user: JwtPayload, role: string) {
    return this.core.resolver(id, dto, user, role);
  }

  async fechar(id: string, user: JwtPayload, role: string) {
    return this.core.fechar(id, user, role);
  }

  async reabrir(id: string, dto: ReabrirChamadoDto, user: JwtPayload, role: string) {
    return this.core.reabrir(id, dto, user, role);
  }

  async vincularProjeto(chamadoId: string, projetoId: string) {
    return this.core.vincularProjeto(chamadoId, projetoId);
  }

  async cancelar(id: string, user: JwtPayload, role: string) {
    return this.core.cancelar(id, user, role);
  }

  async avaliar(id: string, dto: CsatDto, user: JwtPayload) {
    return this.core.avaliar(id, dto, user);
  }

  // ─── Colaboradores ───

  async listarColaboradores(chamadoId: string) {
    return this.colaboradores.listarColaboradores(chamadoId);
  }

  async adicionarColaborador(chamadoId: string, usuarioId: string, user: JwtPayload, role: string) {
    return this.colaboradores.adicionarColaborador(chamadoId, usuarioId, user, role);
  }

  async removerColaborador(chamadoId: string, colaboradorId: string, user: JwtPayload, role: string) {
    return this.colaboradores.removerColaborador(chamadoId, colaboradorId, user, role);
  }

  // ─── Tempo ───

  async listarRegistrosTempo(chamadoId: string) {
    return this.tempo.listarRegistrosTempo(chamadoId);
  }

  async iniciarTempoChamado(chamadoId: string, userId: string, role: string) {
    return this.tempo.iniciarTempoChamado(chamadoId, userId, role);
  }

  async encerrarTempoChamado(chamadoId: string, userId: string) {
    return this.tempo.encerrarTempoChamado(chamadoId, userId);
  }

  async ajustarRegistroTempoChamado(chamadoId: string, registroId: string, dto: UpdateRegistroTempoChamadoDto, userId?: string, role?: string) {
    return this.tempo.ajustarRegistroTempoChamado(chamadoId, registroId, dto, userId, role);
  }

  async removerRegistroTempoChamado(chamadoId: string, registroId: string, userId?: string, role?: string) {
    return this.tempo.removerRegistroTempoChamado(chamadoId, registroId, userId, role);
  }

  // ─── Anexos ───

  async listAnexos(chamadoId: string) {
    return this.anexos.listAnexos(chamadoId);
  }

  async addAnexo(chamadoId: string, file: Express.Multer.File, userId: string, descricao?: string) {
    return this.anexos.addAnexo(chamadoId, file, userId, descricao);
  }

  async getAnexoFile(chamadoId: string, anexoId: string) {
    return this.anexos.getAnexoFile(chamadoId, anexoId);
  }

  async removeAnexo(chamadoId: string, anexoId: string) {
    return this.anexos.removeAnexo(chamadoId, anexoId);
  }
}
