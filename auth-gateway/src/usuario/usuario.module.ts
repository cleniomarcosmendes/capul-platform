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
  // `ProtheusFuncionarioService` exportado para a varredura de matrículas — é o
  // mesmo cliente que a tela de cadastro usa, então a chapa é validada contra a
  // MESMA fonte nos dois caminhos (cadastrar e verificar).
  exports: [UsuarioService, CapabilityService, ProtheusFuncionarioService],
})
export class UsuarioModule {}
