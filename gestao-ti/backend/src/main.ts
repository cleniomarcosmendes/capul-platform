import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Helmet — headers de seguranca (defesa em profundidade alem do Nginx)
  app.use(
    helmet({
      contentSecurityPolicy: false, // API nao serve HTML — CSP no Nginx
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api/v1/gestao-ti');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS restritivo — apenas origens da intranet
  const allowedOrigins = (process.env.CORS_ORIGINS || 'https://localhost')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  app.get(Logger).log(`Gestão TI Backend rodando na porta ${port}`, 'Bootstrap');
}
bootstrap();
