import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { DepartamentoFuncionalidadeService } from './departamento-funcionalidade.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfiguradorAdminGuard } from '../presenca/configurador-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateFuncionalidadesDto } from './dto/update-funcionalidades.dto';

/**
 * Workspace Multi-Departamento (Onda 1 Sub-fase 1.6.2).
 * Endpoints REST pra ADMIN ativar/desativar funcionalidades por departamento.
 */
@Controller('api/v1/core/departamentos/:departamentoId/funcionalidades')
@UseGuards(JwtAuthGuard, ConfiguradorAdminGuard)
export class DepartamentoFuncionalidadeController {
  constructor(
    private readonly service: DepartamentoFuncionalidadeService,
  ) {}

  /**
   * Lista TODAS as 12 funcionalidades com status (ativo true/false) pro depto.
   * Funcionalidades nunca ativadas retornam `ativo: false`.
   */
  @Get()
  listar(@Param('departamentoId') departamentoId: string) {
    return this.service.listarPorDepto(departamentoId);
  }

  /**
   * Bulk update. Body: { funcionalidades: [{ funcionalidade, ativo }, ...] }
   * Persiste audit (ativado_por / desativado_por) baseado no admin logado.
   */
  @Patch()
  atualizar(
    @Param('departamentoId') departamentoId: string,
    @Body() dto: UpdateFuncionalidadesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.atualizar(departamentoId, dto, userId);
  }
}
