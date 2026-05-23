import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { CapabilityService } from './capability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfiguradorAdminGuard } from '../presenca/configurador-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  UpdateStatusDto,
  AtribuirPermissaoDto,
} from './dto/create-usuario.dto';
import { ConcederCapabilityDto, type Capability } from './dto/conceder-capability.dto';

@Controller('api/v1/core/usuarios')
@UseGuards(JwtAuthGuard)
export class UsuarioController {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly capabilityService: CapabilityService,
  ) {}

  @Get()
  findAll(@Query('filialId') filialId?: string) {
    return this.usuarioService.findAll(filialId);
  }

  @Get('me/preferencias')
  getMyPreferencias(@CurrentUser('id') userId: string) {
    return this.usuarioService.getPreferencias(userId);
  }

  @Get(':id/preferencias')
  getPreferencias(@Param('id') id: string) {
    return this.usuarioService.getPreferencias(id);
  }

  @Patch(':id/preferencias')
  updatePreferencias(@Param('id') id: string, @Body() patch: Record<string, any>) {
    return this.usuarioService.updatePreferencias(id, patch);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usuarioService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarioService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuarioService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.usuarioService.updateStatus(id, dto.status);
  }

  @Patch(':id/reset-senha')
  resetSenha(@Param('id') id: string, @Body() body: { novaSenha: string }) {
    return this.usuarioService.resetSenha(id, body.novaSenha);
  }

  @Post(':id/permissoes')
  atribuirPermissao(
    @Param('id') id: string,
    @Body() dto: AtribuirPermissaoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usuarioService.atribuirPermissao(id, dto, user);
  }

  @Delete(':id/permissoes/:moduloId')
  revogarPermissao(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    // Workspace Sub-fase 1.6.2 — depto opcional (multi-perfil real).
    // Sem departamentoId: revoga a permissão única (comportamento atual).
    // Com departamentoId: revoga somente o perfil naquele depto.
    return this.usuarioService.revogarPermissao(id, moduloId, departamentoId);
  }

  // --- Capabilities por usuário (LGPD) — só ADMIN do Configurador (D5).
  //     Plano: docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md

  @Get(':id/capabilities')
  @UseGuards(ConfiguradorAdminGuard)
  listarCapabilities(@Param('id') id: string) {
    return this.capabilityService.listar(id);
  }

  @Post(':id/capabilities')
  @UseGuards(ConfiguradorAdminGuard)
  concederCapability(
    @Param('id') id: string,
    @Body() dto: ConcederCapabilityDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.capabilityService.conceder(id, dto.capability, dto.motivo, adminId);
  }

  @Delete(':id/capabilities/:capability')
  @UseGuards(ConfiguradorAdminGuard)
  revogarCapability(
    @Param('id') id: string,
    @Param('capability') capability: Capability,
    @CurrentUser('id') adminId: string,
  ) {
    return this.capabilityService.revogar(id, capability, adminId);
  }
}
