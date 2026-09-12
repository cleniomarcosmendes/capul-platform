import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { AcervoService } from './acervo.service.js';

/**
 * O ACERVO — as questões que existem, e onde cada uma é usada.
 *
 * ⭐ Mesmos papéis da leitura do instrumento (`/catalogo/modelos/:id`), e pela
 * mesma razão escrita lá: **ler o instrumento não é ler NOTA**. O questionário
 * em branco é a régua, e quem monta ciclo ou modelo precisa dela na mão.
 * `AVALIADOR` fica de fora — ele vê as perguntas ao responder, uma por vez.
 */
@Controller('acervo')
@Roles(ROLES.RH_ADMIN, ROLES.RH_MODELO, ROLES.RH_CICLO)
export class AcervoController {
  constructor(private readonly acervo: AcervoService) {}

  @Get() listar() {
    return this.acervo.listar();
  }
}
