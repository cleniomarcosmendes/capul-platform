import { Controller, Get, Query } from '@nestjs/common';
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
