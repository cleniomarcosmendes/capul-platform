import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SituacaoVeiculo } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura, podeVerOutrasFiliais } from '../common/filial-scope.js';
import { VeiculoService } from './veiculo.service.js';
import { CreateVeiculoDto, UpdateVeiculoDto } from './dto.js';

@Controller('veiculos')
// Cadastro/gestão de veículo é tarefa de frota: GESTOR_FROTA incluído.
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
export class VeiculoController {
  constructor(private readonly veiculos: VeiculoService) {}

  @Post()
  criar(@Body() dto: CreateVeiculoDto, @CurrentUser() user: JwtPayload) {
    // Gestor de frota/entrega/admin cadastra em qualquer filial; operador só na própria.
    if (!podeVerOutrasFiliais(user)) assertMesmaFilial(user, dto.filialId);
    return this.veiculos.create(dto, user.sub);
  }

  @Get()
  listar(
    @CurrentUser() user: JwtPayload,
    @Query('filialId') filialId?: string,
    @Query('situacao') situacao?: SituacaoVeiculo,
    @Query('incluirInativos') incluirInativos?: string,
    @Query('departamentoLotacaoId') departamentoLotacaoId?: string,
    @Query('busca') busca?: string,
  ) {
    return this.veiculos.list({
      filialId: resolverFilialLeitura(user, filialId),
      situacao,
      incluirInativos: incluirInativos === 'true',
      departamentoLotacaoId,
      busca,
    });
  }

  @Get(':id')
  obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.veiculos.findOne(id, user);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateVeiculoDto, @CurrentUser() user: JwtPayload) {
    // Quem vê todas as filiais edita veículo de qualquer filial (escopo undefined).
    return this.veiculos.update(id, dto, user.sub, podeVerOutrasFiliais(user) ? undefined : user.filialId);
  }

  @Delete(':id')
  remover(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.veiculos.remove(id, podeVerOutrasFiliais(user) ? undefined : user.filialId);
  }
}
