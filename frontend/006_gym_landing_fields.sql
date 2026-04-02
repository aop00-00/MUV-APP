-- 006_gym_landing_fields.sql
-- Add landing page customization columns to gyms table

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS whatsapp_url TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS landing_sections JSONB DEFAULT '["hero","classes","schedule","coaches","pricing","cta"]';
