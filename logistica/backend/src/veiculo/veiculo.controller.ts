import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SituacaoVeiculo } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura } from '../common/filial-scope.js';
import { VeiculoService } from './veiculo.service.js';
import { CreateVeiculoDto, UpdateVeiculoDto } from './dto.js';

@Controller('veiculos')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class VeiculoController {
  constructor(private readonly veiculos: VeiculoService) {}

  @Post()
  criar(@Body() dto: CreateVeiculoDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.veiculos.create(dto, user.sub);
  }

  @Get()
  listar(
    @CurrentUser() user: JwtPayload,
    @Query('filialId') filialId?: string,
    @Query('situacao') situacao?: SituacaoVeiculo,
    @Query('incluirInativos') incluirInativos?: string,
  ) {
    return this.veiculos.list({ filialId: resolverFilialLeitura(user, filialId), situacao, incluirInativos: incluirInativos === 'true' });
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.veiculos.findOne(id);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateVeiculoDto, @CurrentUser() user: JwtPayload) {
    return this.veiculos.update(id, dto, user.sub, user.filialId);
  }

  @Delete(':id')
  remover(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.veiculos.remove(id, user.filialId);
  }
}
