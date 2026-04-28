-- Migration 018: Fix POS checkout — ensure orders table has all required columns
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

-- Add customer_name if missing
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Add type column if missing
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

-- Ensure payment_method allows 'transfer' (TEXT column with CHECK)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('mercado_pago', 'cash', 'card', 'transfer'));

-- Recreate decrement_stock RPC (idempotent)
CREATE OR REPLACE FUNCTION public.decrement_stock(
    p_product_id UUID,
    p_quantity   INT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.products
    SET stock = GREATEST(stock - p_quantity, 0)
    WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock TO service_role;

-- Recreate deduct_balance RPC (idempotent)
CREATE OR REPLACE FUNCTION public.deduct_balance(
    p_user_id UUID,
    p_amount  NUMERIC
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.profiles
    SET balance = GREATEST(balance - p_amount, 0)
    WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_balance TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
