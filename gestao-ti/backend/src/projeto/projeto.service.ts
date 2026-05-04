import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjetoHelpersService } from './services/projeto-helpers.service.js';
import { ProjetoCoreService } from './services/projeto-core.service.js';
import { ProjetoFaseService } from './services/projeto-fase.service.js';
import { ProjetoMembroService } from './services/projeto-membro.service.js';
import { ProjetoAtividadeService } from './services/projeto-atividade.service.js';
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
  }) {
    return this.core.findAll(filters);
  }

  findOne(id: string, userId?: string, role?: string) {
    return this.core.findOne(id, userId, role);
  }

  create(dto: CreateProjetoDto, userId?: string, role?: string) {
    return this.core.create(dto, userId, role);
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

  // ============================================================
  // TERCEIRIZADOS
  // ============================================================

  listTerceirizados(projetoId: string) {
    return this.membroService.listTerceirizados(projetoId);
  }

  addTerceirizado(projetoId: string, dto: {
    usuarioId: string;
    funcao: string;
    empresa?: string;
    especialidade?: string;
    dataInicio?: Date;
    dataFim?: Date;
    observacoes?: string;
  }) {
    return this.membroService.addTerceirizado(projetoId, dto);
  }

  updateTerceirizado(projetoId: string, terceirizadoId: string, dto: {
    funcao?: string;
    empresa?: string;
    especialidade?: string;
    dataInicio?: Date;
    dataFim?: Date;
    observacoes?: string;
    ativo?: boolean;
  }) {
    return this.membroService.updateTerceirizado(projetoId, terceirizadoId, dto);
  }

  removeTerceirizado(projetoId: string, terceirizadoId: string) {
    return this.membroService.removeTerceirizado(projetoId, terceirizadoId);
  }

  meusProjetosChave(usuarioId: string) {
    return this.membroService.meusProjetosChave(usuarioId);
  }

  meusProjetosTerceirizado(usuarioId: string) {
    return this.membroService.meusProjetosTerceirizado(usuarioId);
  }

  // ============================================================
  // ATIVIDADES
  // ============================================================

  listAtividades(projetoId: string) {
    return this.atividadeService.listAtividades(projetoId);
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
  ) {
    return this.atividadeService.updateAtividade(projetoId, atividadeId, dto);
  }

  removeAtividade(projetoId: string, atividadeId: string) {
    return this.atividadeService.removeAtividade(projetoId, atividadeId);
  }

  // ============================================================
  // COMENTARIOS DE TAREFA
  // ============================================================

  listComentarios(projetoId: string, atividadeId: string) {
    return this.atividadeService.listComentarios(projetoId, atividadeId);
  }

  addComentario(projetoId: string, atividadeId: string, texto: string, userId: string, visivelPendencia?: boolean) {
    return this.atividadeService.addComentario(projetoId, atividadeId, texto, userId, visivelPendencia);
  }

  removeComentario(projetoId: string, comentarioId: string, userId: string, role?: string) {
    return this.atividadeService.removeComentario(projetoId, comentarioId, userId, role);
  }

  updateComentario(projetoId: string, comentarioId: string, texto: string, userId: string, role?: string, visivelPendencia?: boolean) {
    return this.atividadeService.updateComentario(projetoId, comentarioId, texto, userId, role, visivelPendencia);
  }

  buscarComentarios(query: string) {
    return this.atividadeService.buscarComentarios(query);
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
  }, userId: string, role: string) {
    return this.pendenciaService.listPendencias(projetoId, filters, userId, role);
  }

  getPendencia(projetoId: string, pendenciaId: string, userId: string, role: string) {
    return this.pendenciaService.getPendencia(projetoId, pendenciaId, userId, role);
  }

  createPendencia(projetoId: string, dto: CreatePendenciaDto, criadorId: string, role: string) {
    return this.pendenciaService.createPendencia(projetoId, dto, criadorId, role);
  }

  updatePendencia(projetoId: string, pendenciaId: string, dto: UpdatePendenciaDto, userId: string, role: string) {
    return this.pendenciaService.updatePendencia(projetoId, pendenciaId, dto, userId, role);
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

  addInteracaoPendencia(projetoId: string, pendenciaId: string, dto: CreateInteracaoPendenciaDto, userId: string, role: string) {
    return this.pendenciaService.addInteracaoPendencia(projetoId, pendenciaId, dto, userId, role);
  }

  editarInteracaoPendencia(projetoId: string, pendenciaId: string, interacaoId: string, descricao: string, userId: string, role: string) {
    return this.pendenciaService.editarInteracaoPendencia(projetoId, pendenciaId, interacaoId, descricao, userId, role);
  }

  // ============================================================
  // ANEXOS PENDENCIA
  // ============================================================

  addAnexoPendencia(projetoId: string, pendenciaId: string, file: Express.Multer.File, userId: string, role: string) {
    return this.pendenciaService.addAnexoPendencia(projetoId, pendenciaId, file, userId, role);
  }

  downloadAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string, userId: string, role: string) {
    return this.pendenciaService.downloadAnexoPendencia(projetoId, pendenciaId, anexoId, userId, role);
  }

  removeAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string) {
    return this.pendenciaService.removeAnexoPendencia(projetoId, pendenciaId, anexoId);
  }

  // ============================================================
  // HELPERS (exposed for controller usage)
  // ============================================================

  assertMembroOuGestor(projetoId: string, userId: string, role: string) {
    return this.helpers.assertMembroOuGestor(projetoId, userId, role);
  }

  checkProjetoAccessChave(projetoId: string, userId: string, role: string) {
    return this.helpers.checkProjetoAccessChave(projetoId, userId, role);
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
