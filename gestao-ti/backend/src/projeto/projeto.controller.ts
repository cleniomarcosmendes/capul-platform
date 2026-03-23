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
import * as fs from 'fs';
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
import { CreateTerceirizadoDto, UpdateTerceirizadoDto } from './dto/create-terceirizado.dto';
import { CreatePendenciaDto } from './dto/create-pendencia.dto';
import { UpdatePendenciaDto } from './dto/update-pendencia.dto';
import { CreateInteracaoPendenciaDto } from './dto/create-interacao-pendencia.dto';

const PROJETO_UPLOADS_DIR = path.resolve('./uploads/projetos');
if (!fs.existsSync(PROJETO_UPLOADS_DIR)) {
  fs.mkdirSync(PROJETO_UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
];

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
    @GestaoTiRole() role?: string,
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
      role,
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

  @Get('meus-projetos-terceirizado')
  @Roles('TERCEIRIZADO')
  meusProjetosTerceirizado(@CurrentUser() user: JwtPayload) {
    return this.service.meusProjetosTerceirizado(user.sub);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.findOne(id, user?.sub, role);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  create(@Body() dto: CreateProjetoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async update(@Param('id') id: string, @Body() dto: UpdateProjetoDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/duplicar')
  @Roles('ADMIN', 'GESTOR_TI')
  duplicar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.duplicar(id, user.sub);
  }

  // --- Membros ---

  @Get(':id/membros')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
  listMembros(@Param('id') id: string) {
    return this.service.listMembros(id);
  }

  @Post(':id/membros')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addMembro(@Param('id') id: string, @Body() dto: CreateMembroDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addMembro(id, dto);
  }

  @Delete(':id/membros/:membroId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async removeMembro(@Param('id') id: string, @Param('membroId') membroId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeMembro(id, membroId);
  }

  // --- Fases ---

  @Get(':id/fases')
  listFases(@Param('id') id: string) {
    return this.service.listFases(id);
  }

  @Post(':id/fases')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addFase(@Param('id') id: string, @Body() dto: CreateFaseDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addFase(id, dto);
  }

  @Patch(':id/fases/:faseId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async updateFase(
    @Param('id') id: string,
    @Param('faseId') faseId: string,
    @Body() dto: UpdateFaseDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.updateFase(id, faseId, dto);
  }

  @Delete(':id/fases/:faseId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async removeFase(@Param('id') id: string, @Param('faseId') faseId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeFase(id, faseId);
  }

  // --- Atividades ---

  @Get(':id/atividades')
  listAtividades(@Param('id') id: string) {
    return this.service.listAtividades(id);
  }

  @Post(':id/atividades')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addAtividade(
    @Param('id') id: string,
    @Body() dto: { titulo: string; descricao?: string; faseId?: string; pendenciaId?: string; dataInicio?: string; dataFimPrevista?: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addAtividade(id, dto, user.sub);
  }

  @Post(':id/pendencias/:pendenciaId/gerar-atividade')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async gerarAtividadeFromPendencia(
    @Param('id') id: string,
    @Param('pendenciaId') pendenciaId: string,
    @Body() dto: { titulo?: string; descricao?: string; dataFimPrevista?: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.gerarAtividadeFromPendencia(id, pendenciaId, dto, user.sub);
  }

  @Patch(':id/atividades/:atividadeId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async updateAtividade(
    @Param('id') id: string,
    @Param('atividadeId') atividadeId: string,
    @Body() dto: { titulo?: string; descricao?: string; faseId?: string; status?: string; dataInicio?: string; dataFimPrevista?: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.updateAtividade(id, atividadeId, dto);
  }

  @Delete(':id/atividades/:atividadeId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async removeAtividade(@Param('id') id: string, @Param('atividadeId') atividadeId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeAtividade(id, atividadeId);
  }

  // --- Comentarios de Tarefa ---

  @Get(':id/atividades/:atividadeId/comentarios')
  listComentarios(@Param('id') id: string, @Param('atividadeId') atividadeId: string) {
    return this.service.listComentarios(id, atividadeId);
  }

  @Post(':id/atividades/:atividadeId/comentarios')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addComentario(
    @Param('id') id: string,
    @Param('atividadeId') atividadeId: string,
    @Body() body: { texto: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addComentario(id, atividadeId, body.texto, user.sub);
  }

  @Delete(':id/comentarios/:comentarioId')
  async removeComentario(
    @Param('id') id: string,
    @Param('comentarioId') comentarioId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeComentario(id, comentarioId, user.sub, role);
  }

  @Patch(':id/comentarios/:comentarioId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async updateComentario(
    @Param('id') id: string,
    @Param('comentarioId') comentarioId: string,
    @Body() body: { texto: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.updateComentario(id, comentarioId, body.texto, user.sub, role);
  }

  // --- Registro de Tempo ---

  @Get(':id/atividades/:atividadeId/registros-tempo')
  listRegistrosTempo(@Param('id') id: string, @Param('atividadeId') atividadeId: string) {
    return this.service.listarRegistrosTempo(id, atividadeId);
  }

  @Post(':id/atividades/:atividadeId/iniciar')
  async iniciarTempo(@Param('id') id: string, @Param('atividadeId') atividadeId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.iniciarRegistroTempo(id, atividadeId, user.sub);
  }

  @Post(':id/atividades/:atividadeId/encerrar')
  async encerrarTempo(@Param('id') id: string, @Param('atividadeId') atividadeId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.encerrarRegistroTempo(id, atividadeId, user.sub);
  }

  @Get(':id/registro-ativo')
  registroAtivo(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.obterRegistroAtivo(id, user.sub);
  }

  @Patch(':id/registros-tempo/:registroId')
  async ajustarRegistroTempo(
    @Param('id') id: string,
    @Param('registroId') registroId: string,
    @Body() dto: UpdateRegistroTempoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.ajustarRegistroTempo(id, registroId, dto, user.sub, role);
  }

  @Delete(':id/registros-tempo/:registroId')
  async removerRegistroTempo(
    @Param('id') id: string,
    @Param('registroId') registroId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removerRegistroTempo(id, registroId, user.sub, role);
  }

  // --- Chamados (vincular/desvincular) ---

  @Post(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async vincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.vincularChamado(id, chamadoId);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async desvincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.desvincularChamado(id, chamadoId);
  }

  // --- Cotacoes ---

  @Get(':id/cotacoes')
  listCotacoes(@Param('id') id: string) {
    return this.service.listCotacoes(id);
  }

  @Post(':id/cotacoes')
  @Roles('ADMIN', 'GESTOR_TI')
  async addCotacao(@Param('id') id: string, @Body() dto: CreateCotacaoDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addCotacao(id, dto);
  }

  @Patch(':id/cotacoes/:cotacaoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async updateCotacao(
    @Param('id') id: string,
    @Param('cotacaoId') cotacaoId: string,
    @Body() dto: CreateCotacaoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.updateCotacao(id, cotacaoId, dto);
  }

  @Delete(':id/cotacoes/:cotacaoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async removeCotacao(@Param('id') id: string, @Param('cotacaoId') cotacaoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeCotacao(id, cotacaoId);
  }

  // --- Custos Detalhados ---

  @Get(':id/custos-detalhados')
  listCustosDetalhados(@Param('id') id: string) {
    return this.service.listCustosDetalhados(id);
  }

  @Post(':id/custos-detalhados')
  @Roles('ADMIN', 'GESTOR_TI')
  async addCusto(@Param('id') id: string, @Body() dto: CreateCustoDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addCusto(id, dto);
  }

  @Patch(':id/custos-detalhados/:custoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async updateCusto(
    @Param('id') id: string,
    @Param('custoId') custoId: string,
    @Body() dto: CreateCustoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.updateCusto(id, custoId, dto);
  }

  @Delete(':id/custos-detalhados/:custoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async removeCusto(@Param('id') id: string, @Param('custoId') custoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeCusto(id, custoId);
  }

  // --- Riscos ---

  @Get(':id/riscos')
  listRiscos(@Param('id') id: string) {
    return this.service.listRiscos(id);
  }

  @Post(':id/riscos')
  @Roles('ADMIN', 'GESTOR_TI')
  async addRisco(@Param('id') id: string, @Body() dto: CreateRiscoDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addRisco(id, dto);
  }

  @Patch(':id/riscos/:riscoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async updateRisco(
    @Param('id') id: string,
    @Param('riscoId') riscoId: string,
    @Body() dto: CreateRiscoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.updateRisco(id, riscoId, dto);
  }

  @Delete(':id/riscos/:riscoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async removeRisco(@Param('id') id: string, @Param('riscoId') riscoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeRisco(id, riscoId);
  }

  // --- Dependencias ---

  @Get(':id/dependencias')
  listDependencias(@Param('id') id: string) {
    return this.service.listDependencias(id);
  }

  @Post(':id/dependencias')
  @Roles('ADMIN', 'GESTOR_TI')
  async addDependencia(@Param('id') id: string, @Body() dto: CreateDependenciaDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addDependencia(id, dto);
  }

  @Delete(':id/dependencias/:depId')
  @Roles('ADMIN', 'GESTOR_TI')
  async removeDependencia(@Param('id') id: string, @Param('depId') depId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeDependencia(id, depId);
  }

  // --- Anexos ---

  @Get(':id/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  listAnexos(@Param('id') id: string) {
    return this.service.listAnexos(id);
  }

  @Post(':id/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addAnexo(
    @Param('id') id: string,
    @Body() dto: CreateAnexoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addAnexo(id, dto, user.sub);
  }

  @Post(':id/anexos/upload')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: PROJETO_UPLOADS_DIR,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        return cb(new BadRequestException('Tipo de arquivo nao permitido'), false);
      }
      cb(null, true);
    },
  }))
  async uploadAnexo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Body('descricao') descricao?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.uploadAnexo(id, file, user.sub, descricao);
  }

  @Get(':id/anexos/:anexoId/download')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async downloadAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @Res() res: express.Response,
  ) {
    const { filePath, anexo } = await this.service.getAnexoFile(id, anexoId);
    res.setHeader('Content-Type', anexo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nomeOriginal || anexo.titulo)}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Delete(':id/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async removeAnexo(@Param('id') id: string, @Param('anexoId') anexoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeAnexo(id, anexoId);
  }

  // --- Apontamento de Horas ---

  @Get(':id/apontamentos')
  listApontamentos(@Param('id') id: string) {
    return this.service.listApontamentos(id);
  }

  @Post(':id/apontamentos')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addApontamento(
    @Param('id') id: string,
    @Body() dto: CreateApontamentoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addApontamento(id, dto, user.sub);
  }

  @Delete(':id/apontamentos/:apontamentoId')
  @Roles('ADMIN', 'GESTOR_TI')
  async removeApontamento(
    @Param('id') id: string,
    @Param('apontamentoId') apontamentoId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
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
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
  listUsuariosChave(@Param('id') id: string) {
    return this.service.listUsuariosChave(id);
  }

  @Post(':id/usuarios-chave')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addUsuarioChave(@Param('id') id: string, @Body() dto: CreateUsuarioChaveDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addUsuarioChave(id, dto);
  }

  @Delete(':id/usuarios-chave/:ucId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async removeUsuarioChave(@Param('id') id: string, @Param('ucId') ucId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeUsuarioChave(id, ucId);
  }

  // --- Terceirizados ---

  @Get(':id/terceirizados')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  listTerceirizados(@Param('id') id: string) {
    return this.service.listTerceirizados(id);
  }

  @Post(':id/terceirizados')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async addTerceirizado(@Param('id') id: string, @Body() dto: CreateTerceirizadoDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.addTerceirizado(id, {
      ...dto,
      dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
      dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
    });
  }

  @Patch(':id/terceirizados/:tercId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async updateTerceirizado(
    @Param('id') id: string,
    @Param('tercId') tercId: string,
    @Body() dto: UpdateTerceirizadoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.updateTerceirizado(id, tercId, {
      ...dto,
      dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
      dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
    });
  }

  @Delete(':id/terceirizados/:tercId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async removeTerceirizado(@Param('id') id: string, @Param('tercId') tercId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    await this.service.assertMembroOuGestor(id, user.sub, role);
    return this.service.removeTerceirizado(id, tercId);
  }

  // --- Pendencias ---

  @Get(':id/pendencias')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
  listPendencias(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('prioridade') prioridade?: string,
    @Query('responsavelId') responsavelId?: string,
    @Query('search') search?: string,
    @Query('incluirSubProjetos') incluirSubProjetos?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.listPendencias(id, { status, prioridade, responsavelId, search, incluirSubProjetos: incluirSubProjetos === 'true' }, user!.sub, role!);
  }

  @Post(':id/pendencias')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
  createPendencia(
    @Param('id') id: string,
    @Body() dto: CreatePendenciaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.createPendencia(id, dto, user.sub, role);
  }

  @Get(':id/pendencias/:pid')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
  getPendencia(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.getPendencia(id, pid, user.sub, role);
  }

  @Patch(':id/pendencias/:pid')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
  addInteracao(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: CreateInteracaoPendenciaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.addInteracaoPendencia(id, pid, dto, user.sub, role);
  }

  @Patch(':id/pendencias/:pid/interacoes/:iid')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
  editarInteracao(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Param('iid') iid: string,
    @Body() body: { descricao: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.editarInteracaoPendencia(id, pid, iid, body.descricao, user.sub, role);
  }

  // --- Anexos Pendencia ---

  @Post(':id/pendencias/:pid/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI', 'USUARIO_CHAVE', 'TERCEIRIZADO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  removeAnexoPendencia(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Param('anexoId') anexoId: string,
  ) {
    return this.service.removeAnexoPendencia(id, pid, anexoId);
  }
}
