import {
    type RouteConfig,
    index,
    route,
    layout,
    prefix,
} from "@react-router/dev/routes";

export default [
    // ─── Landing Page (Marketing) ────────────────────────────────
    index("routes/_index.tsx"),
    route("producto", "routes/producto.tsx"),

    // ─── Auth ────────────────────────────────────────────────────
    route("auth/login", "routes/auth/login.tsx"),
    route("auth/register", "routes/auth/register.tsx"),
    route("auth/logout", "routes/auth/logout.tsx"),

    // ─── Onboarding (SaaS customer journey) ─────────────────────
    ...prefix("onboarding", [
        layout("routes/onboarding/layout.tsx", [
            index("routes/onboarding/_index.tsx"), // Checkout existente (5 pasos)
            // NEW: Post-checkout setup wizard (6-7 pasos adaptativos)
            ...prefix("setup", [
                layout("routes/onboarding/setup/layout.tsx", [
                    index("routes/onboarding/setup/_index.tsx"),           // Paso 1: Welcome
                    route("studio-type", "routes/onboarding/setup/studio-type.tsx"),  // Paso 2
                    route("identity", "routes/onboarding/setup/identity.tsx"),        // Paso 3
                    route("room", "routes/onboarding/setup/room.tsx"),               // Paso 4 (adaptativo)
                    route("classes", "routes/onboarding/setup/classes.tsx"),         // Paso 5
                    route("plans", "routes/onboarding/setup/plans.tsx"),             // Paso 6
                    route("ready", "routes/onboarding/setup/ready.tsx"),             // Paso 7
                ]),
            ]),
        ]),
    ]),

    // ─── Dashboard (Client View) ─────────────────────────────────
    ...prefix("dashboard", [
        layout("routes/dashboard/layout.tsx", [
            index("routes/dashboard/_index.tsx"),
            route("schedule", "routes/dashboard/schedule.tsx"),
            route("store", "routes/dashboard/store.tsx"),
            route("packages", "routes/dashboard/packages.tsx"),
            route("profile", "routes/dashboard/profile.tsx"),
            route("fitcoins", "routes/dashboard/fitcoins.tsx"),
            route("checkout/:packId", "routes/dashboard/checkout/$packId.tsx"),
            route("checkout/success", "routes/dashboard/checkout/success.tsx"),
            route("progreso", "routes/dashboard/progreso.tsx"),
            route("strava/connect", "routes/dashboard/strava/connect.ts"),
            route("strava/callback", "routes/dashboard/strava/callback.ts"),
        ]),
    ]),

    // ─── Admin Panel (Protected by role='admin') ─────────────────
    ...prefix("admin", [
        // Upgrade page outside layout to avoid requireGymAdmin redirect loop
        route("upgrade", "routes/admin/upgrade.tsx"),
        layout("routes/admin/layout.tsx", [
            index("routes/admin/_index.tsx"),
            // ── Clientes ──────────────────────────────────────────
            route("users", "routes/admin/users.tsx"),
            route("subscriptions", "routes/admin/subscriptions.tsx"),
            route("finance", "routes/admin/finance.tsx"),
            // ── Agenda ────────────────────────────────────────────
            route("schedule", "routes/admin/schedule.tsx"),
            route("horarios", "routes/admin/horarios.tsx"),
            route("periodos", "routes/admin/periodos.tsx"),
            route("sustituciones", "routes/admin/sustituciones.tsx"),
            route("events", "routes/admin/events.tsx"),
            route("reservas", "routes/admin/reservas.tsx"),
            // ── Negocio ───────────────────────────────────────────
            route("planes", "routes/admin/planes.tsx"),
            route("cupones", "routes/admin/cupones.tsx"),
            route("ingresos", "routes/admin/ingresos.tsx"),
            route("nomina", "routes/admin/nomina.tsx"),
            route("pos", "routes/admin/pos.tsx"),
            // ── Otros ─────────────────────────────────────────────
            route("crm", "routes/admin/crm.tsx"),
            // ── Mi Estudio ────────────────────────────────────────
            route("studio", "routes/admin/studio.tsx"),
            route("ubicaciones", "routes/admin/ubicaciones.tsx"),
            route("operaciones", "routes/admin/operaciones.tsx"),
            route("coaches", "routes/admin/coaches.tsx"),
            route("pagos", "routes/admin/pagos.tsx"),
        ]),
    ]),

    // ─── Staff / Front Desk Panel (Protected by role='front_desk' or 'admin') ──
    ...prefix("staff", [
        layout("routes/staff/layout.tsx", [
            index("routes/staff/_index.tsx"),
            route("checkin",  "routes/staff/checkin.tsx"),
            route("schedule", "routes/staff/schedule.tsx"),
            route("pos",      "routes/staff/pos.tsx"),
            route("walkin",   "routes/staff/walkin.tsx"),
        ]),
    ]),

    // ─── Barista Panel (Protected by role='coach') ───────────────
    ...prefix("barista", [
        layout("routes/barista/layout.tsx", [
            index("routes/barista/_index.tsx"),
            route("products", "routes/barista/products.tsx"),
        ]),
    ]),

    // ─── API / Webhooks (No UI) ──────────────────────────────────
    route("api/debug-db", "routes/api/debug-db.ts"),
    route("api/test-auth", "routes/api/test-auth.ts"),
    route("api/resources", "routes/api/resources.ts"),
    route("api/strava-webhook", "routes/api/strava-webhook.ts"),

    // ─── Cron Jobs (Vercel Cron — protected by CRON_SECRET) ──────
    route("cron/inactivity-check", "routes/cron/inactivity-check.ts"),

    // ─── Gym Portal (Slug-based branded login/register) ─────────
    // MUST be last — dynamic segment only matches when no static route does
    route(":slug", "routes/gym-portal.tsx"),
] satisfies RouteConfig;


