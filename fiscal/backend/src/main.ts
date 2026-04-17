import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  const logger = new Logger('FiscalBootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Headers de segurança via helmet: CSP, X-Frame-Options, Referrer-Policy,
  // X-Content-Type-Options, etc. crossOriginResourcePolicy liberado para que
  // o frontend em outra porta (5176) consiga consumir DANFE/DACTE PDFs.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Desativado porque a API não serve HTML — CSP aqui é inefetiva.
      contentSecurityPolicy: false,
    }),
  );

  app.setGlobalPrefix('api/v1/fiscal');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS whitelist — OBRIGATÓRIA. Fallback permissivo removido para evitar
  // CSRF em produção. Configurar via env: CORS_ORIGINS="https://a.com,https://b.com".
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    logger.error(
      'CORS_ORIGINS não configurado. Defina a variável de ambiente com a lista ' +
        'de origens permitidas (ex: "https://localhost,https://capul.com.br"). ' +
        'Abortando para evitar operação insegura.',
    );
    process.exit(1);
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Fiscal-Override-Gate'],
  });
  logger.log(`CORS habilitado para: ${corsOrigins.join(', ')}`);

  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port);

  logger.log(`Módulo Fiscal iniciado em http://0.0.0.0:${port}/api/v1/fiscal`);
  logger.log(`Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
  logger.log(
    `Protheus xmlFiscal mock: ${process.env.FISCAL_PROTHEUS_MOCK === 'true' ? 'ATIVO (stub em memória)' : 'desativado (chamadas reais)'}`,
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao subir Fiscal Backend:', err);
  process.exit(1);
});
