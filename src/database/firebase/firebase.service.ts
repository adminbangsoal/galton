import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { Redis } from 'ioredis';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: App;
  private db: Firestore;
  private auth: Auth;
  @InjectRedis() private readonly redis: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const privateKeyRaw = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (!privateKeyRaw) {
      throw new Error('FIREBASE_PRIVATE_KEY environment variable is not set');
    }
    
    console.log('Private key raw length:', privateKeyRaw.length);
    console.log('Private key starts with:', privateKeyRaw.substring(0, 30));
    
    let privateKey: string;
    
    try {
      const decoded = Buffer.from(privateKeyRaw, 'base64').toString('utf-8');
      console.log('Base64 decoded length:', decoded.length);
      console.log('Decoded starts with:', decoded.substring(0, 30));
      
      if (decoded.includes('-----BEGIN PRIVATE KEY-----') || decoded.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        privateKey = decoded;
        console.log('Using base64 decoded private key');
      } else {
        throw new Error('Decoded is not a valid PEM format');
      }
    } catch (base64Error) {
      console.log('Base64 decode failed, trying escaped newlines');
      const withNewlines = privateKeyRaw.replace(/\\n/g, '\n');
      
      if (withNewlines.includes('-----BEGIN PRIVATE KEY-----') || withNewlines.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        privateKey = withNewlines;
        console.log('Using escaped newlines private key');
      } else if (privateKeyRaw.includes('-----BEGIN PRIVATE KEY-----') || privateKeyRaw.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        privateKey = privateKeyRaw;
        console.log('Using raw private key (already has newlines)');
      } else {
        console.error('Private key format validation failed');
        console.error('Contains BEGIN PRIVATE KEY:', privateKeyRaw.includes('BEGIN PRIVATE KEY'));
        throw new Error('Invalid FIREBASE_PRIVATE_KEY format. Expected PEM format or base64 encoded PEM.');
      }
    }
    
    console.log('Final private key length:', privateKey.length);
    
    this.firebaseApp = initializeApp({
      credential: cert({
        privateKey: privateKey,
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      }),
    });

    this.db = getFirestore(this.firebaseApp);
    this.auth = getAuth(this.firebaseApp);
  }

  getDb(): Firestore {
    return this.db;
  }

  getAuth(): Auth {
    return this.auth;
  }

  async verifyIdToken(idToken: string) {
    try {
      const decodedToken = await this.auth.verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      throw new Error(`Invalid Firebase ID token: ${error.message}`);
    }
  }

  async addUserHistoryPoint(userId: string, point: number, activity: string) {
    try {
      if (!activity) {
        throw new Error('Activity is required');
      }

      const pointHistoriesRef = await this.db
        .collection('point_history')
        .doc(userId);

      const pointHistories = await pointHistoriesRef.get();

      if (!pointHistories.exists) {
        console.error('User not found in firebase: ', userId);

        throw new Error('User not found');
      }

      const currentPointHistory = pointHistories.data();

      let currentPoint = 0;
      currentPointHistory.history.forEach((history) => {
        currentPoint += history.point;
      });

      await pointHistoriesRef.update({
        history: [
          ...currentPointHistory.history,
          {
            activity,
            point,
            timestamp: Date.now(),
          },
        ],
      });

      await this.redis.zadd('leaderboard', currentPoint + point, userId);
    } catch (e) {
      console.error(e);
    }
  }
}
