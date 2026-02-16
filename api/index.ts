import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import TransformResponseInterceptor from '../src/common/interceptors/transform-response.interceptor';
import { HttpErrorFilter } from '../src/common/filters/http-error.filters';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';

let cachedApp: any;
let cachedExpressApp: Express;

async function bootstrap() {
  if (!cachedApp || !cachedExpressApp) {
    try {
      cachedExpressApp = express();
      const adapter = new ExpressAdapter(cachedExpressApp);
      
      cachedApp = await NestFactory.create(AppModule, adapter, { 
        cors: true,
        logger: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'log'] : ['error'],
      });

      // CORS configuration
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? [
            'https://bangsoal.co.id',
            'https://www.bangsoal.co.id',
            process.env.FRONTEND_URL,
            'https://francis.nafhan.space',
          ].filter(Boolean)
        : [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'https://francis.nafhan.space',
            'https://bangsoal.co.id',
            'https://www.bangsoal.co.id',
            process.env.FRONTEND_URL || 'http://localhost:3000',
          ].filter(Boolean);

      cachedApp.enableCors({
        origin: (origin, callback) => {
          // In development, allow all origins for easier debugging
          if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
          }
          
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);
          
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            console.warn(`CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type', 
          'Authorization', 
          'X-Turing',
          'baggage',
          'sentry-trace',
          'X-Requested-With',
          'Accept',
          'Origin',
        ],
        preflightContinue: false,
        optionsSuccessStatus: 204,
      });

      cachedApp.setGlobalPrefix('api');
      cachedApp.useGlobalInterceptors(new TransformResponseInterceptor());
      cachedApp.useGlobalFilters(new HttpErrorFilter());
      cachedApp.useGlobalPipes(new ValidationPipe());

      const swaggerConfig = new DocumentBuilder()
        .setTitle('Bangsoal API')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(cachedApp, swaggerConfig, {});

      if (process.env.NODE_ENV !== 'production') {
        SwaggerModule.setup('docs', cachedApp, document);
      }

      await cachedApp.init();
    } catch (error: any) {
      console.error('Failed to bootstrap NestJS application:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      // Don't throw, let it be handled by handler
      cachedApp = null;
      cachedExpressApp = null;
      throw error;
    }
  }
  return cachedExpressApp;
}

// Helper function to get allowed origins
function getAllowedOrigins(): string[] {
  return process.env.NODE_ENV === 'production'
    ? [
        'https://bangsoal.co.id',
        'https://www.bangsoal.co.id',
        process.env.FRONTEND_URL,
        'https://francis.nafhan.space',
      ].filter(Boolean)
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'https://francis.nafhan.space',
        'https://bangsoal.co.id',
        'https://www.bangsoal.co.id',
        process.env.FRONTEND_URL,
      ].filter(Boolean);
}

// Helper function to set CORS headers
function setCorsHeaders(res: any, origin: string | undefined) {
  const allowedOrigins = getAllowedOrigins();
  
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow requests with no origin (like mobile apps or curl requests)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Turing, baggage, sentry-trace, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin || req.headers.Origin;

  // Handle OPTIONS request explicitly before NestJS to avoid 401 from guards
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin);
    res.status(204);
    res.end();
    return;
  }

  try {
    const expressApp = await bootstrap();
    
    // Set CORS headers before processing request
    setCorsHeaders(res, origin);
    expressApp(req, res);
  } catch (error: any) {
    console.error('Handler error:', error);
    console.error('Error stack:', error?.stack);
    if (!res.headersSent) {
      // Set CORS headers even on error
      setCorsHeaders(res, origin);
      
      res.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error?.message || String(error),
      });
    }
  }
}