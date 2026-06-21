import { Module } from '@nestjs/common';
import { SacTemplateController } from './sac-template.controller.js';
import { SacTemplateService } from './sac-template.service.js';

/** SAC 4b — respostas prontas (templates). PrismaModule é @Global. */
@Module({
  controllers: [SacTemplateController],
  providers: [SacTemplateService],
  exports: [SacTemplateService],
})
export class SacTemplateModule {}
