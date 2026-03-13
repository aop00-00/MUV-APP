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

    // ─── Auth ────────────────────────────────────────────────────
    route("auth/login", "routes/auth/login.tsx"),
    route("auth/register", "routes/auth/register.tsx"),
    route("auth/logout", "routes/auth/logout.tsx"),

    // ─── Onboarding (SaaS customer journey) ─────────────────────
    ...prefix("onboarding", [
        layout("routes/onboarding/layout.tsx", [
            index("routes/onboarding/_index.tsx"),
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
        ]),
    ]),

    // ─── Admin Panel (Protected by role='admin') ─────────────────
    ...prefix("admin", [
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

    // ─── Barista Panel (Protected by role='coach') ───────────────
    ...prefix("barista", [
        layout("routes/barista/layout.tsx", [
            index("routes/barista/_index.tsx"),
            route("products", "routes/barista/products.tsx"),
        ]),
    ]),

    // ─── API / Webhooks (No UI) ──────────────────────────────────
] satisfies RouteConfig;

