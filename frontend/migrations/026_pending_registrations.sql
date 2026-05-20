-- 026_pending_registrations.sql
-- Almacena datos del onboarding antes de confirmar pago.
-- El webhook de MP lee este registro y crea el usuario + gym al confirmar.

create table if not exists pending_registrations (
    id           uuid primary key default gen_random_uuid(),
    email        text not null,
    password_hash text not null,        -- bcrypt hash, nunca texto plano
    owner_name   text not null,
    studio_name  text not null,
    studio_type  text,
    plan_id      text not null,
    cycle        text not null,
    country_code text not null,
    city         text,
    phone        text,
    landing_page_upsell boolean default false,
    mp_preference_id text,              -- id de la preferencia de MP (trimestral/anual)
    mp_preapproval_id text,             -- id del preapproval de MP (mensual)
    status       text not null default 'pending', -- pending | completed | failed
    created_at   timestamptz default now(),
    expires_at   timestamptz default (now() + interval '2 hours')
);

-- Limpiar registros expirados automáticamente
create index if not exists idx_pending_reg_email on pending_registrations(email);
create index if not exists idx_pending_reg_status on pending_registrations(status);
create index if not exists idx_pending_reg_mp_pref on pending_registrations(mp_preference_id);
create index if not exists idx_pending_reg_mp_pre on pending_registrations(mp_preapproval_id);

-- RLS: solo service_role puede leer/escribir
alter table pending_registrations enable row level security;
create policy "service_role only" on pending_registrations
    using (auth.role() = 'service_role');
