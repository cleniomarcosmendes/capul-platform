import { Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { DispensaVinculoDeColaborador } from '../common/decorators/dispensa-colaborador.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { SincronizacaoService, type RelatorioSincronizacao } from './sincronizacao.service.js';

/**
 * Disparo manual da sincronização.
 *
 * ⚠️ NÃO há cron. Quem dispara ainda é decisão do RH em aberto ("RH ou T.I.?"),
 * e a carga é pesada; ligar um agendamento antes dessa resposta seria escolher
 * por eles. Quando vier, é `@Cron` com `timeZone: 'America/Sao_Paulo'`, como nos
 * outros módulos.
 *
 * RBAC: RH_ADMIN (e ADMIN, que tem bypass no RolesGuard). Não é operação de
 * avaliador nem de quem só monta ciclo — mexe no cadastro de todo mundo.
 */
@Controller('sincronizacao')
@Roles(ROLES.RH_ADMIN)
@DispensaVinculoDeColaborador(
  'a sincronização é quem CRIA os colaboradores — na primeira carga não existe ' +
    'nenhum, e exigir vínculo aqui impediria o módulo de sair do zero. Não toca ' +
    'nenhum registro de avaliação.',
)
export class SincronizacaoController {
  constructor(private readonly sincronizacao: SincronizacaoService) {}

  @Post()
  @HttpCode(200)
  executar(@CurrentUser() user: JwtPayload): Promise<RelatorioSincronizacao> {
    return this.sincronizacao.sincronizar(user.sub);
  }
}
