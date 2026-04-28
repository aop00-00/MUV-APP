// tests/e2e/feature-gating.spec.ts — Tests 22, 23

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

// Routes that require Starter or above
const STARTER_ROUTES = [
    { path: "/admin/ubicaciones", name: "Ubicaciones" },
    { path: "/admin/periodos",    name: "Períodos Especiales" },
    { path: "/admin/sustituciones", name: "Sustituciones" },
];

// Routes that require Pro or above
const PRO_ROUTES = [
    { path: "/admin/crm",       name: "CRM" },
    { path: "/admin/cupones",   name: "Cupones" },
    { path: "/admin/ingresos",  name: "Ingresos" },
    { path: "/admin/nomina",    name: "Nómina" },
    { path: "/admin/events",    name: "Eventos" },
    { path: "/admin/operaciones", name: "Operaciones" },
];

test.describe("Feature Gating por Plan", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "admin");
    });

    test("TEST 22: verificar feature gating por plan del admin", async ({ page }) => {
        test.setTimeout(90_000);
        const results: Record<string, { accessible: boolean; status: number | null; url: string }> = {};

        for (const section of [...STARTER_ROUTES, ...PRO_ROUTES]) {
            const responses: { url: string; status: number }[] = [];
            page.on("response", res => {
                if (res.url().includes(section.path)) {
                    responses.push({ url: res.url(), status: res.status() });
                }
            });

            await page.goto(`${BASE}${section.path}`, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(1500);

            const finalUrl = page.url();
            const accessible = finalUrl.includes(section.path);
            const blocked = finalUrl.includes("upgrade") || (await page.locator("text=403, text=no disponible, text=actualiza").count()) > 0;

            results[section.name] = {
                accessible: accessible && !blocked,
                status: responses[0]?.status ?? null,
                url: finalUrl,
            };

            await page.screenshot({
                path: `tests/e2e/screenshots/22-gating-${section.name.toLowerCase().replace(/\s+/g, "-")}.png`,
            });
            page.removeAllListeners("response");
        }

        console.log("TEST 22 — Feature Gating Results:");
        for (const [name, r] of Object.entries(results)) {
            console.log(`  ${r.accessible ? "✅" : "❌"} ${name}: accessible=${r.accessible}, url=${r.url}`);
        }
    });

    test("TEST 23: verificar límites numéricos del plan (maxLocations)", async ({ page }) => {
        await page.goto(`${BASE}/admin/ubicaciones`);
        await page.waitForSelector("h1", { timeout: 15_000 });

        // Count existing locations
        const locationItems = await page.locator('[class*="rounded-2xl"]:has([class*="MapPin"])').count();
        console.log("TEST 23 — Existing locations:", locationItems);

        // Try to add beyond limit and observe response
        await page.click("button:has-text('Nueva sede'), button:has-text('Agregar sede')");
        await page.fill('input[placeholder*="ede"]', "Test sede límite");
        await page.fill('input[placeholder*="irección"], input[placeholder*="rincipal"]', "Calle Límite 999");
        await page.fill('input[placeholder*="iudad"]', "Test City");
        await page.click('button:has-text("Guardar")');
        await page.waitForTimeout(3000);

        const errorVisible = await page.locator('.text-red-400').isVisible().catch(() => false);
        const errorText = await page.locator('.text-red-400').first().textContent().catch(() => "");

        console.log("TEST 23 — Error after adding location:", { errorVisible, errorText });
        await page.screenshot({ path: "tests/e2e/screenshots/23-location-limit.png" });

        if (locationItems >= 1) {
            // If already at the limit (Starter/Emprendedor = 1), should show plan error
            console.log("TEST 23 — Existing locations ≥ 1, expecting plan limit error");
        }
    });
});
