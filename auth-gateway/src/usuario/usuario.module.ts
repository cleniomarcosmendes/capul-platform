import { Module } from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { CapabilityService } from './capability.service';
import { ProtheusFuncionarioService } from './protheus-funcionario.service';
import { UsuarioController } from './usuario.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { IntegracaoModule } from '../integracao/integracao.module';

@Module({
  imports: [AuditLogModule, IntegracaoModule],
  controllers: [UsuarioController],
  providers: [UsuarioService, CapabilityService, ProtheusFuncionarioService],
  exports: [UsuarioService, CapabilityService],
})
export class UsuarioModule {}
