import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  checkHealth(): string {
    return 'ok!';
  }

  checkEnvVariables(): {
    status: 'ok' | 'error';
    variables: Record<string, { set: boolean; hasValue: boolean }>;
    missing: string[];
  } {
    const requiredEnvVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'CACHE_URL',
      'REDIS_PASSWORD',
      'JWT_SECRET',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PROJECT_ID',
      'SES_REGION',
      'SES_ACCESS_KEY_ID',
      'SES_SECRET_ACCESS_KEY',
      'SES_FROM_EMAIL',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_REGION',
      'S3_BUCKET',
      'MIDTRANS_SERVER_KEY',
      'FRONTEND_URL',
      'NODE_ENV',
    ];

    const optionalEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_KEY',
      'SENTRY_DSN',
      'PORT',
    ];

    const allVars = [...requiredEnvVars, ...optionalEnvVars];
    const variables: Record<string, { set: boolean; hasValue: boolean }> = {};
    const missing: string[] = [];

    allVars.forEach((varName) => {
      const value = process.env[varName];
      const isSet = value !== undefined;
      const hasValue = isSet && value.trim().length > 0;

      variables[varName] = {
        set: isSet,
        hasValue,
      };

      if (requiredEnvVars.includes(varName) && !hasValue) {
        missing.push(varName);
      }
    });

    return {
      status: missing.length === 0 ? 'ok' : 'error',
      variables,
      missing,
    };
  }
}
