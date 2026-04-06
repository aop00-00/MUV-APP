-- =============================================================================
-- Grind Project - Migration 003: Create Missing Tables
-- =============================================================================
-- Las migraciones 001 y 002 asumen que ciertas tablas ya existen (solo agregan
-- gym_id con ALTER TABLE). Este script CREA las tablas que faltan.
--
-- Ejecutar ANTES de 001 y 002. O si ya corriste 001/002, este script es seguro
-- porque usa IF NOT EXISTS y ADD COLUMN IF NOT EXISTS.
--
-- En: Supabase Dashboard - SQL Editor - New Query - Run
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. PROFILES (si no fue creada por Supabase Auth trigger)
-- -----------------------------------------------------------------------------
-- Nota: Si usas el trigger on_auth_user_created, la tabla ya existe.
-- Esta definici-n asegura que tenga todas las columnas que la app necesita.

CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    full_name   TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member', 'coach')),
    avatar_url  TEXT,
    credits     INT NOT NULL DEFAULT 0,
    phone       TEXT,
    balance     NUMERIC(10,2) DEFAULT 0,  -- saldo a favor (POS charge_to_account)
    gym_id      UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agregar columna balance si la tabla ya exist-a pero sin ella
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) DEFAULT 0;


-- -----------------------------------------------------------------------------
-- 2. CLASSES (horario semanal / clases recurrentes)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 3. BOOKINGS (reservaciones de clase)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 4. WAITLIST (lista de espera cuando una clase est- llena)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 5. MEMBERSHIPS (suscripciones / membres-as de alumnos)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 6. PRODUCTS (cat-logo: bebidas, suplementos, merch, planes)
-- -----------------------------------------------------------------------------
-- plan.server.ts guarda planes aqu- con category='plan' y metadata JSON.
-- order.server.ts / POS lee productos con is_active=true.

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
    metadata    JSONB DEFAULT '{}'::jsonb,  -- plan-specific: credits, validity_days, plan_type, is_popular, features
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 7. ORDERS (ventas POS, pagos de membres-a)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id            UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- null para ventas an-nimas POS
    customer_name     TEXT,                                                    -- nombre manual para POS
    type              TEXT DEFAULT 'pos'
                      CHECK (type IN ('pos', 'membership', 'renewal', 'event')),
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method    TEXT DEFAULT 'cash'
                      CHECK (payment_method IN ('mercado_pago', 'cash', 'card')),
    subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax               NUMERIC(10,2) NOT NULL DEFAULT 0,
    total             NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Alias compat: migration 001 expects 'amount' for weekly report
    amount            NUMERIC(10,2) GENERATED ALWAYS AS (total) STORED,
    mp_preference_id  TEXT,
    mp_payment_id     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 8. ORDER_ITEMS (l-neas de cada orden)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name  TEXT NOT NULL DEFAULT '',
    quantity      INT NOT NULL DEFAULT 1,
    unit_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 9. EVENTS (talleres, workshops, clases especiales)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    coach       TEXT NOT NULL DEFAULT '',
    start_time  TIMESTAMPTZ NOT NULL,
    duration    INT NOT NULL DEFAULT 60,       -- minutos
    capacity    INT NOT NULL DEFAULT 20,
    enrolled    INT NOT NULL DEFAULT 0,
    price       NUMERIC(10,2) NOT NULL DEFAULT 0,
    location    TEXT DEFAULT '',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 10. COACHES (instructores del gym)
