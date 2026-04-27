import { Module } from '@nestjs/common';
import {
  BackupExecucaoController,
  BackupExecucaoInternalController,
} from './backup-execucao.controller';
import { BackupExecucaoService } from './backup-execucao.service';
import { DrConfigService } from './dr-config.service';
import { DrTestService } from './dr-test.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BackupExecucaoController, BackupExecucaoInternalController],
  providers: [BackupExecucaoService, DrConfigService, DrTestService],
})
export class BackupExecucaoModule {}
