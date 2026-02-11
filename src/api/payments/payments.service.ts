import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SUBSCRIPTION_PRICE } from './data/price';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from 'src/database/schema';
import * as dayjs from 'dayjs';
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
  ) { }

  async retrieveSnapUrl(
    subscriptionType: schema.SubscriptionTypeEnum,
    userId: string,
    referalCode?: string,
  ) {
    if (!SUBSCRIPTION_PRICE[subscriptionType])
      throw new Error('Invalid subscription type');

    let amount = SUBSCRIPTION_PRICE[subscriptionType];

    if (referalCode) {
      const referralCode = await this.referralService.checkValidReferralCode(referalCode, userId);
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

    const serverKey = Buffer.from(
      this.configService.get('MIDTRANS_SERVER_KEY'),
    ).toString('base64');

    const midtransUrl =
      this.configService.get('NODE_ENV') === 'production'
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    try {
      const { data } = await axios.post(midtransUrl, params, {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${serverKey}`,
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
          }
        })

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
    console.log(`Creating Transaction: ${midtransBody}`)


    const userId: string = midtransBody.order_id
      .split('-')
      .slice(0, 5)
      .join('-');

    try {
      const value = {
        id: midtransBody.transaction_id,
        user_id: userId,
        timestamp: new Date(),
        metadata: midtransBody,
        order_id: midtransBody.order_id,
      };
      const transaction = await this.db.insert(schema.transactions).values(value).onConflictDoUpdate({
        target: schema.transactions.id,
        set: value,
      }).returning();

      const orderedSubscriptions = await this.db.query.transactionOrders.findFirst(
        {
          where: ({ id }, { eq }) => eq(id, midtransBody.order_id),
        },
      );

      if (midtransBody?.transaction_status == 'settlement') {
        // Update referral usage
        if (orderedSubscriptions.referal) {

          const referal = await this.db.query.referralCode.findFirst({
            where: eq(schema.referralCode.id, orderedSubscriptions.referal),
          })

          await this.db.update(schema.referralUsage).set({
            referral_code: referal.code,
            userId: userId,
            orderId: midtransBody.order_id,
          })

        }


        const newValidityDate = dayjs(orderedSubscriptions.timestamp)
          .add(
            subscriptionsTypeValue[orderedSubscriptions.subscription_type],
            'day',
          )
          .toDate();

        const updatedUserIds = await this.db
          .update(schema.users)
          .set({
            validity_date: newValidityDate,
          })
          .where(eq(schema.users.id, userId))
          .returning({ userId: schema.users.id, validity_date: schema.users.validity_date });

        console.log('Transaction CREATED: \n')

        console.log({
          user: updatedUserIds[0],
          message: 'Transaction Settled',
          new_validity_date: newValidityDate,
          transaction: transaction[0],
        })

        console.log('NEW USER AFTER TRANSACTION: \n')

        console.log(updatedUserIds[0])
      }
      return {
        message: 'Transaction created',
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}
