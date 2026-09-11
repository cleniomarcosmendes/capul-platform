import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { CatalogoService } from './catalogo.service.js';

export class BuscaColaboradorDto {
  @IsOptional() @IsString() @MaxLength(60) busca?: string;
}

/**
 * Listas de apoio das telas do RH. Leitura pura — por isso RH_MODELO também
 * entra: quem monta o instrumento precisa ver o catálogo de critérios, mesmo
 * sem poder montar ciclo nem designar.
 */
@Controller('catalogo')
@Roles(ROLES.RH_ADMIN, ROLES.RH_CICLO, ROLES.RH_MODELO)
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('modelos') modelos() {
    return this.catalogo.modelos();
  }

  /**
   * ⭐ O INSTRUMENTO INTEIRO — grupos, perguntas, pesos e alternativas.
   *
   * Existe para uma pergunta que estava travando o resto: *"o questionário
   * atual é o que você quer usar?"*. As 44 perguntas vieram transcritas do
   * RD8010 e **ninguém do RH escolheu enunciado, peso ou alternativa** — e até
   * aqui não havia como ler o texto delas: `modelos()` devolve `perguntas: 11`,
   * uma contagem. A decisão não tinha como ser tomada.
   *
   * ⚠️ `RH_CICLO` fica de fora, por decisão de 11/09. Ele escolhe o modelo ao
   * montar a Aplicação e continua vendo a LISTA (`GET modelos`) — o conteúdo é
   * de quem responde pelo instrumento. Se o RH disser que quem monta o ciclo
   * também precisa conferir o que vai aplicar, é acrescentar uma constante aqui.
   *
   * ⚠️ Vem ANTES de nenhuma rota curinga, mas fica junto de `modelos` de
   * propósito: são a lista e o item da mesma coisa.
   */
  @Get('modelos/:versaoId') @Roles(ROLES.RH_ADMIN, ROLES.RH_MODELO)
  instrumento(@Param('versaoId') versaoId: string) {
    return this.catalogo.instrumento(versaoId);
  }

  @Get('criterios') criterios() {
    return this.catalogo.criterios();
  }

  @Get('centros-custo') centrosDeCusto() {
    return this.catalogo.centrosDeCusto();
  }

  @Get('colaboradores') colaboradores(@Query() dto: BuscaColaboradorDto) {
    return this.catalogo.colaboradores(dto.busca);
  }
}
