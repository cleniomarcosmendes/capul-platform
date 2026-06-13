import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Defesa em profundidade (o nginx já aplica CSP/HSTS). API não serve HTML.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.setGlobalPrefix('api/v1/logistica');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS whitelist — OBRIGATÓRIA (sem fallback permissivo). Mesmo padrão do
  // auth-gateway/fiscal: aborta se não configurado, evita CSRF em produção.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    logger.error(
      'CORS_ORIGINS não configurado. Defina a lista de origens permitidas ' +
        '(ex: "https://localhost"). Abortando para evitar operação insegura.',
    );
    process.exit(1);
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = Number(process.env.PORT ?? 3003);
  await app.listen(port);
  logger.log(`Módulo Logística iniciado em http://0.0.0.0:${port}/api/v1/logistica`);
  logger.log(`Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao subir Logística Backend:', err);
  process.exit(1);
});
