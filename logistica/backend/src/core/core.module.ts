import { Global, Module } from '@nestjs/common';
import { CoreLookupService } from './core-lookup.service.js';
import { CoreController } from './core.controller.js';

@Global()
@Module({
  controllers: [CoreController],
  providers: [CoreLookupService],
  exports: [CoreLookupService],
})
export class CoreModule {}
