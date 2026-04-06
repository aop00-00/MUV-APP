-- =============================================================================
-- Grind Project — FULL DATABASE SETUP (consolidated)
-- =============================================================================
-- Ejecutar completo en Supabase Dashboard → SQL Editor → New Query → Run
-- Este script es idempotente: usa IF NOT EXISTS y ADD COLUMN IF NOT EXISTS.
-- =============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 1: Tabla GYMS (Core Multitenant) — de 001 + trial_ends_at de 007
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gyms (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name              text        NOT NULL,
  slug              text        UNIQUE,
  logo_url          text,
  primary_color     text        NOT NULL DEFAULT '#7c3aed',
  accent_color      text        NOT NULL DEFAULT '#2563eb',
  -- SaaS Subscription
  plan_id           text        NOT NULL DEFAULT 'starter'
                    CHECK (plan_id IN ('starter','pro','elite')),
  plan_status       text        NOT NULL DEFAULT 'trial'
                    CHECK (plan_status IN ('trial','active','past_due','suspended','cancelled')),
  plan_expires_at   timestamptz,
  trial_ends_at     timestamptz,  -- 7-day trial tracking
  saas_mp_pref_id   text,
  saas_mp_payment_id text,
  -- Tenant Mercado Pago credentials
  mp_access_token   text,
  mp_public_key     text,
  -- Fiscal config
  tax_region        text        NOT NULL DEFAULT 'MX'
                    CHECK (tax_region IN ('MX','AR','CL','CO','PE')),
  rfc               text,
  razon_social      text,
  regimen_fiscal    text,
  -- Localization
  currency          text        NOT NULL DEFAULT 'MXN',
  timezone          text        NOT NULL DEFAULT 'America/Mexico_City',
  country_code      text        NOT NULL DEFAULT 'MX',
  -- Feature flags
  features          jsonb       NOT NULL DEFAULT
    '{"fitcoins":true,"waitlist":true,"fiscal":true,"qrAccess":true}'::jsonb,
  -- Audit
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Si la tabla ya existia, agregar trial_ends_at
ALTER TABLE public.gyms ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS gyms_updated_at ON public.gyms;
CREATE TRIGGER gyms_updated_at
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS gyms_owner_id_idx ON public.gyms(owner_id);
CREATE INDEX IF NOT EXISTS gyms_trial_ends_at_idx
  ON public.gyms(trial_ends_at)
  WHERE plan_status = 'trial';


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 2: Tablas dependientes (de 003)
-- ══════════════════════════════════════════════════════════════════════════════

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    full_name   TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member', 'coach')),
    avatar_url  TEXT,
    credits     INT NOT NULL DEFAULT 0,
    phone       TEXT,
    balance     NUMERIC(10,2) DEFAULT 0,
    gym_id      UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id            UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT,
    coach_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    capacity          INT NOT NULL DEFAULT 20,
    current_enrolled  INT NOT NULL DEFAULT 0,
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ NOT NULL,
    location          TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WAITLIST
CREATE TABLE IF NOT EXISTS public.waitlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    position    INT NOT NULL DEFAULT 1,
    status      TEXT NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'promoted', 'cancelled')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    notified_at TIMESTAMPTZ
);

-- MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.memberships (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id            UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    plan_name         TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'frozen', 'expired', 'cancelled')),
    price             NUMERIC(10,2) NOT NULL DEFAULT 0,
    credits_included  INT DEFAULT 0,
    start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date          DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    freeze_until      DATE,
    auto_renew        BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    price       NUMERIC(10,2) NOT NULL DEFAULT 0,
    image_url   TEXT,
    category    TEXT NOT NULL DEFAULT 'beverage'
                CHECK (category IN ('beverage', 'supplement', 'merch', 'package', 'plan')),
    stock       INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id            UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_name     TEXT,
    type              TEXT DEFAULT 'pos'
                      CHECK (type IN ('pos', 'membership', 'renewal', 'event')),
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method    TEXT DEFAULT 'cash'
                      CHECK (payment_method IN ('mercado_pago', 'cash', 'card')),
    subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax               NUMERIC(10,2) NOT NULL DEFAULT 0,
    total             NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount            NUMERIC(10,2) GENERATED ALWAYS AS (total) STORED,
    mp_preference_id  TEXT,
    mp_payment_id     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name  TEXT NOT NULL DEFAULT '',
    quantity      INT NOT NULL DEFAULT 1,
    unit_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EVENTS
