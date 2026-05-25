import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ProjetoHelpersService } from './services/projeto-helpers.service.js';
import { ProjetoCoreService } from './services/projeto-core.service.js';
import { ProjetoFaseService } from './services/projeto-fase.service.js';
import { ProjetoMembroService } from './services/projeto-membro.service.js';
import { ProjetoAtividadeService } from './services/projeto-atividade.service.js';
import { ProjetoAtividadeHistoricoService } from './services/projeto-atividade-historico.service.js';
import { ProjetoPendenciaService } from './services/projeto-pendencia.service.js';
import { ProjetoTempoService } from './services/projeto-tempo.service.js';
import { ProjetoFinanceiroService } from './services/projeto-financeiro.service.js';
import { ProjetoComplementoService } from './services/projeto-complemento.service.js';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';
import { CreateFaseDto } from './dto/create-fase.dto';
import { UpdateFaseDto } from './dto/update-fase.dto';
import { CreateMembroDto } from './dto/create-membro.dto';
import { CreateCotacaoDto } from './dto/create-cotacao.dto';
import { CreateCustoDto } from './dto/create-custo.dto';
import { CreateRiscoDto } from './dto/create-risco.dto';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';
import { CreateAnexoDto } from './dto/create-anexo.dto';
import { CreateApontamentoDto } from './dto/create-apontamento.dto';
import { UpdateRegistroTempoDto } from './dto/update-registro-tempo.dto';
import { CreateUsuarioChaveDto } from './dto/create-usuario-chave.dto';
import { CreatePendenciaDto } from './dto/create-pendencia.dto';
import { UpdatePendenciaDto } from './dto/update-pendencia.dto';
import { CreateInteracaoPendenciaDto } from './dto/create-interacao-pendencia.dto';

