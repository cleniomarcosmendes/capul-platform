import { Global, Module } from '@nestjs/common';
import { CoreLookupService } from './core-lookup.service.js';

@Global()
@Module({
  providers: [CoreLookupService],
  exports: [CoreLookupService],
})
export class CoreModule {}