CREATE TABLE IF NOT EXISTS public.events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    coach       TEXT NOT NULL DEFAULT '',
    start_time  TIMESTAMPTZ NOT NULL,
    duration    INT NOT NULL DEFAULT 60,
    capacity    INT NOT NULL DEFAULT 20,
    enrolled    INT NOT NULL DEFAULT 0,
    price       NUMERIC(10,2) NOT NULL DEFAULT 0,
    location    TEXT DEFAULT '',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COACHES
CREATE TABLE IF NOT EXISTS public.coaches (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id               UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    email                TEXT NOT NULL DEFAULT '',
    role                 TEXT NOT NULL DEFAULT 'titular'
                         CHECK (role IN ('titular', 'part-time', 'sustituto')),
    specialties          TEXT[] DEFAULT '{}',
    status               TEXT NOT NULL DEFAULT 'activo'
                         CHECK (status IN ('activo', 'invitado', 'inactivo')),
    sessions_this_month  INT NOT NULL DEFAULT 0,
    rate_per_session     NUMERIC(10,2) DEFAULT 200,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FITCOINS
CREATE TABLE IF NOT EXISTS public.fitcoins (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id        UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    amount        INT NOT NULL DEFAULT 0,
    source        TEXT NOT NULL DEFAULT 'bonus'
                  CHECK (source IN ('attendance', 'referral', 'purchase', 'streak_bonus', 'redemption', 'bonus', 'admin_grant')),
    balance_after INT NOT NULL DEFAULT 0,
    description   TEXT NOT NULL DEFAULT '',
    reference_id  UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LEADS
CREATE TABLE IF NOT EXISTS public.leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL DEFAULT '',
    phone           TEXT,
    source          TEXT NOT NULL DEFAULT 'web'
                    CHECK (source IN ('instagram', 'referral', 'web', 'walk_in', 'facebook', 'google')),
    stage           TEXT NOT NULL DEFAULT 'new'
                    CHECK (stage IN ('new', 'contacted', 'trial', 'converted', 'lost')),
    notes           TEXT,
    assigned_to     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    days_in_stage   INT DEFAULT 0,
    engagement_score INT DEFAULT 50,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACCESS_LOGS
CREATE TABLE IF NOT EXISTS public.access_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id        UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    access_type   TEXT NOT NULL DEFAULT 'entry'
                  CHECK (access_type IN ('entry', 'exit')),
    qr_token      TEXT,
    validated     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LOCATIONS
CREATE TABLE IF NOT EXISTS public.locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    address     TEXT NOT NULL DEFAULT '',
    city        TEXT NOT NULL DEFAULT '',
    country     TEXT NOT NULL DEFAULT 'MX',
    phone       TEXT,
    maps_url    TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ROOMS
CREATE TABLE IF NOT EXISTS public.rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    capacity    INT NOT NULL DEFAULT 20,
    equipment   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CLASS_TYPES
CREATE TABLE IF NOT EXISTS public.class_types (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id            UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    color             TEXT NOT NULL DEFAULT '#7c3aed',
    duration          INT NOT NULL DEFAULT 60,
    credits_required  INT NOT NULL DEFAULT 1,
    description       TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SCHEDULES
CREATE TABLE IF NOT EXISTS public.schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    class_name  TEXT NOT NULL,
    coach_name  TEXT NOT NULL DEFAULT '',
    room_name   TEXT NOT NULL DEFAULT '',
    days        JSONB NOT NULL DEFAULT '[]'::jsonb,
    time        TEXT NOT NULL DEFAULT '09:00',
    duration    INT NOT NULL DEFAULT 60,
    capacity    INT NOT NULL DEFAULT 20,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id        UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    code          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    discount_type TEXT NOT NULL DEFAULT 'porcentaje'
                  CHECK (discount_type IN ('porcentaje', 'fijo')),
    value         NUMERIC(10,2) NOT NULL DEFAULT 0,
    uses          INT NOT NULL DEFAULT 0,
    max_uses      INT,
    expires_at    DATE,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SPECIAL_PERIODS
CREATE TABLE IF NOT EXISTS public.special_periods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    effect      TEXT NOT NULL DEFAULT 'cerrar_todo'
                CHECK (effect IN ('cerrar_todo', 'cancelar_sesiones', 'reducir_horario')),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SUBSTITUTIONS
CREATE TABLE IF NOT EXISTS public.substitutions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id            UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    session_name      TEXT NOT NULL,
    session_date      DATE NOT NULL,
    session_time      TEXT NOT NULL DEFAULT '09:00',
    original_coach    TEXT NOT NULL,
    substitute_coach  TEXT NOT NULL,
    reason            TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'pendiente'
                      CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COACH_PAYROLL
CREATE TABLE IF NOT EXISTS public.coach_payroll (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    coach_id    UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    period      TEXT NOT NULL,
    total       NUMERIC(10,2) NOT NULL DEFAULT 0,
    bonus       NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_paid     BOOLEAN NOT NULL DEFAULT false,
    paid_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PAYMENT_GATEWAYS
CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    api_key_masked  TEXT,
    is_connected    BOOLEAN NOT NULL DEFAULT false,
    connected_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES public.orders(id),
    user_id     UUID REFERENCES auth.users(id),
    gym_id      UUID REFERENCES public.gyms(id) ON DELETE CASCADE,
    tax_region  TEXT NOT NULL DEFAULT 'MX',
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','issued','cancelled','error')),
    cfdi_uuid   TEXT,
    afip_cae    TEXT,
    sii_folio   TEXT,
    subtotal    NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    total       NUMERIC(10,2) NOT NULL DEFAULT 0,
    pdf_url     TEXT,
    xml_url     TEXT,
    issued_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PERSONAL_RECORDS
CREATE TABLE IF NOT EXISTS public.personal_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    exercise    TEXT NOT NULL,
    value       NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit        TEXT NOT NULL DEFAULT 'kg',
    previous    NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_visual  NUMERIC(10,2) NOT NULL DEFAULT 150,
    history     JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BODY_MEASUREMENTS
CREATE TABLE IF NOT EXISTS public.body_measurements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    weight      NUMERIC(6,2),
    height      NUMERIC(4,2),
    measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 3: ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gym_owner_read_own" ON public.gyms;
CREATE POLICY "gym_owner_read_own" ON public.gyms
  FOR SELECT USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "gym_owner_update_own" ON public.gyms;
CREATE POLICY "gym_owner_update_own" ON public.gyms
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.profiles;
CREATE POLICY "tenant_isolation" ON public.profiles
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.memberships;
CREATE POLICY "tenant_isolation" ON public.memberships
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.classes;
CREATE POLICY "tenant_isolation" ON public.classes
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bookings;
CREATE POLICY "tenant_isolation" ON public.bookings
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.orders;
CREATE POLICY "tenant_isolation" ON public.orders
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.fitcoins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.fitcoins;
CREATE POLICY "tenant_isolation" ON public.fitcoins
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.leads;
CREATE POLICY "tenant_isolation" ON public.leads
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.products;
CREATE POLICY "tenant_isolation" ON public.products
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.order_items;
CREATE POLICY "tenant_isolation" ON public.order_items
  FOR ALL USING (
    order_id IN (SELECT id FROM public.orders WHERE gym_id = (auth.jwt() ->> 'gym_id')::uuid)
  );

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.events;
CREATE POLICY "tenant_isolation" ON public.events
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.coaches;
CREATE POLICY "tenant_isolation" ON public.coaches
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.access_logs;
CREATE POLICY "tenant_isolation" ON public.access_logs
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.waitlist;
CREATE POLICY "tenant_isolation" ON public.waitlist
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.locations;
CREATE POLICY "tenant_isolation" ON public.locations
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rooms;
CREATE POLICY "tenant_isolation" ON public.rooms
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.class_types;
CREATE POLICY "tenant_isolation" ON public.class_types
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.schedules;
CREATE POLICY "tenant_isolation" ON public.schedules
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.coupons;
CREATE POLICY "tenant_isolation" ON public.coupons
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.special_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.special_periods;
CREATE POLICY "tenant_isolation" ON public.special_periods
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.substitutions;
CREATE POLICY "tenant_isolation" ON public.substitutions
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.coach_payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.coach_payroll;
CREATE POLICY "tenant_isolation" ON public.coach_payroll
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.payment_gateways;
CREATE POLICY "tenant_isolation" ON public.payment_gateways
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.invoices;
CREATE POLICY "tenant_isolation" ON public.invoices
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.personal_records;
CREATE POLICY "tenant_isolation" ON public.personal_records
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.body_measurements;
CREATE POLICY "tenant_isolation" ON public.body_measurements
  FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 4: INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_products_gym_id       ON public.products(gym_id);
CREATE INDEX IF NOT EXISTS idx_products_gym_category ON public.products(gym_id, category);
CREATE INDEX IF NOT EXISTS idx_products_gym_active   ON public.products(gym_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_events_gym_id         ON public.events(gym_id);
CREATE INDEX IF NOT EXISTS idx_events_gym_active     ON public.events(gym_id, is_active, start_time);
CREATE INDEX IF NOT EXISTS idx_coaches_gym_id        ON public.coaches(gym_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_gym_id    ON public.access_logs(gym_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_gym  ON public.access_logs(user_id, gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_gym_id      ON public.locations(gym_id);
CREATE INDEX IF NOT EXISTS idx_rooms_gym_id          ON public.rooms(gym_id);
CREATE INDEX IF NOT EXISTS idx_rooms_location_id     ON public.rooms(location_id);
CREATE INDEX IF NOT EXISTS idx_class_types_gym_id    ON public.class_types(gym_id);
CREATE INDEX IF NOT EXISTS idx_schedules_gym_id      ON public.schedules(gym_id);
CREATE INDEX IF NOT EXISTS idx_schedules_gym_active  ON public.schedules(gym_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_gym_code ON public.coupons(gym_id, code);
CREATE INDEX IF NOT EXISTS idx_coupons_gym_id ON public.coupons(gym_id);
CREATE INDEX IF NOT EXISTS idx_special_periods_gym_id ON public.special_periods(gym_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_gym_id ON public.substitutions(gym_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_status ON public.substitutions(gym_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_payroll_unique ON public.coach_payroll(gym_id, coach_id, period);
CREATE INDEX IF NOT EXISTS idx_coach_payroll_gym_id ON public.coach_payroll(gym_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateways_unique ON public.payment_gateways(gym_id, provider);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_gym_id ON public.payment_gateways(gym_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_records_user_exercise ON public.personal_records(user_id, gym_id, exercise);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON public.personal_records(user_id, gym_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user ON public.body_measurements(user_id, gym_id, measured_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 5: TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS memberships_updated_at ON public.memberships;
CREATE TRIGGER memberships_updated_at
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 6: RPCs (Atomic Operations)
-- ══════════════════════════════════════════════════════════════════════════════

-- book_class
CREATE OR REPLACE FUNCTION public.book_class(
  p_class_id  uuid,
  p_user_id   uuid,
  p_gym_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_class record; v_profile record; v_booking_id uuid;
BEGIN
  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id AND gym_id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'class_not_found'); END IF;
  IF v_class.current_enrolled >= v_class.capacity THEN RETURN jsonb_build_object('success', false, 'error', 'class_full'); END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id AND gym_id = p_gym_id FOR UPDATE;
  IF NOT FOUND OR v_profile.credits < 1 THEN RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits'); END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE class_id = p_class_id AND user_id = p_user_id AND gym_id = p_gym_id AND status = 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_booked');
  END IF;
  INSERT INTO public.bookings (user_id, class_id, gym_id, status) VALUES (p_user_id, p_class_id, p_gym_id, 'confirmed') RETURNING id INTO v_booking_id;
  UPDATE public.profiles SET credits = credits - 1 WHERE id = p_user_id AND gym_id = p_gym_id;
  UPDATE public.classes SET current_enrolled = current_enrolled + 1 WHERE id = p_class_id AND gym_id = p_gym_id;
  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id, 'credits_remaining', v_profile.credits - 1);
END;
$$;

-- cancel_booking
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid, p_user_id uuid, p_gym_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_booking record; v_class record; v_refund boolean := false;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id AND user_id = p_user_id AND gym_id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'booking_not_found'); END IF;
  SELECT * INTO v_class FROM public.classes WHERE id = v_booking.class_id;
  IF v_class.start_time > now() + interval '2 hours' THEN
    UPDATE public.profiles SET credits = credits + 1 WHERE id = p_user_id AND gym_id = p_gym_id;
    v_refund := true;
  END IF;
  UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE id = p_booking_id;
  UPDATE public.classes SET current_enrolled = GREATEST(current_enrolled - 1, 0) WHERE id = v_booking.class_id AND gym_id = p_gym_id;
  RETURN jsonb_build_object('success', true, 'refunded', v_refund);
END;
$$;

-- join_waitlist
CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_class_id uuid, p_user_id uuid, p_gym_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_position integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.waitlist WHERE class_id = p_class_id AND user_id = p_user_id AND gym_id = p_gym_id AND status = 'waiting') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_in_waitlist');
  END IF;
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM public.waitlist WHERE class_id = p_class_id AND gym_id = p_gym_id AND status = 'waiting';
  INSERT INTO public.waitlist (user_id, class_id, gym_id, position, status) VALUES (p_user_id, p_class_id, p_gym_id, v_position, 'waiting');
  RETURN jsonb_build_object('success', true, 'position', v_position);
END;
$$;

-- decrement_stock
CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id UUID, p_quantity INT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN UPDATE public.products SET stock = GREATEST(stock - p_quantity, 0) WHERE id = p_product_id; END;
$$;

-- deduct_balance
CREATE OR REPLACE FUNCTION public.deduct_balance(p_user_id UUID, p_amount NUMERIC) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN UPDATE public.profiles SET balance = GREATEST(balance - p_amount, 0) WHERE id = p_user_id; END;
$$;

GRANT EXECUTE ON FUNCTION public.book_class TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_waitlist TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_balance TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 7: Custom JWT Hook (inject gym_id into JWT)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE claims jsonb; user_id uuid; user_gym_id uuid; user_role text;
BEGIN
  user_id := (event ->> 'user_id')::uuid;
  SELECT p.gym_id, p.role INTO user_gym_id, user_role FROM public.profiles p WHERE p.id = user_id;
  claims := event -> 'claims';
  IF user_gym_id IS NOT NULL THEN claims := jsonb_set(claims, '{gym_id}', to_jsonb(user_gym_id)); END IF;
  IF user_role IS NOT NULL THEN claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role)); END IF;
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 8: Profile auto-create trigger
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'role', 'member')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════════════════════
-- PASO 9: Backfill trial_ends_at para gyms existentes
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.gyms
SET trial_ends_at = now() + interval '7 days'
WHERE plan_status = 'trial' AND trial_ends_at IS NULL;


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICACION
-- ══════════════════════════════════════════════════════════════════════════════

SELECT table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS columns
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
