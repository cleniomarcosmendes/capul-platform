import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { DespesaService } from './despesa.service.js';
import {
  CriarTipoDespesaDto, AtualizarTipoDespesaDto, LancarDespesaDto,
  LancarDespesaCondutorDto, ContestarDespesaDto, ListarDespesasQuery,
} from './dto.js';

const roleLogistica = (user: JwtPayload) => user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;

// Controle de acesso real (gestor x supervisor) é enforced no service; o @Roles
// aqui só barra quem não opera frota. ADMIN sempre passa (RolesGuard).
@Controller('despesas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
export class DespesaController {
  constructor(private readonly despesas: DespesaService) {}

  // ---- Tipos de despesa ----
  @Get('tipos')
  listarTipos(@Query('ativos') ativos?: string) {
    return this.despesas.listarTipos(ativos === 'true' || ativos === '1');
  }

  @Post('tipos')
  @Roles('GESTOR_FROTA')
  criarTipo(@Body() dto: CriarTipoDespesaDto) {
    return this.despesas.criarTipo(dto);
  }

  @Patch('tipos/:id')
  @Roles('GESTOR_FROTA')
  atualizarTipo(@Param('id') id: string, @Body() dto: AtualizarTipoDespesaDto) {
    return this.despesas.atualizarTipo(id, dto);
  }

  // ---- Despesas ----
  @Get()
  listar(@CurrentUser() user: JwtPayload, @Query() q: ListarDespesasQuery) {
    return this.despesas.listar(user, roleLogistica(user), q);
  }

  @Get('indicadores')
  indicadores(@CurrentUser() user: JwtPayload, @Query('mes') mes: string, @Query('ano') ano: string) {
    const now = new Date();
    return this.despesas.indicadores(user, roleLogistica(user), Number(mes) || now.getUTCMonth() + 1, Number(ano) || now.getUTCFullYear());
  }

  /** Lançamento direto (supervisor/gestor) → APROVADA. */
  @Post()
  lancarDireto(@Body() dto: LancarDespesaDto, @CurrentUser() user: JwtPayload) {
    return this.despesas.lancarDireto(dto, user, roleLogistica(user));
  }

  /** Lançamento pelo condutor durante a viagem (matrícula+senha) → PENDENTE. */
  @Post('viagem')
  lancarPorCondutor(@Body() dto: LancarDespesaCondutorDto, @CurrentUser() user: JwtPayload) {
    return this.despesas.lancarPorCondutor(dto, user);
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.despesas.aprovar(id, user, roleLogistica(user));
  }

  @Patch(':id/contestar')
  contestar(@Param('id') id: string, @Body() dto: ContestarDespesaDto, @CurrentUser() user: JwtPayload) {
    return this.despesas.contestar(id, dto, user, roleLogistica(user));
  }
}
