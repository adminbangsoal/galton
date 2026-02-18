import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SUBSCRIPTION_PRICE } from './data/price';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import ReferralService from '../referral/referral.service';
import { PgInsertValue } from 'drizzle-orm/pg-core';

const subscriptionsTypeValue = {
  pemula: 30,
  setia: 90,
  ambis: 180,
};

@Injectable()
export default class PaymentsService {
  constructor(
    private configService: ConfigService,
    private referralService: ReferralService,
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async retrieveSnapUrl(
    subscriptionType: schema.SubscriptionTypeEnum,
    userId: string,
    referalCode?: string,
  ) {
    if (!SUBSCRIPTION_PRICE[subscriptionType])
      throw new Error('Invalid subscription type');

    let amount = SUBSCRIPTION_PRICE[subscriptionType];

    if (referalCode) {
      const referralCode = await this.referralService.checkValidReferralCode(
        referalCode,
        userId,
      );
      amount = amount - referralCode.discount;
    }

    const user = await this.db.query.users.findFirst({
      where: ({ id }, { eq }) => eq(id, userId),
    });

    const orderId = `${user.id}-${Date.now()}`;

    const params = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount + 4000,
      },
      item_details: [
        {
          price: amount,
          quantity: 1,
          name: `Paket Premium ${subscriptionType.toUpperCase()}`,
        },
        {
          price: 4000,
          quantity: 1,
          name: 'Biaya Transaksi',
        },
      ],
      credit_card: {
        secure: true,
      },
      customer_details: {
        first_name: user.full_name.split(' ')[0],
        last_name: user.full_name.split(' ')?.[1] ?? '',
        email: user.email ?? '',
        phone: user.phone_number,
      },
    };

