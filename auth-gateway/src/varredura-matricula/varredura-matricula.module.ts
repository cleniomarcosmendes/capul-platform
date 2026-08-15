import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertNotifierModule } from '../alert-notifier/alert-notifier.module';
import { UsuarioModule } from '../usuario/usuario.module';
import { VarreduraMatriculaService } from './varredura-matricula.service';
import { VarreduraMatriculaController } from './varredura-matricula.controller';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AlertNotifierModule, UsuarioModule],
  controllers: [VarreduraMatriculaController],
  providers: [VarreduraMatriculaService],
})
export class VarreduraMatriculaModule {}
