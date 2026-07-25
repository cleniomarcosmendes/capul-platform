import { Controller, Get, Param, Query, StreamableFile, Header } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { resolverFilialLeitura, assertPodeVerRegistro } from '../common/filial-scope.js';
import { CofreService } from './cofre.service.js';

/**
 * Consulta de comprovante p/ o financeiro/cobrança (Fase 1b — PR 1b.4).
 * Read-only: a prova lastreia a cobrança a prazo, então quem cobra precisa
 * conseguir puxá-la por matrícula/cupom/nº de entrega.
 *
 * Acesso: GESTOR_ENTREGA + OPERADOR_ENTREGA (ADMIN sempre). O operador atende o
 * cliente no telefone e precisa confirmar a entrega e quem recebeu — o menu e a
 * busca (/entregas/baixadas) já eram dele, só o cofre ficava para trás: a tela
 * listava e dava 403 no clique. Escopo de filial vale para todos
 * (assertPodeVerRegistro). O cofre é append-only — não há rota de escrita aqui.
 */
@Controller('comprovantes')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class ComprovanteController {
  constructor(private readonly cofre: CofreService) {}

  /** Busca por matrícula/cupom/nº de entrega (lastro), escopada por filial. */
  @Get()
  buscar(
    @CurrentUser() user: JwtPayload,
    @Query('matricula') matricula?: string,
    @Query('cupom') cupom?: string,
    @Query('entregaNumero') entregaNumero?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.cofre.buscar({
      matricula: matricula?.trim() || undefined,
      cupom: cupom?.trim() || undefined,
      entregaNumero: entregaNumero ? Number(entregaNumero) : undefined,
      filialId: resolverFilialLeitura(user, filialId) ?? undefined,
    });
  }

  /**
   * Comprovantes de uma entrega específica (uma entrega pode ter foto E
   * assinatura). Filtra pela filial do usuário: sem isso qualquer papel da
   * lista conseguia ler a prova de outra filial sabendo o entregaId.
   */
  @Get('por-entrega/:entregaId')
  async porEntrega(@Param('entregaId') entregaId: string, @CurrentUser() user: JwtPayload) {
    const provas = await this.cofre.obterPorEntrega(entregaId);
    return provas.filter((p) => {
      try {
        assertPodeVerRegistro(user, p.filialId);
        return true;
      } catch {
        return false;
      }
    });
  }

  /** Metadados de um comprovante (sem o binário). */
  @Get(':id')
  async obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const meta = await this.cofre.obterMetadado(id);
    assertPodeVerRegistro(user, meta.filialId);
    return meta;
  }

  /** Baixa o binário da prova (download do arquivo). */
  @Get(':id/arquivo')
  @Header('Cache-Control', 'private, no-store')
  async arquivo(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    const meta = await this.cofre.obterMetadado(id);
    assertPodeVerRegistro(user, meta.filialId);
    const { buffer, mimeType } = await this.cofre.obterBinario(id);
    return new StreamableFile(buffer, { type: mimeType, disposition: `inline; filename="comprovante-${id}"` });
  }
}
