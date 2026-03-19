import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as express from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SwitchFilialDto } from './dto/switch-filial.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 tentativas por minuto
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: express.Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('id') userId: string) {
    return this.authService.me(userId);
  }

  @Get('modulos')
  @UseGuards(JwtAuthGuard)
  async getModulos(@CurrentUser('id') userId: string) {
    return this.authService.getModulos(userId);
  }

  @Post('switch-filial')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async switchFilial(
    @CurrentUser('id') userId: string,
    @Body() dto: SwitchFilialDto,
  ) {
    return this.authService.switchFilial(userId, dto.filialId);
  }

  // MFA/TOTP
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async mfaSetup(@CurrentUser('id') userId: string) {
    return this.authService.mfaSetup(userId);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mfaVerify(@CurrentUser('id') userId: string, @Body() body: { code: string }) {
    return this.authService.mfaVerify(userId, body.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mfaDisable(@CurrentUser('id') userId: string, @Body() body: { code: string }) {
    return this.authService.mfaDisable(userId, body.code);
  }

  @Post('mfa/login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async mfaLogin(@Body() body: { mfaToken: string; code: string }, @Req() req: express.Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.mfaLogin(body.mfaToken, body.code, ip, userAgent);
  }
}
