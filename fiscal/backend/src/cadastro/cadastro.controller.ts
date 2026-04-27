import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CadastroService } from './cadastro.service.js';

@Controller('cadastro')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class CadastroController {
  constructor(private readonly service: CadastroService) {}

  /**
   * Consulta cadastral pontual via CadConsultaCadastro4 — serve DOIS use cases:
   *
   * 1. **Validação de novo cadastro**: antes de cadastrar um cliente/fornecedor
   *    no Protheus, o operador informa CNPJ + UF aqui. A resposta traz os
   *    dados oficiais do SEFAZ (razão social, IE, CNAE, endereço, situação
   *    cadastral) prontos para preencher o cadastro do ERP. A flag
   *    `jaCadastradoNoProtheus=false` indica que é um contribuinte novo —
   *    NÃO é erro.
   *
   * 2. **Verificação de contribuinte existente**: para ver status atual de
   *    um cliente/fornecedor já cadastrado. A flag `jaCadastradoNoProtheus=true`
   *    e os campos `origemProtheus`/`codigoProtheus`/`lojaProtheus` indicam
   *    o vínculo existente em SA1010 ou SA2010.
   *
   * Em ambos os casos, o contribuinte é persistido em
   * `fiscal.cadastro_contribuinte` + histórico de mudança de situação (se houver).
   */
  @Post('consulta')
  @RoleMinima('OPERADOR_ENTRADA')
  @Throttle({ sefaz: { ttl: 60_000, limit: 20 } })
  async consultar(@Body() body: { cnpj: string; uf?: string | null }) {
    return this.service.consultarPontual(body.cnpj, body.uf ?? null);
  }

  /**
   * Última foto salva do contribuinte (pode ser de qualquer UF).
   */
  @Get(':cnpj')
  @RoleMinima('OPERADOR_ENTRADA')
  async porCnpj(@Param('cnpj') cnpj: string) {
    return this.service.getPorCnpj(cnpj);
  }

  /**
   * Histórico de mudanças de situação.
   */
  @Get(':cnpj/historico')
  @RoleMinima('GESTOR_FISCAL')
  async historico(@Param('cnpj') cnpj: string) {
    return this.service.getHistorico(cnpj);
  }

  @Get('health')
  @RoleMinima('OPERADOR_ENTRADA')
  async health() {
    return { ok: true, modulo: 'cadastro', etapas: [10, 11] };
  }
}
