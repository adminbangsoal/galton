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
  
  // Normalize origin (remove trailing slash, convert to lowercase for comparison)
  const normalizedOrigin = origin ? origin.toLowerCase().replace(/\/$/, '') : undefined;
  const normalizedAllowedOrigins = allowedOrigins.map(o => o.toLowerCase().replace(/\/$/, ''));
  
  // Determine the origin to allow
  let allowedOrigin: string;
  
  if (process.env.NODE_ENV !== 'production') {
    // In development, allow the requesting origin or all origins
    allowedOrigin = origin || '*';
  } else {
    // In production, check if origin is in allowed list
    if (!origin) {
      // Allow requests with no origin (like mobile apps or curl requests)
      allowedOrigin = '*';
    } else {
      // Check if origin matches (case-insensitive, ignore trailing slash)
      const isAllowed = normalizedAllowedOrigins.includes(normalizedOrigin!);
      
      if (isAllowed) {
        // Use the original origin (not normalized) to preserve case
        allowedOrigin = origin;
      } else {
        // Origin not in allowed list
        console.warn(`[CORS] Blocked origin: ${origin}. Allowed:`, allowedOrigins);
        // Still set the origin header for OPTIONS to complete, but browser will reject actual request
        // This allows the preflight to succeed so we can see the error in the actual request
        allowedOrigin = origin;
      }
    }
  }
  
  // Always set CORS headers (required for OPTIONS preflight to work)
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Turing, baggage, sentry-trace, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Log for debugging (only in non-production or if origin doesn't match)
  if (process.env.NODE_ENV !== 'production' || !normalizedAllowedOrigins.includes(normalizedOrigin || '')) {
    console.log(`[CORS] Request from origin: ${origin || '(no origin)'}, Allowed: ${allowedOrigin}`);
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin || req.headers.Origin;

  // Handle OPTIONS request explicitly before NestJS to avoid 401 from guards
  if (req.method === 'OPTIONS') {
    try {
      setCorsHeaders(res, origin);
      res.status(204).end();
      return;
    } catch (error: any) {
      console.error('OPTIONS handler error:', error);
      // Even on error, try to set CORS headers
      try {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Turing, baggage, sentry-trace, X-Requested-With, Accept, Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } catch {}
      res.status(204).end();
      return;
    }
  }

  try {
    const expressApp = await bootstrap();
    
    // Set CORS headers before processing request
    setCorsHeaders(res, origin);
    // Express app can be called as a request handler
    (expressApp as any)(req, res);
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