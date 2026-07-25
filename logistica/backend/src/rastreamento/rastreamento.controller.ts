import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RastreamentoService } from './rastreamento.service.js';
import { RastreamentoPurgaService } from './rastreamento-purga.service.js';
import { RegistrarPosicaoDto } from './dto.js';

@Controller('rastreamento')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
export class RastreamentoController {
  constructor(
    private readonly rastreamento: RastreamentoService,
    private readonly purga: RastreamentoPurgaService,
  ) {}

  /** App envia um ping de GPS da viagem em curso (foreground). Quem dirige/entrega
   *  manda a própria posição: inclui os logins de campo ENTREGADOR (entregas) e
   *  REGISTRADOR_FROTA (frota), além dos operadores/gestores. */
  @Post('posicao')
  @Roles('ENTREGADOR', 'REGISTRADOR_FROTA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
  registrar(@Body() dto: RegistrarPosicaoDto, @CurrentUser() user: JwtPayload) {
    return this.rastreamento.registrar(dto, user);
  }

  /** Mapa ao vivo: últimas posições das viagens em curso da filial. Gestores +
   *  Operador de Entrega — é o operador que atende o cliente no telefone e precisa
   *  dizer onde a entrega está. Sempre escopado à filial do usuário. */
  @Get('ativos')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
  ativos(@CurrentUser() user: JwtPayload) {
    return this.rastreamento.ativos(user.filialId!);
  }

  /** Política/estatísticas do rastreamento — alimenta a tela do Configurador
   *  (orientação + config + histórico). Retenção + tamanho do trail. */
  @Get('config')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  async config() {
    const stats = await this.rastreamento.estatisticas();
    return { retencaoDias: this.purga.diasRetencao, ...stats };
  }

  /** Dispara a purga de retenção manualmente (a automática roda todo dia 03:30).
   *  Transparência LGPD — gestor consegue rodar e ver quantas posições saíram. */
  @Post('purga')
  @Roles('GESTOR_FROTA')
  async purgar() {
    const removidas = await this.purga.purgar();
    return { removidas, retencaoDias: this.purga.diasRetencao };
  }
}
