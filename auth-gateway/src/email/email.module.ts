import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailInternalController } from './email.controller';

@Module({
  controllers: [EmailInternalController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
