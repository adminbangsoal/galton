import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: App;
  private db: Firestore;
  @InjectRedis() private readonly redis: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      .replace(/\\n/g, '\n');
    this.firebaseApp = initializeApp({
      credential: cert({
        privateKey: privateKey,
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      }),
    });

    this.db = getFirestore(this.firebaseApp);
  }

  getDb(): Firestore {
    return this.db;
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
