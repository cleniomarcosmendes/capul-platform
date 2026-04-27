import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { BackupExecucaoService } from './backup-execucao.service';
import { DrConfig, DrConfigService } from './dr-config.service';
import { DrTestService } from './dr-test.service';

interface RegistrarExecucaoDto {
  tipo: string;
  status: 'SUCESSO' | 'FALHA' | 'EM_ANDAMENTO';
  iniciadoEm?: string;
  finalizadoEm?: string;
  duracaoMs?: number;
  tamanhoBytes?: number;
  hostname?: string;
  destino?: string;
  cifrado?: boolean;
  mensagem?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Endpoints publicos do Configurador (autenticados via JWT) — listagem,
 * detalhe, status atual de Backup/DR.
 *
 * Auditoria 26/04/2026 Sprint 4 — visibilidade no Configurador.
 */
@Controller('api/v1/core/backup/execucoes')
@UseGuards(JwtAuthGuard)
export class BackupExecucaoController {
  constructor(
    private readonly service: BackupExecucaoService,
    private readonly drConfig: DrConfigService,
    private readonly drTest: DrTestService,
  ) {}

  @Get('config')
  getConfig() {
    return this.drConfig.get();
  }

  @Patch('config')
  updateConfig(@Body() patch: Partial<DrConfig>) {
    return this.drConfig.update(patch);
  }

  @Post('test/webhook')
  testWebhook() {
    return this.drTest.testWebhook();
  }

  @Post('test/email')
  testEmail() {
    return this.drTest.testEmail();
  }

  @Post('test/s3')
  testS3() {
    return this.drTest.testS3();
  }

  @Get('comando/executar-backup')
  comandoExecutarBackup() {
    return this.drTest.comandoExecutarBackup();
  }

  @Get('comando/dr-test')
  comandoDrTest() {
    return this.drTest.comandoDrTest();
  }

  @Get()
  listar(
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.service.listar({ take, status });
  }

  @Get('status')
  status() {
    return this.service.statusAtual();
  }

  @Get(':id')
  detalhe(@Param('id') id: string) {
    return this.service.detalhe(id);
  }
}

/**
 * Endpoint INTERNO — chamado pelo `scripts/backup.sh` apos cada execucao.
 *
 * Acesso bloqueado externamente via Nginx (`/api/v1/internal/` → 403). Marcado
 * `@Public()` para nao exigir JWT (script roda como root no host, sem token).
 */
@Public()
@Controller('api/v1/internal/backup')
export class BackupExecucaoInternalController {
  constructor(private readonly service: BackupExecucaoService) {}

  @Post('execucao')
  registrar(@Body() dto: RegistrarExecucaoDto) {
    return this.service.registrar(dto);
  }
}
