import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { CriterioService } from './criterio.service.js';
import { DistribuicaoService } from './distribuicao.service.js';
import { CriterioDto, FaixasDto } from './criterio.dto.js';

/**
 * Cadastro do CATÁLOGO de critérios — o primeiro caminho de escrita dele.
 *
 * ⭐ Só `RH_ADMIN`. Diferente de LER o catálogo (que `RH_MODELO` e `RH_CICLO`
 * também fazem, porque escolher critério para uma aplicação exige ver a lista),
 * MEXER no critério muda a régua de todos os ciclos que o usarem — é a mesma
 * autoridade de publicar modelo, não a de montar um.
 */
@Controller('criterios')
@Roles(ROLES.RH_ADMIN)
export class CriterioController {
  constructor(
    private readonly criterios: CriterioService,
    private readonly distribuicoes: DistribuicaoService,
  ) {}

  /** Os `codigoCalculo` que existem, para o `<select>`. Nunca campo de texto. */
  @Get('resolvers') resolvers() {
    return this.criterios.resolvers();
  }

  @Get() listar() {
    return this.criterios.listar();
  }

  /**
   * ⭐ Quantas pessoas cada faixa cobre HOJE — quem mexe precisa ver o tamanho
   * antes de mexer. Apagar a faixa do código 45 de ESCOLARIDADE tira 480
   * pessoas da conta, e nada avisava até a apuração.
   *
   * Rota separada da listagem de propósito: varre a população inteira (~1.000
   * pessoas com histórico funcional), e pendurá-la na lista faria toda abertura
   * de tela pagar por um dado que só interessa a quem abriu as faixas.
   */
  @Get(':id/distribuicao') distribuicao(@Param('id') id: string) {
    return this.distribuicoes.doCriterio(id);
  }

  @Post() criar(@Body() dto: CriterioDto, @CurrentUser() u: JwtPayload) {
    return this.criterios.criar(dto, u.sub);
  }

  @Patch(':id') atualizar(
    @Param('id') id: string,
    @Body() dto: CriterioDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.criterios.atualizar(id, dto, u.sub);
  }

  /**
   * ⭐ Conferência sem gravar — a tela mostra a recusa ANTES do clique chamando
   * a MESMA função que o `PUT` chama. Não é uma segunda implementação da regra.
   */
  @Post(':id/faixas/conferir') conferirFaixas(@Param('id') id: string, @Body() dto: FaixasDto) {
    return this.criterios.conferirFaixas(id, dto);
  }

  /** PUT porque substitui o conjunto inteiro — ver `salvarFaixas`. */
  @Put(':id/faixas') salvarFaixas(
    @Param('id') id: string,
    @Body() dto: FaixasDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.criterios.salvarFaixas(id, dto, u.sub);
  }
}
