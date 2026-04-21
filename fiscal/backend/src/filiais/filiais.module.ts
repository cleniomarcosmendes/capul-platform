import { Module } from '@nestjs/common';
import { FiliaisController } from './filiais.controller.js';
import { FiliaisService } from './filiais.service.js';

@Module({
  controllers: [FiliaisController],
  providers: [FiliaisService],
  exports: [FiliaisService],
})
export class FiliaisModule {}
