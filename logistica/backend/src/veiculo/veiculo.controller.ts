import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SituacaoVeiculo } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura, podeVerOutrasFiliais } from '../common/filial-scope.js';
import { VeiculoService } from './veiculo.service.js';
import { CreateVeiculoDto, UpdateVeiculoDto } from './dto.js';

@Controller('veiculos')
// Leitura (listar/obter) liberada também ao REGISTRADOR_FROTA — precisa enxergar
// veículos disponíveis pra registrar a saída. ESCRITA (criar/editar/excluir) tem
// @Roles próprio SEM ele (gestão de cadastro é de gestor/admin). PORTARIA também
// lê (listar/obter) p/ escolher o veículo na "Saída pela portaria"; as escritas
// (POST/PATCH/DELETE) têm @Roles próprio SEM PORTARIA.
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
export class VeiculoController {
  constructor(private readonly veiculos: VeiculoService) {}

  /**
   * Equipe do RDV (supervisores de área + coordenadores) da filial, para o cadastro
   * do veículo escolher o REPRESENTANTE responsável.
   *
   * Endpoint próprio em vez de reusar `/supervisor/supervisores`: aquele é do módulo
   * de RDV e barra o gestor de frota de propósito (o RDV é processo interno do setor).
   * Aqui é o inverso — quem cadastra veículo é gestor de frota e precisa da lista, sem
   * ganhar acesso ao RDV. Devolve só matrícula/nome/papel, nada de prestação de contas.
   */
  @Get('representantes')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
  representantes(@CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    // Sem filial resolvida (ADMIN sem informar) não há Equipe a listar — devolve vazio
    // em vez de varrer as 35 filiais.
    return this.veiculos.representantesDaFilial(resolverFilialLeitura(user, filialId) ?? '');
  }

  @Post()
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
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
    @Query('todasFiliais') todasFiliais?: string,
  ) {
    const ehSupFrota = user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role === 'SUPERVISOR_FROTA';
    return this.veiculos.list({
      // Frota é recurso COMPARTILHADO: a saída precisa enxergar veículos livres de
      // qualquer filial/departamento → `todasFiliais=true` ignora o escopo de filial.
      filialId: todasFiliais === 'true' ? undefined : resolverFilialLeitura(user, filialId),
      situacao,
      incluirInativos: incluirInativos === 'true',
      departamentoLotacaoId,
      busca,
      // Supervisor de Departamento é escopado ao(s) seu(s) departamento(s).
      supervisorFrotaUser: ehSupFrota ? user : undefined,
    });
  }

  @Get(':id')
  obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.veiculos.findOne(id, user);
  }

  @Patch(':id')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
  atualizar(@Param('id') id: string, @Body() dto: UpdateVeiculoDto, @CurrentUser() user: JwtPayload) {
    // Quem vê todas as filiais edita veículo de qualquer filial (escopo undefined).
    return this.veiculos.update(id, dto, user.sub, podeVerOutrasFiliais(user) ? undefined : user.filialId);
  }

  /** Inativar veículo (soft-delete). Gestor de frota/entrega/admin. */
  @Delete(':id')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'ADMIN')
  remover(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.veiculos.remove(id, podeVerOutrasFiliais(user) ? undefined : user.filialId);
  }
}
