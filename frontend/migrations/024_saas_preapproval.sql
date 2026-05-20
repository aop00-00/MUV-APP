-- Migration 024: Add saas_mp_preapproval_id to gyms
-- Stores the MercadoPago preapproval ID for monthly recurring subscriptions.
-- Trimestral/annual plans continue using saas_mp_payment_id (one-time charge).

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS saas_mp_preapproval_id text;

COMMENT ON COLUMN public.gyms.saas_mp_preapproval_id IS
  'MercadoPago preapproval ID for monthly recurring subscriptions (starter/pro/elite mensual). NULL for one-time payments (trimestral/anual).';
