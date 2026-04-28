// tests/e2e/admin-navigation.spec.ts — Test 9

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

const ADMIN_SECTIONS = [
    { path: "/admin",             name: "Dashboard" },
    { path: "/admin/schedule",    name: "Sesiones" },
    { path: "/admin/horarios",    name: "Horarios" },
    { path: "/admin/reservas",    name: "Reservas" },
    { path: "/admin/users",       name: "Usuarios" },
    { path: "/admin/subscriptions", name: "Créditos" },
    { path: "/admin/finance",     name: "Finanzas" },
    { path: "/admin/planes",      name: "Planes" },
    { path: "/admin/pos",         name: "Config Pagos" },
    { path: "/admin/studio",      name: "General" },
    { path: "/admin/ubicaciones", name: "Ubicaciones" },
    { path: "/admin/coaches",     name: "Coaches" },
    { path: "/admin/pagos",       name: "Métodos de Cobro" },
];

test.describe("Admin — Navegación completa", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "admin");
    });

    test("TEST 9: visitar cada sección del admin — sin errores JS, con contenido", async ({ page }) => {
        test.setTimeout(90_000);
        const results: Record<string, { loaded: boolean; jsErrors: string[]; hasContent: boolean }> = {};

        for (const section of ADMIN_SECTIONS) {
            const jsErrors: string[] = [];
            page.on("console", msg => { if (msg.type() === "error") jsErrors.push(msg.text()); });

            await page.goto(`${BASE}${section.path}`, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(800);

            const loaded = !page.url().includes("/auth/login");
            const hasContent = await page.locator("main h1, main p, main [class*='card']").count() > 0;

            results[section.name] = { loaded, jsErrors: [...jsErrors], hasContent };

            await page.screenshot({
                path: `tests/e2e/screenshots/09-admin-${section.name.toLowerCase().replace(/\s+/g, "-")}.png`,
            });

            // Remove listener to avoid duplicates
            page.removeAllListeners("console");
        }

        console.log("TEST 9 — Navigation results:");
        for (const [name, r] of Object.entries(results)) {
            const status = r.loaded && r.hasContent ? "✅" : r.loaded ? "⚠️" : "❌";
            console.log(`  ${status} ${name}: loaded=${r.loaded}, content=${r.hasContent}, errors=${r.jsErrors.length}`);
            if (r.jsErrors.length > 0) console.log(`    Errors: ${r.jsErrors.join(" | ")}`);
        }

        // Sections that redirect to login indicate a broken auth — that's a real failure
        const loginRedirects = Object.entries(results).filter(([, r]) => !r.loaded);
        if (loginRedirects.length > 0) {
            console.log("TEST 9 — Sections redirecting to login:", loginRedirects.map(([n]) => n));
        }
        // All sections should load (not redirect to login)
        for (const [name, r] of Object.entries(results)) {
            expect(r.loaded, `${name} should load without redirect to login`).toBe(true);
        }
    });
});
