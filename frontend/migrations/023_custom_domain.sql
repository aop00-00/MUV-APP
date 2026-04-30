-- Migration 023: Custom domain support for white-label gym sites
-- Allows each gym to use their own domain (e.g. estudioyoga.com)
-- instead of a subdomain of grindproject.com

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

-- Index for fast lookup on every request
CREATE INDEX IF NOT EXISTS idx_gyms_custom_domain ON gyms (custom_domain);

-- Seed index on slug too (may already exist, safe to run)
CREATE INDEX IF NOT EXISTS idx_gyms_slug ON gyms (slug);
