/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { transactionOrders, users, transactions } from '../database/schema';
import { desc, eq } from 'drizzle-orm';
import * as dayjs from 'dayjs';

const subscriptionsTypeValue = {
  pemula: 30,
  ambis: 90,
  setia: 180,
};

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    transactionOrders,
    users,
    transactions,
  },
});

const run = async () => {
  console.log('running');
  const usersQuery = await db.query.users.findMany({
    columns: {
      id: true,
      validity_date: true,
      onboard_date: true,
      full_name: true,
    },
  });

  let totalPremiumUser = 0;
  const validUsers = [];
  const invalidUsers = [];

  const transactionStatus = new Set();
  for (let i = 0; i < usersQuery.length; i++) {
    const user = usersQuery[i];

    if (
      dayjs(user.validity_date).isAfter(dayjs(user.onboard_date).add(1, 'day'))
    ) {
      totalPremiumUser += 1;

      const userTransaction = await db.query.transactions.findMany({
        where: eq(transactionOrders.user_id, user.id),
      });

      if (userTransaction.length > 0) {
        // order by transaction time in the metadata property
        userTransaction.sort((a, b) => {
          return dayjs((a.metadata as any).transaction_time).isAfter(
            dayjs((b.metadata as any).transaction_time),
          )
            ? -1
            : 1;
        });

        let latestTransaction = null;
        // get latest settled transaction
        for (let j = 0; j < userTransaction.length; j++) {
          const transaction = userTransaction[j];

          if (
            (transaction.metadata as any).transaction_status === 'settlement'
          ) {
            transactionStatus.add(transaction);
            latestTransaction = transaction;
            break;
          }
        }

        if (latestTransaction) {
          const orderedSubscriptions =
            await db.query.transactionOrders.findFirst({
              where: eq(transactionOrders.id, latestTransaction.order_id),
            });

          const transactionTime = latestTransaction.metadata.transaction_time;

          if (
            dayjs(user.validity_date).isBefore(
              dayjs(transactionTime).add(
                subscriptionsTypeValue[orderedSubscriptions.subscription_type] +
                  1,
                'day',
              ),
            )
          ) {
            validUsers.push(user);
          } else {
            console.log(
              'Latest Transaction: ' +
                JSON.stringify(latestTransaction.metadata) +
                '\nValidity Date' +
                dayjs(user.validity_date).format('YYYY-MM-DD'),
            );

            invalidUsers.push(user);

            // adjust the validity date to the latest transaction
            const newValidityDate = dayjs(transactionTime)
              .add(
                subscriptionsTypeValue[orderedSubscriptions.subscription_type],
                'day',
              )
              .toDate();

            await db
              .update(users)
              .set({
                validity_date: newValidityDate,
              })
              .where(eq(users.id, user.id));
          }
        } else {
          console.log(
            'No settled transaction for user ' + user.full_name,
            user.validity_date,
          );
          invalidUsers.push(user);
          // adjust the validity date to the latest transaction
          const newValidityDate = dayjs(user.onboard_date)
            .add(1, 'minutes')
            .toDate();

          await db
            .update(users)
            .set({
              validity_date: newValidityDate,
            })
            .where(eq(users.id, user.id));
        }
      }
    }
  }

  console.log('Total Invalid Subscription: ' + invalidUsers.length);
  console.log('Total Valid Subscription: ' + validUsers.length);
};

run().then(() => {
  console.log('done');
  process.exit(0);
});