    const serverKey = this.configService.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      throw new Error('MIDTRANS_SERVER_KEY is not set');
    }

    // Auto-detect sandbox: jika server key sandbox, force pakai sandbox URL
    // Ini lebih robust karena tidak bergantung pada NODE_ENV yang mungkin salah di-set
    const isSandboxKey = serverKey.startsWith('SB-Mid-server');
    const nodeEnv = this.configService.get('NODE_ENV');
    const isProduction = nodeEnv === 'production' && nodeEnv !== undefined && !isSandboxKey;
    
    // Force sandbox URL jika server key sandbox, regardless of NODE_ENV
    const midtransUrl = isSandboxKey || !isProduction
      ? 'https://app.sandbox.midtrans.com/snap/v1/transactions'
      : 'https://app.midtrans.com/snap/v1/transactions';

    // Base64 encode server key for Basic Auth
    const encodedServerKey = Buffer.from(serverKey).toString('base64');

    console.log('Midtrans Config:', {
      nodeEnv,
      isSandboxKey,
      isProduction,
      midtransUrl,
      serverKeyPrefix: serverKey.substring(0, 10) + '...',
      serverKeyStartsWith: isSandboxKey ? 'Sandbox' : 'Production',
    });

    try {
      const { data } = await axios.post(midtransUrl, params, {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${encodedServerKey}`,
          'Content-Type': 'application/json',
        },
      });

      const transactionOrder = {
        id: orderId,
        subscription_type: subscriptionType,
        user_id: userId,
      } as PgInsertValue<typeof schema.transactionOrders>;

      if (referalCode) {
        const referal = await this.db.query.referralCode.findFirst({
          where: eq(schema.referralCode.code, referalCode),
          columns: {
            id: true,
          },
        });

        transactionOrder.referal = referal.id;
      }

      await this.db.insert(schema.transactionOrders).values(transactionOrder);

      return data;
    } catch (err) {
      console.log(err.response.data.error_messages);
      throw err;
    }
  }

  async createTransaction(midtransBody: any) {
    console.log(`Creating Transaction:`, JSON.stringify(midtransBody, null, 2));

    // Extract user_id from order_id
    // order_id format: {user_id}-{timestamp}
    // user_id is UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with dashes)
    // UUID has 5 parts separated by dashes
    const orderIdParts = midtransBody.order_id.split('-');
    
    // Validate order_id format
    if (orderIdParts.length < 6) {
      console.error(`Invalid order_id format: ${midtransBody.order_id}`);
      throw new Error(`Invalid order_id format: ${midtransBody.order_id}`);
    }
    
    // UUID has 5 parts, timestamp is the 6th part
    const userId = orderIdParts.slice(0, 5).join('-');

    console.log(`Extracted userId: ${userId} from order_id: ${midtransBody.order_id}`);

    try {
      // Step 1: Insert/Update transaction
      const transactionValue = {
        id: midtransBody.transaction_id,
        user_id: userId,
        timestamp: new Date(),
        metadata: midtransBody,
        order_id: midtransBody.order_id,
      };

      let transaction;
      try {
        transaction = await this.db
          .insert(schema.transactions)
          .values(transactionValue)
          .onConflictDoUpdate({
            target: schema.transactions.id,
            set: {
              user_id: transactionValue.user_id,
              timestamp: transactionValue.timestamp,
              metadata: transactionValue.metadata,
              order_id: transactionValue.order_id,
            },
          })
          .returning();
        console.log('Transaction inserted/updated:', transaction[0]?.id);
      } catch (transactionErr) {
        console.error('Error inserting transaction:', transactionErr);
        throw transactionErr;
      }

      // Step 2: Get transaction order details
      const orderedSubscriptions =
        await this.db.query.transactionOrders.findFirst({
          where: ({ id }, { eq }) => eq(id, midtransBody.order_id),
        });

      if (!orderedSubscriptions) {
        console.error(`Transaction order not found for order_id: ${midtransBody.order_id}`);
        throw new NotFoundException(`Transaction order not found: ${midtransBody.order_id}`);
      }

      // Step 3: Handle successful payment
      // Handle both 'capture' and 'settlement' as successful payment
      // 'capture' = payment successful but not yet settled (credit card)
      // 'settlement' = payment fully settled
      if (midtransBody?.transaction_status === 'settlement' || 
          midtransBody?.transaction_status === 'capture') {
        
        // Calculate expiration date
        const paymentDate = orderedSubscriptions.timestamp || new Date();
        const expiredDate = dayjs(paymentDate)
          .add(
            subscriptionsTypeValue[orderedSubscriptions.subscription_type],
            'day',
          )
          .toDate();

        // Step 3a: Update referral usage if applicable
        if (orderedSubscriptions.referal) {
          try {
            const referal = await this.db.query.referralCode.findFirst({
              where: eq(schema.referralCode.id, orderedSubscriptions.referal),
            });

            if (referal) {
              await this.db.update(schema.referralUsage).set({
                referral_code: referal.code,
                userId: userId,
                orderId: midtransBody.order_id,
              });
              console.log('Referral usage updated');
            }
          } catch (referralErr) {
            console.error('Error updating referral usage:', referralErr);
            // Don't throw, continue with subscription creation
          }
        }

        // Step 3b: Create/Update subscription record
        try {
          // Check if subscription already exists for this transaction
          const existingSubscription = await this.db.query.subscriptions.findFirst({
            where: ({ transaction_id }, { eq }) => eq(transaction_id, midtransBody.transaction_id),
          });

          if (existingSubscription) {
            // Update existing subscription
            await this.db
              .update(schema.subscriptions)
              .set({
                is_active: true,
                expired_date: expiredDate,
                updated_at: new Date(),
              })
              .where(eq(schema.subscriptions.id, existingSubscription.id));
            console.log('Subscription updated:', existingSubscription.id);
          } else {
            // Create new subscription
            const newSubscription = await this.db
              .insert(schema.subscriptions)
              .values({
                user_id: userId,
                subscription_type: orderedSubscriptions.subscription_type,
                transaction_id: midtransBody.transaction_id,
                payment_date: paymentDate,
                expired_date: expiredDate,
                is_active: true,
              })
              .returning();
            console.log('Subscription created:', newSubscription[0]?.id);
          }
        } catch (subscriptionErr) {
          console.error('Error creating/updating subscription:', subscriptionErr);
          // Don't throw, continue with user validity update
        }

        // Step 3c: Update user validity date
        const updatedUserIds = await this.db
          .update(schema.users)
          .set({
            validity_date: expiredDate,
          })
          .where(eq(schema.users.id, userId))
          .returning({
            userId: schema.users.id,
            validity_date: schema.users.validity_date,
          });

        console.log('Transaction CREATED successfully:');
        console.log({
          user: updatedUserIds[0],
          message: `Transaction ${midtransBody?.transaction_status === 'capture' ? 'Captured' : 'Settled'}`,
          transaction_status: midtransBody?.transaction_status,
          new_validity_date: expiredDate,
          subscription_type: orderedSubscriptions.subscription_type,
          transaction: transaction[0],
        });
      } else {
        console.log(`Transaction status: ${midtransBody?.transaction_status} - not processing subscription`);
      }

      return {
        message: 'Transaction processed',
        transaction_id: midtransBody.transaction_id,
        status: midtransBody?.transaction_status,
      };
    } catch (err) {
      console.error('Error in createTransaction:', err);
      throw err;
    }
  }
}
