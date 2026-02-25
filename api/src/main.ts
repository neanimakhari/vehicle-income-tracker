import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import { config } from 'dotenv';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';

// Load api/.env so EMAIL_* etc. are set whether we run from api/ or repo root
config({ path: path.join(process.cwd(), '.env') });
config({ path: path.join(process.cwd(), 'api', '.env') });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Increase body size limit so income logs with base64 images (expense/petrol slip) don't get 413
  app.useBodyParser('json', { limit: '20mb' });
  app.useBodyParser('urlencoded', { limit: '20mb', extended: true });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  const normalizeOrigin = (o: string) => (o.endsWith('/') ? o.slice(0, -1) : o);
  const allowedSet = new Set(corsOrigins.map(normalizeOrigin));

  app.enableCors({
    origin: (origin, callback) => {
      // No origin: same-origin request, or non-browser client (e.g. Postman)
      if (!origin) {
        return callback(null, true);
      }
      const normalized = normalizeOrigin(origin);
      if (allowedSet.has(normalized)) {
        return callback(null, true);
      }
      if (corsOrigins.length === 0) {
        return callback(null, false);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  app.setGlobalPrefix('v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VIT Platform API')
    .setDescription('Multi-tenant platform API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}
bootstrap();
