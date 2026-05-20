-- Migration 022: Soporte para Mercado Pago Checkout Bricks
-- Agrega mp_public_key a gyms (necesaria para inicializar los Bricks en el frontend)
-- Agrega mp_customer_id a profiles (para tarjetas guardadas por usuario)

-- Public Key del gym en MP (ya existe la columna en el schema original, pero puede no estar en todas las instancias)
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS mp_public_key TEXT;

-- Customer ID de MP por usuario — permite mostrar tarjetas guardadas en futuros pagos
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_customer_id TEXT;
