import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertNotifierModule } from '../alert-notifier/alert-notifier.module';
import { AuditLogRetentionService } from './audit-log-retention.service';
import { AuditLogRetentionController } from './audit-log-retention.controller';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AlertNotifierModule],
  controllers: [AuditLogRetentionController],
  providers: [AuditLogRetentionService],
})
export class AuditLogRetentionModule {}
