import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';
import dayjs from 'dayjs';
import * as dotenv from 'dotenv';

dotenv.config();

const subscriptionsTypeValue = {
  pemula: 30,
  setia: 90,
  ambis: 180,
};

async function migrateTransactionOrders() {
  console.log('🚀 Starting migration of transaction_orders to transactions and subscriptions...');

  // Get database instance
  const pg = postgres(process.env.DATABASE_URL);
  const db = drizzle(pg, { schema });

  try {
    // Get all transaction orders
    const transactionOrders = await db.query.transactionOrders.findMany();

    console.log(`📊 Found ${transactionOrders.length} transaction orders to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const order of transactionOrders) {
      try {
        console.log(`\n📦 Processing order: ${order.id}`);
        console.log(`   User ID: ${order.user_id}`);
        console.log(`   Subscription Type: ${order.subscription_type}`);

        // Check if transaction already exists and has successful payment status
        const existingTransaction = await db.query.transactions.findFirst({
          where: ({ order_id }, { eq }) => eq(order_id, order.id as string),
        });

        if (!existingTransaction) {
          // No transaction record means payment was never completed or webhook never received
          console.log(`   ⏭️  No transaction found - order was never paid or webhook not received, skipping...`);
          continue;
        }

        // Check transaction status from metadata
        // Handle both metadata as object and as array
        const metadata = existingTransaction.metadata as any;
        let transactionStatus: string | undefined;
        let transactionTime: string | undefined;
        
        // Check if metadata is array or object
        if (Array.isArray(metadata)) {
          // Metadata is array, try to parse first element (string JSON)
          if (metadata[0] && typeof metadata[0] === 'string') {
            try {
              const parsedJson = JSON.parse(metadata[0]);
              transactionStatus = parsedJson.transaction_status;
              transactionTime = parsedJson.transaction_time;
            } catch (e) {
              // If parsing fails, try to find transaction_status in array elements
              const statusObj = metadata.find((item: any) => item?.transaction_status);
              transactionStatus = statusObj?.transaction_status;
            }
          } else {
            // Try to find transaction_status in array elements directly
            const statusObj = metadata.find((item: any) => item?.transaction_status);
            transactionStatus = statusObj?.transaction_status;
          }
        } else {
          // Metadata is object
          transactionStatus = metadata?.transaction_status;
          transactionTime = metadata?.transaction_time;
        }
        
        console.log(`   📋 Transaction exists with status: ${transactionStatus}`);
        
        // Only process if status is settlement or capture (successful payment)
        if (transactionStatus !== 'settlement' && transactionStatus !== 'capture') {
          console.log(`   ⏭️  Payment not successful (status: ${transactionStatus}), skipping subscription...`);
          continue;
        }

        console.log(`   ✅ Payment successful, processing subscription...`);

        // Use existing transaction
        const transaction = existingTransaction!;
        const transactionId = transaction.id;
        
        // Get transaction timestamp from metadata
        const paymentDate = transactionTime 
          ? new Date(transactionTime)
          : (order.timestamp 
              ? (order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp as string | number))
              : new Date());
        
        console.log(`   ✅ Using existing transaction: ${transactionId}`);

        // Get user to check current validity_date (might be manually set)
        const user = await db.query.users.findFirst({
          where: ({ id }, { eq }) => eq(id, order.user_id as string),
          columns: {
            id: true,
            validity_date: true,
          },
        });

        // paymentDate already calculated above
        const subscriptionType = order.subscription_type as 'pemula' | 'setia' | 'ambis';
        let expiredDate = dayjs(paymentDate)
          .add(subscriptionsTypeValue[subscriptionType], 'day')
          .toDate();

        // If user has manually set validity_date that's later, use that instead
        // This handles cases where admin manually updated validity_date
        if (user?.validity_date) {
          const manualValidity = dayjs(user.validity_date);
          const calculatedValidity = dayjs(expiredDate);
          
          if (manualValidity.isAfter(calculatedValidity)) {
            console.log(`   📝 User has manually set validity_date (${user.validity_date}) that's later than calculated, using manual date`);
            expiredDate = user.validity_date instanceof Date ? user.validity_date : new Date(user.validity_date);
          }
        }

        // Check if subscription already exists
        const existingSubscription = await db.query.subscriptions.findFirst({
          where: ({ transaction_id }, { eq }) => eq(transaction_id, transactionId as string),
        });

        if (!existingSubscription) {
          // Create subscription record
          const subscription = await db
            .insert(schema.subscriptions)
            .values({
              user_id: order.user_id as string,
              subscription_type: subscriptionType,
              transaction_id: transactionId,
              payment_date: paymentDate,
              expired_date: expiredDate,
              is_active: dayjs(expiredDate).isAfter(dayjs()), // Active if not expired
            })
            .returning();

          console.log(`   ✅ Subscription created: ${subscription[0].id}`);
          console.log(`   📅 Payment Date: ${paymentDate}`);
          console.log(`   📅 Expired Date: ${expiredDate}`);
          console.log(`   ✅ Is Active: ${subscription[0].is_active}`);
        } else {
          console.log(`   ⏭️  Subscription already exists, skipping...`);
        }

        // Update user validity_date if needed (use the expired_date we calculated/used)
        if (user?.validity_date) {
          const currentValidity = dayjs(user.validity_date);
          const newValidity = dayjs(expiredDate);
          
          if (newValidity.isAfter(currentValidity)) {
            await db
              .update(schema.users)
              .set({
                validity_date: expiredDate,
              })
              .where(eq(schema.users.id, order.user_id as string));
            console.log(`   ✅ User validity_date updated to: ${expiredDate}`);
          } else {
            console.log(`   ⏭️  User validity_date already up to date (${user.validity_date})`);
          }
        } else {
          await db
            .update(schema.users)
            .set({
              validity_date: expiredDate,
            })
            .where(eq(schema.users.id, order.user_id as string));
          console.log(`   ✅ User validity_date set to: ${expiredDate}`);
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Error processing order ${order.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${transactionOrders.length}`);

    console.log('\n✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateTransactionOrders()
  .then(() => {
    console.log('🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
