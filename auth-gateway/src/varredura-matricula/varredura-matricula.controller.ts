import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfiguradorAdminGuard } from '../presenca/configurador-admin.guard';
import { VarreduraMatriculaService } from './varredura-matricula.service';

class ConfigVarreduraDto {
  /** Liga o bloqueio automático. Ausente/false = só relata. */
  @IsOptional() @IsBoolean()
  bloquear?: boolean;

  /** Teto de "não encontrados" (%) acima do qual a varredura aborta sem bloquear. */
  @IsOptional() @IsInt() @Min(1) @Max(100)
  tetoPct?: number;
}

/**
 * Tela da varredura no Configurador — "funcionalidade oculta vira tela no
 * Configurador" é regra da casa, e vale em dobro aqui: uma rotina que DESATIVA
 * usuário sozinha não pode ser invisível. O operador precisa ver o resultado da
 * última varredura, quem entrou na lista e em que modo ela está.
 *
 * ⭐ `ConfiguradorAdminGuard` desde o primeiro dia. O `/security-review` de 15/08
 * achou controllers em `/api/v1/core/` com apenas `JwtAuthGuard` — e este decide
 * quem perde acesso à plataforma.
 */
@Controller('api/v1/core/varredura-matricula')
@UseGuards(JwtAuthGuard, ConfiguradorAdminGuard)
export class VarreduraMatriculaController {
  constructor(
    private readonly service: VarreduraMatriculaService,
    private readonly prisma: PrismaService,
  ) {}

  /** Última execução (o que a tela mostra) + configuração atual. */
  @Get('status')
  async status() {
    const [ultima, modo, teto] = await Promise.all([
      this.service.ultimaExecucao(),
      this.prisma.systemConfig.findUnique({ where: { key: 'varredura_matricula_bloquear' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'varredura_matricula_teto_pct' } }),
    ]);
    return {
      modo: modo?.value === 'true' ? 'BLOQUEIO' : 'RELATORIO',
      tetoPct: Number(teto?.value) || 20,
      ultimaExecucao: ultima,
    };
  }

  @Patch('config')
  async configurar(@Body() dto: ConfigVarreduraDto) {
    if (dto.bloquear !== undefined) {
      await this.upsert(
        'varredura_matricula_bloquear', String(dto.bloquear),
        'Varredura de matrículas: true DESATIVA usuários cuja chapa não está no Protheus; false só relata',
      );
    }
    if (dto.tetoPct !== undefined) {
      await this.upsert(
        'varredura_matricula_teto_pct', String(dto.tetoPct),
        'Varredura de matrículas: % de não-encontrados que ABORTA a execução sem bloquear ninguém',
      );
    }
    return this.status();
  }

  /**
   * Roda agora. Devolve o resultado COMPLETO (não dispara em background como o
   * cron de retenção): é assim que se confere a lista antes de ligar o bloqueio.
   */
  @Post('executar')
  @HttpCode(200)
  async executar() {
    return this.service.run();
  }

  private upsert(key: string, value: string, descricao: string) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, categoria: 'seguranca', descricao },
      update: { value },
    });
  }
}
