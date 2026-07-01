import { Module } from '@nestjs/common';
import { SupervisorController } from './supervisor.controller.js';
import { SupervisorService } from './supervisor.service.js';

@Module({
  controllers: [SupervisorController],
  providers: [SupervisorService],
})
export class SupervisorModule {}