@Injectable()
export class ProjetoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
    private readonly core: ProjetoCoreService,
    private readonly faseService: ProjetoFaseService,
    private readonly membroService: ProjetoMembroService,
    private readonly atividadeService: ProjetoAtividadeService,
    private readonly atividadeHistoricoService: ProjetoAtividadeHistoricoService,
    private readonly pendenciaService: ProjetoPendenciaService,
    private readonly tempoService: ProjetoTempoService,
    private readonly financeiroService: ProjetoFinanceiroService,
    private readonly complementoService: ProjetoComplementoService,
  ) {}

  // ============================================================
  // CORE — CRUD Projeto
  // ============================================================

  findAll(filters: {
    status?: string;
    tipo?: string;
    modo?: string;
    softwareId?: string;
    contratoId?: string;
    search?: string;
    apenasRaiz?: string;
    meusProjetos?: string;
    usuarioId?: string;
    role?: string;
    page?: number;
    pageSize?: number;
    user?: JwtPayload;
  }) {
    return this.core.findAll(filters);
  }

  findOne(id: string, user?: JwtPayload, role?: string) {
    return this.core.findOne(id, user, role);
  }

  create(dto: CreateProjetoDto, userId?: string, role?: string, user?: import('../common/interfaces/jwt-payload.interface').JwtPayload) {
    return this.core.create(dto, userId, role, user);
  }

  update(id: string, dto: UpdateProjetoDto) {
    return this.core.update(id, dto);
  }

  remove(id: string) {
    return this.core.remove(id);
  }

  duplicar(id: string, userId: string) {
    return this.core.duplicar(id, userId);
  }

  // --- Transições do ciclo HOM → PROD (29/04/2026) ---
  liberarHomologacao(id: string, userId: string) {
    return this.core.liberarHomologacao(id, userId);
  }
  liberarProducao(id: string, userId: string) {
    return this.core.liberarProducao(id, userId);
  }
  concluirProducao(id: string, userId: string) {
    return this.core.concluirProducao(id, userId);
  }
  voltarParaAndamento(id: string, userId: string, motivo?: string) {
    return this.core.voltarParaAndamento(id, userId, motivo);
  }

  visaoGeral(projetoId: string) {
    return this.core.visaoGeral(projetoId);
  }

  // ============================================================
  // FASES
  // ============================================================

  listFases(projetoId: string) {
    return this.faseService.listFases(projetoId);
  }

  addFase(projetoId: string, dto: CreateFaseDto) {
    return this.faseService.addFase(projetoId, dto);
  }

  updateFase(projetoId: string, faseId: string, dto: UpdateFaseDto) {
    return this.faseService.updateFase(projetoId, faseId, dto);
  }

  removeFase(projetoId: string, faseId: string) {
    return this.faseService.removeFase(projetoId, faseId);
  }

  // ============================================================
  // MEMBROS
  // ============================================================

  listMembros(projetoId: string) {
    return this.membroService.listMembros(projetoId);
  }

  addMembro(projetoId: string, dto: CreateMembroDto) {
    return this.membroService.addMembro(projetoId, dto);
  }

  removeMembro(projetoId: string, membroId: string) {
    return this.membroService.removeMembro(projetoId, membroId);
  }

  // ============================================================
  // USUARIOS CHAVE
  // ============================================================

  listUsuariosChave(projetoId: string) {
    return this.membroService.listUsuariosChave(projetoId);
  }

  addUsuarioChave(projetoId: string, dto: CreateUsuarioChaveDto) {
    return this.membroService.addUsuarioChave(projetoId, dto);
  }

  removeUsuarioChave(projetoId: string, ucId: string) {
    return this.membroService.removeUsuarioChave(projetoId, ucId);
  }

  meusProjetosChave(usuarioId: string) {
    return this.membroService.meusProjetosChave(usuarioId);
  }

  // ============================================================
  // ATIVIDADES
  // ============================================================

  listAtividades(projetoId: string, user?: JwtPayload, role?: string) {
    return this.atividadeService.listAtividades(projetoId, user, role);
  }

  addAtividade(
    projetoId: string,
    dto: { titulo: string; descricao?: string; faseId?: string; pendenciaId?: string; dataInicio?: string; dataFimPrevista?: string; responsavelIds?: string[] },
    userId: string,
  ) {
    return this.atividadeService.addAtividade(projetoId, dto, userId);
  }

  updateAtividade(
    projetoId: string,
    atividadeId: string,
    dto: { titulo?: string; descricao?: string; faseId?: string; status?: string; dataInicio?: string; dataFimPrevista?: string; responsavelIds?: string[] },
    actorId?: string,
  ) {
    return this.atividadeService.updateAtividade(projetoId, atividadeId, dto, actorId);
  }

  removeAtividade(projetoId: string, atividadeId: string) {
    return this.atividadeService.removeAtividade(projetoId, atividadeId);
  }

  listarHistoricoAtividade(projetoId: string, atividadeId: string) {
    return this.atividadeHistoricoService.listar(projetoId, atividadeId);
  }

  // ============================================================
  // COMENTARIOS DE TAREFA
  // ============================================================

  listComentarios(projetoId: string, atividadeId: string, user?: JwtPayload, role?: string) {
    return this.atividadeService.listComentarios(projetoId, atividadeId, user, role);
  }

  addComentario(projetoId: string, atividadeId: string, texto: string, user: JwtPayload, visivelPendencia?: boolean, publica?: boolean, role?: string) {
    return this.atividadeService.addComentario(projetoId, atividadeId, texto, user, visivelPendencia, publica, role);
  }

  removeComentario(projetoId: string, comentarioId: string, userId: string, role?: string) {
    return this.atividadeService.removeComentario(projetoId, comentarioId, userId, role);
  }

  updateComentario(projetoId: string, comentarioId: string, texto: string, user: JwtPayload, role?: string, visivelPendencia?: boolean, publica?: boolean) {
    return this.atividadeService.updateComentario(projetoId, comentarioId, texto, user, role, visivelPendencia, publica);
  }

  buscarComentarios(query: string, user?: JwtPayload, role?: string) {
    return this.atividadeService.buscarComentarios(query, user, role);
  }

  // ============================================================
  // REGISTRO DE TEMPO
  // ============================================================

  listarRegistrosTempo(projetoId: string, atividadeId: string) {
    return this.tempoService.listarRegistrosTempo(projetoId, atividadeId);
  }

  iniciarRegistroTempo(projetoId: string, atividadeId: string, userId: string) {
    return this.tempoService.iniciarRegistroTempo(projetoId, atividadeId, userId);
  }

  encerrarRegistroTempo(projetoId: string, atividadeId: string, userId: string) {
    return this.tempoService.encerrarRegistroTempo(projetoId, atividadeId, userId);
  }

  ajustarRegistroTempo(projetoId: string, registroId: string, dto: UpdateRegistroTempoDto, userId?: string, role?: string) {
    return this.tempoService.ajustarRegistroTempo(projetoId, registroId, dto, userId, role);
  }

  removerRegistroTempo(projetoId: string, registroId: string, userId?: string, role?: string) {
    return this.tempoService.removerRegistroTempo(projetoId, registroId, userId, role);
  }

  obterRegistroAtivo(projetoId: string, userId: string) {
    return this.tempoService.obterRegistroAtivo(projetoId, userId);
  }

  // ============================================================
  // APONTAMENTO DE HORAS
  // ============================================================

  listApontamentos(projetoId: string) {
    return this.tempoService.listApontamentos(projetoId);
  }

  addApontamento(projetoId: string, dto: CreateApontamentoDto, userId: string) {
    return this.tempoService.addApontamento(projetoId, dto, userId);
  }

  removeApontamento(projetoId: string, apontamentoId: string) {
    return this.tempoService.removeApontamento(projetoId, apontamentoId);
  }

  // ============================================================
  // COTACOES
  // ============================================================

  listCotacoes(projetoId: string) {
    return this.financeiroService.listCotacoes(projetoId);
  }

  addCotacao(projetoId: string, dto: CreateCotacaoDto) {
    return this.financeiroService.addCotacao(projetoId, dto);
  }

  updateCotacao(projetoId: string, cotacaoId: string, dto: CreateCotacaoDto) {
    return this.financeiroService.updateCotacao(projetoId, cotacaoId, dto);
  }

  removeCotacao(projetoId: string, cotacaoId: string) {
    return this.financeiroService.removeCotacao(projetoId, cotacaoId);
  }

  // ============================================================
  // CUSTOS
  // ============================================================

  listCustosDetalhados(projetoId: string) {
    return this.financeiroService.listCustosDetalhados(projetoId);
  }

  addCusto(projetoId: string, dto: CreateCustoDto) {
    return this.financeiroService.addCusto(projetoId, dto);
  }

  updateCusto(projetoId: string, custoId: string, dto: CreateCustoDto) {
    return this.financeiroService.updateCusto(projetoId, custoId, dto);
  }

  removeCusto(projetoId: string, custoId: string) {
    return this.financeiroService.removeCusto(projetoId, custoId);
  }

  getCustosConsolidados(id: string) {
    return this.financeiroService.getCustosConsolidados(id);
  }

  listarNFsProjeto(projetoId: string) {
    return this.financeiroService.listarNFsProjeto(projetoId);
  }

  listarParcelasRateioProjeto(projetoId: string) {
    return this.financeiroService.listarParcelasRateioProjeto(projetoId);
  }

  // ============================================================
  // RISCOS
  // ============================================================

  listRiscos(projetoId: string) {
    return this.complementoService.listRiscos(projetoId);
  }

  addRisco(projetoId: string, dto: CreateRiscoDto) {
    return this.complementoService.addRisco(projetoId, dto);
  }

  updateRisco(projetoId: string, riscoId: string, dto: CreateRiscoDto) {
    return this.complementoService.updateRisco(projetoId, riscoId, dto);
  }

  removeRisco(projetoId: string, riscoId: string) {
    return this.complementoService.removeRisco(projetoId, riscoId);
  }

  // ============================================================
  // DEPENDENCIAS
  // ============================================================

  listDependencias(projetoId: string) {
    return this.complementoService.listDependencias(projetoId);
  }

  addDependencia(projetoId: string, dto: CreateDependenciaDto) {
    return this.complementoService.addDependencia(projetoId, dto);
  }

  removeDependencia(projetoId: string, depId: string) {
    return this.complementoService.removeDependencia(projetoId, depId);
  }

  // ============================================================
  // ANEXOS
  // ============================================================

  listAnexos(projetoId: string) {
    return this.complementoService.listAnexos(projetoId);
  }

  addAnexo(projetoId: string, dto: CreateAnexoDto, userId: string) {
    return this.complementoService.addAnexo(projetoId, dto, userId);
  }

  uploadAnexo(projetoId: string, file: Express.Multer.File, userId: string, descricao?: string) {
    return this.complementoService.uploadAnexo(projetoId, file, userId, descricao);
  }

  getAnexoFile(projetoId: string, anexoId: string) {
    return this.complementoService.getAnexoFile(projetoId, anexoId);
  }

  removeAnexo(projetoId: string, anexoId: string) {
    return this.complementoService.removeAnexo(projetoId, anexoId);
  }

  // ============================================================
  // CHAMADOS VINCULADOS
  // ============================================================

  vincularChamado(projetoId: string, chamadoId: string) {
    return this.complementoService.vincularChamado(projetoId, chamadoId);
  }

  desvincularChamado(projetoId: string, chamadoId: string) {
    return this.complementoService.desvincularChamado(projetoId, chamadoId);
  }

  getChamadosProjeto(projetoId: string) {
    return this.complementoService.getChamadosProjeto(projetoId);
  }

  // ============================================================
  // PENDENCIAS
  // ============================================================

  listPendencias(projetoId: string, filters: {
    status?: string; prioridade?: string; responsavelId?: string; search?: string; incluirSubProjetos?: boolean;
  }, user: JwtPayload, role: string) {
    return this.pendenciaService.listPendencias(projetoId, filters, user, role);
  }

  getPendencia(projetoId: string, pendenciaId: string, user: JwtPayload, role: string) {
    return this.pendenciaService.getPendencia(projetoId, pendenciaId, user, role);
  }

  createPendencia(projetoId: string, dto: CreatePendenciaDto, user: JwtPayload, role: string) {
    return this.pendenciaService.createPendencia(projetoId, dto, user, role);
  }

  updatePendencia(projetoId: string, pendenciaId: string, dto: UpdatePendenciaDto, user: JwtPayload, role: string) {
    return this.pendenciaService.updatePendencia(projetoId, pendenciaId, dto, user, role);
  }

  gerarAtividadeFromPendencia(
    projetoId: string,
    pendenciaId: string,
    dto: { titulo?: string; descricao?: string; dataFimPrevista?: string },
    userId: string,
  ) {
    return this.pendenciaService.gerarAtividadeFromPendencia(projetoId, pendenciaId, dto, userId);
  }

  // ============================================================
  // INTERACOES PENDENCIA
  // ============================================================

  addInteracaoPendencia(projetoId: string, pendenciaId: string, dto: CreateInteracaoPendenciaDto, user: JwtPayload, role: string) {
    return this.pendenciaService.addInteracaoPendencia(projetoId, pendenciaId, dto, user, role);
  }

  editarInteracaoPendencia(projetoId: string, pendenciaId: string, interacaoId: string, descricao: string, user: JwtPayload, role: string) {
    return this.pendenciaService.editarInteracaoPendencia(projetoId, pendenciaId, interacaoId, descricao, user, role);
  }

  // ============================================================
  // ANEXOS PENDENCIA
  // ============================================================

  addAnexoPendencia(projetoId: string, pendenciaId: string, file: Express.Multer.File, user: JwtPayload, role: string) {
    return this.pendenciaService.addAnexoPendencia(projetoId, pendenciaId, file, user, role);
  }

  downloadAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string, user: JwtPayload, role: string) {
    return this.pendenciaService.downloadAnexoPendencia(projetoId, pendenciaId, anexoId, user, role);
  }

  removeAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string) {
    return this.pendenciaService.removeAnexoPendencia(projetoId, pendenciaId, anexoId);
  }

  // ============================================================
  // HELPERS (exposed for controller usage)
  // ============================================================

  // S13a (25/05) — wrappers recebem `user: JwtPayload` (era `userId: string`).
  // Helpers passaram a usar hasStaffPerfilEmTI(user) — fix multi-perfil
  // (incidente Juliana). Callers internos foram migrados em cascata.
  assertMembroOuGestor(projetoId: string, user: JwtPayload, role: string) {
    return this.helpers.assertMembroOuGestor(projetoId, user, role);
  }

  checkProjetoAccessChave(projetoId: string, user: JwtPayload, role: string) {
    return this.helpers.checkProjetoAccessChave(projetoId, user, role);
  }

  // ============================================================
  // FAVORITOS
  // ============================================================

  async listarFavoritos(userId: string): Promise<string[]> {
    const favs = await this.prisma.projetoFavorito.findMany({
      where: { usuarioId: userId },
      select: { projetoId: true },
    });
    return favs.map((f) => f.projetoId);
  }

  async toggleFavorito(projetoId: string, userId: string): Promise<{ favorito: boolean }> {
    const existing = await this.prisma.projetoFavorito.findUnique({
      where: { usuarioId_projetoId: { usuarioId: userId, projetoId } },
    });
    if (existing) {
      await this.prisma.projetoFavorito.delete({ where: { id: existing.id } });
      return { favorito: false };
    }
    await this.prisma.projetoFavorito.create({
      data: { projetoId, usuarioId: userId },
    });
    return { favorito: true };
  }
}
