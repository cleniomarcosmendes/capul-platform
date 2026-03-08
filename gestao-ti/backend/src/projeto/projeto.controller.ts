import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjetoService } from './projeto.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
  ) {
    return this.service.findAll({
      status,
      tipo,
      modo,
      softwareId,
      contratoId,
      search,
      apenasRaiz,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI')
  create(@Body() dto: CreateProjetoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI')
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
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  addAtividade(
    @Param('id') id: string,
    @Body() dto: { titulo: string; descricao?: string; faseId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addAtividade(id, dto, user.sub);
  }

  @Patch(':id/atividades/:atividadeId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  updateAtividade(
    @Param('id') id: string,
    @Param('atividadeId') atividadeId: string,
    @Body() dto: { titulo?: string; descricao?: string; faseId?: string; status?: string },
  ) {
    return this.service.updateAtividade(id, atividadeId, dto);
  }

  @Delete(':id/atividades/:atividadeId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  removeAtividade(@Param('id') id: string, @Param('atividadeId') atividadeId: string) {
    return this.service.removeAtividade(id, atividadeId);
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
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  vincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string) {
    return this.service.vincularChamado(id, chamadoId);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
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
}
