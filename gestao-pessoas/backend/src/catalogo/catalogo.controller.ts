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
   * ⭐ **`RH_CICLO` LÊ TAMBÉM** — corrigido em 11/09, no mesmo dia em que ficou
   * de fora. Quem monta a Aplicação **escolhe o modelo**, e escolher por nome
   * sem ver o conteúdo é decidir às cegas: ele veria *"Operação de Loja · v1 ·
   * 14 perguntas"* e teria de confiar no rótulo.
   *
   * ⭐ A distinção que resolve, e que vale para o módulo inteiro:
   * **ler o INSTRUMENTO não é ler NOTA.** O que a separação de funções guarda é
   * o julgamento sobre uma pessoa — `/resultados` e a memória de cálculo, que
   * seguem só de `RH_ADMIN` e com `LER_RESULTADO_INDIVIDUAL` na auditoria. O
   * questionário em branco não é dado de ninguém: é a régua, e quem monta o
   * ciclo precisa dela na mão.
   *
   * Sobram de fora `AVALIADOR` e quem não tem o módulo — que é o certo: o
   * avaliador vê as perguntas ao responder, uma avaliação por vez.
   *
   * ⚠️ Fica junto de `modelos` de propósito: são a lista e o item da mesma coisa.
   */
  @Get('modelos/:versaoId')
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
