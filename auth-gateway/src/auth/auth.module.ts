import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DispositivoSessaoModule } from '../dispositivo-sessao/dispositivo-sessao.module';
import { IntegracaoModule } from '../integracao/integracao.module';
import { PortalAuthService } from './portal-auth.service';

@Module({
  imports: [
    AuditLogModule,
    DispositivoSessaoModule,
    IntegracaoModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_EXPIRATION', '60m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PortalAuthService],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