-- -----------------------------------------------------------------------------

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
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 11. FITCOINS (gamificaci-n - transacciones de puntos)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fitcoins (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id        UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    amount        INT NOT NULL DEFAULT 0,          -- positivo = ganado, negativo = canjeado
    source        TEXT NOT NULL DEFAULT 'bonus'
                  CHECK (source IN ('attendance', 'referral', 'purchase', 'streak_bonus', 'redemption', 'bonus', 'admin_grant')),
    balance_after INT NOT NULL DEFAULT 0,
    description   TEXT NOT NULL DEFAULT '',
    reference_id  UUID,                             -- booking_id, order_id, etc.
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 12. LEADS (CRM - prospectos)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 13. ACCESS_LOGS (registro de acceso QR)
-- -----------------------------------------------------------------------------
-- Referenciada por get_churn_risk_users RPC en 002.

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


-- -----------------------------------------------------------------------------
-- 14. LOCATIONS (sedes f-sicas de un gym)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 15. ROOMS (salas dentro de una sede)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 16. CLASS_TYPES (tipos de clase: yoga, pilates, etc.)
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- 17. SCHEDULES (horarios semanales recurrentes)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    class_name  TEXT NOT NULL,
    coach_name  TEXT NOT NULL DEFAULT '',
    room_name   TEXT NOT NULL DEFAULT '',
    days        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- array of day strings: ["Lun","Mar","Jue"]
    time        TEXT NOT NULL DEFAULT '09:00',         -- HH:MM format
    duration    INT NOT NULL DEFAULT 60,               -- minutes
    capacity    INT NOT NULL DEFAULT 20,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- RLS: Tenant Isolation para tablas nuevas
-- =============================================================================
-- (profiles, classes, bookings, memberships, orders, fitcoins, leads ya tienen
--  RLS definido en 001. Aqu- agregamos las tablas nuevas.)

-- products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.products
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- order_items (acceso via join con orders, pero por seguridad)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.order_items
    FOR ALL USING (
        order_id IN (SELECT id FROM public.orders WHERE gym_id = (auth.jwt() ->> 'gym_id')::uuid)
    );

-- events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.events
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- coaches
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.coaches
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.access_logs
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- waitlist (si 001 no le puso RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.waitlist;
CREATE POLICY "tenant_isolation" ON public.waitlist
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.locations
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.rooms
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- class_types
ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.class_types
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

-- schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.schedules
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- =============================================================================
-- INDEXES para tablas nuevas
-- =============================================================================

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


-- =============================================================================
-- RPCs faltantes (referenciadas en el c-digo pero no definidas en 001/002)
-- =============================================================================

-- decrement_stock: Decrementar stock de un producto al venderlo en POS
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

-- deduct_balance: Decrementar saldo a favor de un usuario (POS charge_to_account)
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


-- =============================================================================
-- AUTO-UPDATE updated_at triggers
-- =============================================================================

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER memberships_updated_at
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- PROFILE AUTO-CREATE TRIGGER
-- =============================================================================
-- Cuando un usuario se registra en Supabase Auth, se crea su perfil autom-ticamente.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

-- Crear trigger solo si no existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 18. COUPONS (cupones de descuento)
-- -----------------------------------------------------------------------------

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_gym_code ON public.coupons(gym_id, code);
CREATE INDEX IF NOT EXISTS idx_coupons_gym_id ON public.coupons(gym_id);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.coupons
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- -----------------------------------------------------------------------------
-- 19. SPECIAL_PERIODS (vacaciones, d-as festivos, cierres)
-- -----------------------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS idx_special_periods_gym_id ON public.special_periods(gym_id);

ALTER TABLE public.special_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.special_periods
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- -----------------------------------------------------------------------------
-- 20. SUBSTITUTIONS (solicitudes de sustituci-n de coach)
-- -----------------------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS idx_substitutions_gym_id ON public.substitutions(gym_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_status ON public.substitutions(gym_id, status);

ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.substitutions
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- -----------------------------------------------------------------------------
-- 21. COACH_PAYROLL (registro de pago a coaches por per-odo)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coach_payroll (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    coach_id    UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    period      TEXT NOT NULL,  -- YYYY-MM format
    total       NUMERIC(10,2) NOT NULL DEFAULT 0,
    bonus       NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_paid     BOOLEAN NOT NULL DEFAULT false,
    paid_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_payroll_unique ON public.coach_payroll(gym_id, coach_id, period);
CREATE INDEX IF NOT EXISTS idx_coach_payroll_gym_id ON public.coach_payroll(gym_id);

ALTER TABLE public.coach_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.coach_payroll
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- -----------------------------------------------------------------------------
-- 22. PAYMENT_GATEWAYS (configuraci-n de pasarelas de pago por gym)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,  -- 'mercadopago', 'stripe', 'paypal'
    api_key_masked  TEXT,           -- only last 6 chars visible
    is_connected    BOOLEAN NOT NULL DEFAULT false,
    connected_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateways_unique ON public.payment_gateways(gym_id, provider);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_gym_id ON public.payment_gateways(gym_id);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.payment_gateways
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- Also add rate_per_session to coaches if not present
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS rate_per_session NUMERIC(10,2) DEFAULT 200;


-- -----------------------------------------------------------------------------
-- 23. PERSONAL_RECORDS (PRs de ejercicios por usuario)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.personal_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    exercise    TEXT NOT NULL,
    value       NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit        TEXT NOT NULL DEFAULT 'kg',
    previous    NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_visual  NUMERIC(10,2) NOT NULL DEFAULT 150,   -- for visual bar max
    history     JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{date, val}]
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_records_user_exercise
    ON public.personal_records(user_id, gym_id, exercise);
CREATE INDEX IF NOT EXISTS idx_personal_records_user
    ON public.personal_records(user_id, gym_id);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.personal_records
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- -----------------------------------------------------------------------------
-- 24. BODY_MEASUREMENTS (medidas corporales por usuario)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.body_measurements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id      UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    weight      NUMERIC(6,2),           -- kg
    height      NUMERIC(4,2),           -- metros
    measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user
    ON public.body_measurements(user_id, gym_id, measured_at DESC);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.body_measurements
    FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);


-- =============================================================================
-- VERIFICACI-N - Ejecutar esto para confirmar que todo se cre- correctamente
-- =============================================================================

SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Resultado esperado: 22+ tablas (profiles, classes, bookings, waitlist,
-- memberships, products, orders, order_items, events, coaches, fitcoins,
-- leads, access_logs, locations, rooms, class_types, schedules,
-- coupons, special_periods, substitutions, coach_payroll, payment_gateways,
-- gyms, gym_stats, user_stats, invoices)
