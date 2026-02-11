import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import TransformResponseInterceptor from './common/interceptors/transform-response.interceptor';
import { HttpErrorFilter } from './common/filters/http-error.filters';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { SentryInterceptor } from './common/interceptors/sentry.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.enableCors();

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'development'
  ) {
    Sentry.init({
      dsn: 'https://c74589a2d85fbaac31d0e5728f5393f6@o4506409112764416.ingest.sentry.io/4506409114664960',
      integrations: [new ProfilingIntegration()],
      environment: process.env.NODE_ENV || 'development',
    });
  }

  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new SentryInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bangsoal API Dev')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {});

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(8080);
}
bootstrap();
