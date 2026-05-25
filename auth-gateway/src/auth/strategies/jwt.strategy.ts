import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      filialId: payload.filialId,
      filialCodigo: payload.filialCodigo,
      modulos: payload.modulos,
      // Onda 3 S0 (24/05) — propaga capabilities pra consumidores
      // (controllers/guards do auth-gateway que dependem de OVERSIGHT etc.).
      // Default [] pra retrocompat com JWTs antigos sem o campo.
      capabilities: payload.capabilities ?? [],
    };
  }
}
