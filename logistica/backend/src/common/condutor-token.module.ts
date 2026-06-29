import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CondutorTokenService } from './condutor-token.service.js';

/**
 * Provedor global do token de condutor (login PADRÃO da frota). Reusa o
 * JWT_SECRET da plataforma — o token é emitido e verificado pelo PRÓPRIO backend
 * de logística, e o claim `purpose: 'condutor-viagem'` o separa do JWT de usuário
 * (que é validado pelo passport/JwtAuthGuard, caminho diferente).
 */
@Global()
@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  providers: [CondutorTokenService],
  exports: [CondutorTokenService],
})
export class CondutorTokenModule {}
