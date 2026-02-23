import { Module } from '@nestjs/common';
import { SoftwareController } from './software.controller.js';
import { SoftwareService } from './software.service.js';

@Module({
  controllers: [SoftwareController],
  providers: [SoftwareService],
  exports: [SoftwareService],
})
export class SoftwareModule {}
