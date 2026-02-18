-- ============================================
-- SUPABASE MIGRATION: Create Subscriptions Table
-- ============================================
-- Run this SQL in Supabase SQL Editor
-- ============================================

-- Step 1: Create subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_type" "subscriptions_type" NOT NULL,
	"transaction_id" text NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"expired_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Step 2: Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" 
 FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_transaction_id_transactions_id_fk" 
 FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_transaction_id_idx" ON "subscriptions" ("transaction_id");
CREATE INDEX IF NOT EXISTS "subscriptions_is_active_idx" ON "subscriptions" ("is_active");
CREATE INDEX IF NOT EXISTS "subscriptions_expired_date_idx" ON "subscriptions" ("expired_date");
CREATE INDEX IF NOT EXISTS "subscriptions_subscription_type_idx" ON "subscriptions" ("subscription_type");

-- Step 4: Migrate existing PAID transactions to subscriptions
-- Only process orders that have successful payment (settlement or capture status)
DO $$
DECLARE
    transaction_record RECORD;
    order_record RECORD;
    payment_date_val TIMESTAMP;
    expired_date_val TIMESTAMP;
    subscription_days INTEGER;
    is_active_val BOOLEAN;
    transaction_status_val TEXT;
    user_validity_date TIMESTAMP;
    metadata_type TEXT;
    first_elem TEXT;
    parsed_json JSONB;
    transaction_time_str TEXT;
BEGIN
    -- Process only transactions with successful payment status
    -- Handle both metadata as object and as array
    FOR transaction_record IN 
        SELECT t.*, to_data.subscription_type, to_data.user_id
        FROM transactions t
        JOIN transaction_orders to_data ON t.order_id = to_data.id
        WHERE NOT EXISTS (
            SELECT 1 FROM subscriptions s 
            WHERE s.transaction_id = t.id
        )
    LOOP
        -- Get transaction status from metadata
        -- Handle metadata as object: metadata->>'transaction_status'
        -- Handle metadata as array: parse first element (string JSON) or check array elements
        -- Check if metadata is array or object
        IF jsonb_typeof(transaction_record.metadata) = 'array' THEN
            -- Metadata is array, try to extract from first element (string JSON)
            first_elem := transaction_record.metadata->>0;
            IF first_elem IS NOT NULL THEN
                BEGIN
                    parsed_json := first_elem::jsonb;
                    transaction_status_val := parsed_json->>'transaction_status';
                EXCEPTION WHEN OTHERS THEN
                    -- If parsing fails, try to find transaction_status in array elements
                    SELECT value->>'transaction_status' INTO transaction_status_val
                    FROM jsonb_array_elements(transaction_record.metadata)
                    WHERE value->>'transaction_status' IS NOT NULL
                    LIMIT 1;
                END;
            ELSE
                -- Try to find transaction_status in array elements directly
                SELECT value->>'transaction_status' INTO transaction_status_val
                FROM jsonb_array_elements(transaction_record.metadata)
                WHERE value->>'transaction_status' IS NOT NULL
                LIMIT 1;
            END IF;
        ELSE
            -- Metadata is object, extract directly
            transaction_status_val := transaction_record.metadata->>'transaction_status';
        END IF;
        
        -- Skip if not successful payment
        IF transaction_status_val IS NULL OR transaction_status_val NOT IN ('settlement', 'capture') THEN
            RAISE NOTICE 'Skipping transaction % - status: %', transaction_record.id, COALESCE(transaction_status_val, 'NULL');
            CONTINUE;
        END IF;
        
        -- Get payment date from transaction_time in metadata, or use transaction timestamp
        -- Handle both metadata as object and as array
        transaction_time_str := NULL;
        IF jsonb_typeof(transaction_record.metadata) = 'array' THEN
            -- Metadata is array, parse first element
            first_elem := transaction_record.metadata->>0;
            IF first_elem IS NOT NULL THEN
                BEGIN
                    parsed_json := first_elem::jsonb;
                    transaction_time_str := parsed_json->>'transaction_time';
                EXCEPTION WHEN OTHERS THEN
                    transaction_time_str := NULL;
                END;
            END IF;
        ELSE
            -- Metadata is object
            transaction_time_str := transaction_record.metadata->>'transaction_time';
        END IF;
        
        IF transaction_time_str IS NOT NULL THEN
            payment_date_val := transaction_time_str::TIMESTAMP;
        ELSE
            payment_date_val := COALESCE(transaction_record.timestamp, NOW());
        END IF;
        
        -- Calculate subscription days based on type
        CASE transaction_record.subscription_type
            WHEN 'pemula' THEN subscription_days := 30;
            WHEN 'setia' THEN subscription_days := 90;
            WHEN 'ambis' THEN subscription_days := 180;
            ELSE subscription_days := 30;
        END CASE;
        
        -- Calculate expired date
        expired_date_val := payment_date_val + (subscription_days || ' days')::INTERVAL;
        
        -- Check if user has manually set validity_date that's later (handles manual admin updates)
        -- If so, use that as expired_date instead
        SELECT validity_date INTO user_validity_date
        FROM users
        WHERE id = transaction_record.user_id;
        
        IF user_validity_date IS NOT NULL AND user_validity_date > expired_date_val THEN
            expired_date_val := user_validity_date;
            RAISE NOTICE 'Using manually set validity_date (%) for user %', user_validity_date, transaction_record.user_id;
        END IF;
        
        -- Check if subscription is still active
        is_active_val := expired_date_val > NOW();
        
        -- Insert subscription
        INSERT INTO subscriptions (
            user_id,
            subscription_type,
            transaction_id,
            payment_date,
            expired_date,
            is_active
        )
        VALUES (
            transaction_record.user_id,
            transaction_record.subscription_type,
            transaction_record.id,
            payment_date_val,
            expired_date_val,
            is_active_val
        )
        ON CONFLICT DO NOTHING;
        
        -- Update user validity_date if expired_date is later
        UPDATE users
        SET validity_date = expired_date_val
        WHERE id = transaction_record.user_id
        AND (validity_date IS NULL OR expired_date_val > validity_date);
        
        RAISE NOTICE 'Created subscription for transaction: % (order: %), user: %, type: %, expired: %', 
            transaction_record.id, 
            transaction_record.order_id,
            transaction_record.user_id,
            transaction_record.subscription_type,
            expired_date_val;
    END LOOP;
    
    RAISE NOTICE 'Migration completed! Only successful payments were processed.';
END $$;

-- Step 5: Verify migration
SELECT 
    'transaction_orders' as table_name,
    COUNT(*) as total_rows
FROM transaction_orders
UNION ALL
SELECT 
    'transactions' as table_name,
    COUNT(*) as total_rows
FROM transactions
UNION ALL
SELECT 
    'subscriptions' as table_name,
    COUNT(*) as total_rows
FROM subscriptions;

-- Step 6: View subscriptions summary
SELECT 
    s.id,
    u.full_name,
    u.email,
    s.subscription_type,
    s.payment_date,
    s.expired_date,
    s.is_active,
    CASE 
        WHEN s.expired_date > NOW() THEN 'Active'
        ELSE 'Expired'
    END as status
FROM subscriptions s
JOIN users u ON s.user_id = u.id
ORDER BY s.payment_date DESC;
