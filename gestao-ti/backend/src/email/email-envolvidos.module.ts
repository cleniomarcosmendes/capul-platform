import { Module } from '@nestjs/common';
import { EmailEnvolvidosService } from './email-envolvidos.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [EmailEnvolvidosService],
  exports: [EmailEnvolvidosService],
})
export class EmailEnvolvidosModule {}
