// tests/e2e/admin-locations.spec.ts — Tests 6, 7, 8

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

test.describe("Admin — Gestión de Sedes (Bug de Ubicaciones)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "admin");
    });

    test("TEST 6: navegar a gestión de sedes → página carga sin errores", async ({ page }) => {
        const consoleErrors: string[] = [];
        const failedRequests: string[] = [];
        page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
        page.on("requestfailed", req => failedRequests.push(`${req.method()} ${req.url()}`));

        await page.screenshot({ path: "tests/e2e/screenshots/06-before-ubicaciones.png" });
        await page.goto(`${BASE}/admin/ubicaciones`);

        // Page should load with h1
        await expect(page.locator("h1").filter({ hasText: /[Uu]bicacion/ })).toBeVisible({ timeout: 15_000 });

        await page.screenshot({ path: "tests/e2e/screenshots/06-ubicaciones-loaded.png" });
        console.log("TEST 6 — Console errors:", consoleErrors);
        console.log("TEST 6 — Failed requests:", failedRequests);
    });

    test("TEST 7: intentar agregar sede → capturar todos los errores", async ({ page }) => {
        const consoleErrors: string[] = [];
        const failedRequests: string[] = [];
        const failedResponses: { url: string; status: number; body: string }[] = [];

        page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
        page.on("requestfailed", req => failedRequests.push(`${req.method()} ${req.url()}`));
        page.on("response", async res => {
            if (!res.ok() && res.url().includes("supabase")) {
                try {
                    const body = await res.text();
                    failedResponses.push({ url: res.url(), status: res.status(), body });
                } catch {}
            }
        });

        await page.goto(`${BASE}/admin/ubicaciones`);
        await page.waitForSelector("h1", { timeout: 15_000 });

        // Click "Nueva sede"
        await page.click("button:has-text('Nueva sede'), button:has-text('Agregar sede')");
        await page.screenshot({ path: "tests/e2e/screenshots/07-modal-open.png" });

        // Fill form
        await page.fill('input[placeholder*="ede"]', "Sede Test Playwright");
        await page.fill('input[placeholder*="irección"], input[placeholder*="rincipal"]', "Av. Test 123");
        await page.fill('input[placeholder*="iudad"]', "Ciudad de México");

        await page.screenshot({ path: "tests/e2e/screenshots/07-form-filled.png" });

        // Submit
        await page.click('button:has-text("Guardar")');
        await page.waitForTimeout(3000);

        await page.screenshot({ path: "tests/e2e/screenshots/07-after-submit.png" });

        // Check if error message appeared in UI
        const errorEl = page.locator('.text-red-400, [class*="red"]').first();
        const hasUIError = await errorEl.isVisible().catch(() => false);

        console.log("TEST 7 — UI error visible:", hasUIError);
        if (hasUIError) {
            console.log("TEST 7 — UI error text:", await errorEl.textContent());
        }
        console.log("TEST 7 — Console errors:", JSON.stringify(consoleErrors));
        console.log("TEST 7 — Failed requests:", JSON.stringify(failedRequests));
        console.log("TEST 7 — Failed Supabase responses:", JSON.stringify(failedResponses));
    });

    test("TEST 8: verificar si el error es por límite de plan vs bug técnico", async ({ page }) => {
        await page.goto(`${BASE}/admin/ubicaciones`);
        await page.waitForSelector("h1", { timeout: 15_000 });

        // Count existing locations
        const locationCards = await page.locator('[class*="rounded-2xl"]').count();
        console.log("TEST 8 — Existing location cards:", locationCards);

        // Try to add a new location and check the error
        await page.click("button:has-text('Nueva sede'), button:has-text('Agregar sede')");
        await page.fill('input[placeholder*="ede"]', "Segunda sede test");
        await page.fill('input[placeholder*="irección"], input[placeholder*="rincipal"]', "Calle Test 456");
        await page.fill('input[placeholder*="iudad"]', "Guadalajara");
        await page.click('button:has-text("Guardar")');
        await page.waitForTimeout(3000);

        // Check error text to classify
        const errorText = await page.locator('.text-red-400').first().textContent().catch(() => "");
        console.log("TEST 8 — Error text:", errorText);

        const isPlanLimit = errorText?.toLowerCase().includes("plan") || errorText?.toLowerCase().includes("máximo");
        const isTechnical = errorText?.toLowerCase().includes("error") && !isPlanLimit;

        console.log(`TEST 8 — Error classification: ${isPlanLimit ? "PLAN LIMIT" : isTechnical ? "TECHNICAL BUG" : "NO ERROR / UNKNOWN"}`);
        await page.screenshot({ path: "tests/e2e/screenshots/08-error-classification.png" });
    });
});
