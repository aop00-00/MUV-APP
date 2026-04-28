-- Migration 016: Add missing columns to orders table
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

-- Add customer_name if it doesn't exist
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Add type column if it doesn't exist
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'pos';

-- Add type constraint if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_type_check'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_type_check
            CHECK (type IN ('pos', 'membership', 'renewal', 'event'));
    END IF;
END $$;

-- payment_method is an ENUM — add 'transfer' value if it doesn't exist yet
DO $$ BEGIN
    -- Check if payment_method is an enum type
    IF EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE a.attrelid = 'public.orders'::regclass
          AND a.attname = 'payment_method'
          AND t.typtype = 'e'
    ) THEN
        -- It's an enum: add 'transfer' if missing
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_attribute a ON a.atttypid = t.oid
            WHERE a.attrelid = 'public.orders'::regclass
              AND a.attname = 'payment_method'
              AND e.enumlabel = 'transfer'
        ) THEN
            ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'transfer';
        END IF;
    ELSE
        -- It's a TEXT column with CHECK constraint — drop old and recreate
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_payment_method_check
            CHECK (payment_method IN ('mercado_pago', 'cash', 'card', 'transfer'));
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
