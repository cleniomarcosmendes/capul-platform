import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as express from 'express';
import { ProjetoService } from './projeto.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
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

const PENDENCIA_UPLOADS_DIR = path.resolve('./uploads/pendencias');

@Controller('projetos')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ProjetoController {
  constructor(private readonly service: ProjetoService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('tipo') tipo?: string,
    @Query('modo') modo?: string,
    @Query('softwareId') softwareId?: string,
    @Query('contratoId') contratoId?: string,
    @Query('search') search?: string,
    @Query('apenasRaiz') apenasRaiz?: string,
    @Query('meusProjetos') meusProjetos?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.service.findAll({
      status,
      tipo,
      modo,
      softwareId,
      contratoId,
      search,
      apenasRaiz,
      meusProjetos,
      usuarioId: user?.sub,
    });
  }

  @Get('busca-comentarios')
  buscarComentarios(@Query('q') q: string) {
    return this.service.buscarComentarios(q);
  }

  @Get('meus-projetos-chave')
  @Roles('USUARIO_CHAVE')
  meusProjetosChave(@CurrentUser() user: JwtPayload) {
    return this.service.meusProjetosChave(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO')
  create(@Body() dto: CreateProjetoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO')
  update(@Param('id') id: string, @Body() dto: UpdateProjetoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // --- Membros ---

  @Get(':id/membros')
  listMembros(@Param('id') id: string) {
    return this.service.listMembros(id);
  }

  @Post(':id/membros')
  @Roles('ADMIN', 'GESTOR_TI')
  addMembro(@Param('id') id: string, @Body() dto: CreateMembroDto) {
    return this.service.addMembro(id, dto);
  }

  @Delete(':id/membros/:membroId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeMembro(@Param('id') id: string, @Param('membroId') membroId: string) {
    return this.service.removeMembro(id, membroId);
  }

  // --- Fases ---

  @Get(':id/fases')
  listFases(@Param('id') id: string) {
    return this.service.listFases(id);
  }

  @Post(':id/fases')
  @Roles('ADMIN', 'GESTOR_TI')
  addFase(@Param('id') id: string, @Body() dto: CreateFaseDto) {
    return this.service.addFase(id, dto);
  }

  @Patch(':id/fases/:faseId')
  @Roles('ADMIN', 'GESTOR_TI')
  updateFase(
    @Param('id') id: string,
    @Param('faseId') faseId: string,
    @Body() dto: UpdateFaseDto,
  ) {
    return this.service.updateFase(id, faseId, dto);
  }

  @Delete(':id/fases/:faseId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeFase(@Param('id') id: string, @Param('faseId') faseId: string) {
    return this.service.removeFase(id, faseId);
  }

  // --- Atividades ---

  @Get(':id/atividades')
  listAtividades(@Param('id') id: string) {
    return this.service.listAtividades(id);
  }

  @Post(':id/atividades')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  addAtividade(
    @Param('id') id: string,
    @Body() dto: { titulo: string; descricao?: string; faseId?: string; dataInicio?: string; dataFimPrevista?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addAtividade(id, dto, user.sub);
  }

  @Patch(':id/atividades/:atividadeId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  updateAtividade(
    @Param('id') id: string,
    @Param('atividadeId') atividadeId: string,
    @Body() dto: { titulo?: string; descricao?: string; faseId?: string; status?: string; dataInicio?: string; dataFimPrevista?: string },
  ) {
    return this.service.updateAtividade(id, atividadeId, dto);
  }

  @Delete(':id/atividades/:atividadeId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  removeAtividade(@Param('id') id: string, @Param('atividadeId') atividadeId: string) {
    return this.service.removeAtividade(id, atividadeId);
  }

  // --- Comentarios de Tarefa ---

  @Get(':id/atividades/:atividadeId/comentarios')
  listComentarios(@Param('id') id: string, @Param('atividadeId') atividadeId: string) {
    return this.service.listComentarios(id, atividadeId);
  }

  @Post(':id/atividades/:atividadeId/comentarios')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'FINANCEIRO')
  addComentario(
    @Param('id') id: string,
    @Param('atividadeId') atividadeId: string,
    @Body() body: { texto: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addComentario(id, atividadeId, body.texto, user.sub);
  }

  @Delete(':id/comentarios/:comentarioId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeComentario(@Param('id') id: string, @Param('comentarioId') comentarioId: string) {
    return this.service.removeComentario(id, comentarioId);
  }

  // --- Registro de Tempo ---

  @Get(':id/atividades/:atividadeId/registros-tempo')
  listRegistrosTempo(@Param('id') id: string, @Param('atividadeId') atividadeId: string) {
    return this.service.listarRegistrosTempo(id, atividadeId);
  }

  @Post(':id/atividades/:atividadeId/iniciar')
  iniciarTempo(@Param('id') id: string, @Param('atividadeId') atividadeId: string, @CurrentUser() user: JwtPayload) {
    return this.service.iniciarRegistroTempo(id, atividadeId, user.sub);
  }

  @Post(':id/atividades/:atividadeId/encerrar')
  encerrarTempo(@Param('id') id: string, @Param('atividadeId') atividadeId: string, @CurrentUser() user: JwtPayload) {
    return this.service.encerrarRegistroTempo(id, atividadeId, user.sub);
  }

  @Get(':id/registro-ativo')
  registroAtivo(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.obterRegistroAtivo(id, user.sub);
  }

  @Patch(':id/registros-tempo/:registroId')
  ajustarRegistroTempo(@Param('id') id: string, @Param('registroId') registroId: string, @Body() dto: UpdateRegistroTempoDto) {
    return this.service.ajustarRegistroTempo(id, registroId, dto);
  }

  @Delete(':id/registros-tempo/:registroId')
  removerRegistroTempo(@Param('id') id: string, @Param('registroId') registroId: string) {
    return this.service.removerRegistroTempo(id, registroId);
  }

  // --- Chamados (vincular/desvincular) ---

  @Post(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  vincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string) {
    return this.service.vincularChamado(id, chamadoId);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  desvincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string) {
    return this.service.desvincularChamado(id, chamadoId);
  }

  // --- Cotacoes ---

  @Get(':id/cotacoes')
  listCotacoes(@Param('id') id: string) {
    return this.service.listCotacoes(id);
  }

  @Post(':id/cotacoes')
  @Roles('ADMIN', 'GESTOR_TI')
  addCotacao(@Param('id') id: string, @Body() dto: CreateCotacaoDto) {
    return this.service.addCotacao(id, dto);
  }

  @Patch(':id/cotacoes/:cotacaoId')
  @Roles('ADMIN', 'GESTOR_TI')
  updateCotacao(
    @Param('id') id: string,
    @Param('cotacaoId') cotacaoId: string,
    @Body() dto: CreateCotacaoDto,
  ) {
    return this.service.updateCotacao(id, cotacaoId, dto);
  }

  @Delete(':id/cotacoes/:cotacaoId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeCotacao(@Param('id') id: string, @Param('cotacaoId') cotacaoId: string) {
    return this.service.removeCotacao(id, cotacaoId);
  }

  // --- Custos Detalhados ---

  @Get(':id/custos-detalhados')
  listCustosDetalhados(@Param('id') id: string) {
    return this.service.listCustosDetalhados(id);
  }

  @Post(':id/custos-detalhados')
  @Roles('ADMIN', 'GESTOR_TI')
  addCusto(@Param('id') id: string, @Body() dto: CreateCustoDto) {
    return this.service.addCusto(id, dto);
  }

  @Patch(':id/custos-detalhados/:custoId')
  @Roles('ADMIN', 'GESTOR_TI')
  updateCusto(
    @Param('id') id: string,
    @Param('custoId') custoId: string,
    @Body() dto: CreateCustoDto,
  ) {
    return this.service.updateCusto(id, custoId, dto);
  }

  @Delete(':id/custos-detalhados/:custoId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeCusto(@Param('id') id: string, @Param('custoId') custoId: string) {
    return this.service.removeCusto(id, custoId);
  }

  // --- Riscos ---

  @Get(':id/riscos')
  listRiscos(@Param('id') id: string) {
    return this.service.listRiscos(id);
  }

  @Post(':id/riscos')
  @Roles('ADMIN', 'GESTOR_TI')
  addRisco(@Param('id') id: string, @Body() dto: CreateRiscoDto) {
    return this.service.addRisco(id, dto);
  }

  @Patch(':id/riscos/:riscoId')
  @Roles('ADMIN', 'GESTOR_TI')
  updateRisco(
    @Param('id') id: string,
    @Param('riscoId') riscoId: string,
    @Body() dto: CreateRiscoDto,
  ) {
    return this.service.updateRisco(id, riscoId, dto);
  }

  @Delete(':id/riscos/:riscoId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeRisco(@Param('id') id: string, @Param('riscoId') riscoId: string) {
    return this.service.removeRisco(id, riscoId);
  }

  // --- Dependencias ---

  @Get(':id/dependencias')
  listDependencias(@Param('id') id: string) {
    return this.service.listDependencias(id);
  }

  @Post(':id/dependencias')
  @Roles('ADMIN', 'GESTOR_TI')
  addDependencia(@Param('id') id: string, @Body() dto: CreateDependenciaDto) {
    return this.service.addDependencia(id, dto);
  }

  @Delete(':id/dependencias/:depId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeDependencia(@Param('id') id: string, @Param('depId') depId: string) {
    return this.service.removeDependencia(id, depId);
  }

  // --- Anexos ---

  @Get(':id/anexos')
  listAnexos(@Param('id') id: string) {
    return this.service.listAnexos(id);
  }

  @Post(':id/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  addAnexo(
    @Param('id') id: string,
    @Body() dto: CreateAnexoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addAnexo(id, dto, user.sub);
  }

  @Delete(':id/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeAnexo(@Param('id') id: string, @Param('anexoId') anexoId: string) {
    return this.service.removeAnexo(id, anexoId);
  }

  // --- Apontamento de Horas ---

  @Get(':id/apontamentos')
  listApontamentos(@Param('id') id: string) {
    return this.service.listApontamentos(id);
  }

  @Post(':id/apontamentos')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  addApontamento(
    @Param('id') id: string,
    @Body() dto: CreateApontamentoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addApontamento(id, dto, user.sub);
  }

  @Delete(':id/apontamentos/:apontamentoId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeApontamento(
    @Param('id') id: string,
    @Param('apontamentoId') apontamentoId: string,
  ) {
    return this.service.removeApontamento(id, apontamentoId);
  }

  // --- Chamados ---

  @Get(':id/chamados')
  getChamadosProjeto(@Param('id') id: string) {
    return this.service.getChamadosProjeto(id);
  }

  // --- Custos Consolidados ---

  @Get(':id/custos')
  getCustos(@Param('id') id: string) {
    return this.service.getCustosConsolidados(id);
  }

  // --- Usuarios-Chave ---

  @Get(':id/usuarios-chave')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO')
  listUsuariosChave(@Param('id') id: string) {
    return this.service.listUsuariosChave(id);
  }

  @Post(':id/usuarios-chave')
  @Roles('ADMIN', 'GESTOR_TI', 'GERENTE_PROJETO')
  addUsuarioChave(@Param('id') id: string, @Body() dto: CreateUsuarioChaveDto) {
    return this.service.addUsuarioChave(id, dto);
  }

  @Delete(':id/usuarios-chave/:ucId')
  @Roles('ADMIN', 'GESTOR_TI', 'GERENTE_PROJETO')
  removeUsuarioChave(@Param('id') id: string, @Param('ucId') ucId: string) {
    return this.service.removeUsuarioChave(id, ucId);
  }

  // --- Pendencias ---

  @Get(':id/pendencias')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO', 'USUARIO_CHAVE')
  listPendencias(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('prioridade') prioridade?: string,
    @Query('responsavelId') responsavelId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.listPendencias(id, { status, prioridade, responsavelId, search }, user!.sub, role!);
  }

  @Post(':id/pendencias')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO', 'USUARIO_CHAVE')
  createPendencia(
    @Param('id') id: string,
    @Body() dto: CreatePendenciaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.createPendencia(id, dto, user.sub, role);
  }

  @Get(':id/pendencias/:pid')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO', 'USUARIO_CHAVE')
  getPendencia(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.getPendencia(id, pid, user.sub, role);
  }

  @Patch(':id/pendencias/:pid')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO', 'USUARIO_CHAVE')
  updatePendencia(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: UpdatePendenciaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.updatePendencia(id, pid, dto, user.sub, role);
  }

  // --- Interacoes Pendencia ---

  @Post(':id/pendencias/:pid/interacoes')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO', 'USUARIO_CHAVE')
  addInteracao(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: CreateInteracaoPendenciaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.addInteracaoPendencia(id, pid, dto, user.sub, role);
  }

  // --- Anexos Pendencia ---

  @Post(':id/pendencias/:pid/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO', 'USUARIO_CHAVE')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: PENDENCIA_UPLOADS_DIR,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  addAnexoPendencia(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    return this.service.addAnexoPendencia(id, pid, file, user.sub, role);
  }

  @Get(':id/pendencias/:pid/anexos/:anexoId/download')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'GERENTE_PROJETO', 'FINANCEIRO', 'USUARIO_CHAVE')
  async downloadAnexoPendencia(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Param('anexoId') anexoId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Res() res: express.Response,
  ) {
    const { anexo, filePath } = await this.service.downloadAnexoPendencia(id, pid, anexoId, user.sub, role);
    res.setHeader('Content-Type', anexo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nomeOriginal)}"`);
    res.sendFile(filePath);
  }

  @Delete(':id/pendencias/:pid/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR_TI', 'GERENTE_PROJETO')
  removeAnexoPendencia(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Param('anexoId') anexoId: string,
  ) {
    return this.service.removeAnexoPendencia(id, pid, anexoId);
  }
}
