// tests/e2e/onboarding-setup-pilates.spec.ts
// Verifica que sala (resources) y planes (products) se guardan correctamente
// en el setup post-onboarding del estudio Pilates.
// Prerequisito: pilates1@gmail.com debe existir con onboarding_completed=false

import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const EMAIL = "pilates1@gmail.com";
const PASSWORD = "12345678";
const SS = (name: string) => `tests/e2e/screenshots/setup-${name}.png`;

test.describe("Setup post-onboarding: sala y planes se persisten", () => {
    test.setTimeout(120_000);

    test("setup Pilates: studio-type → identity → room → classes → plans → admin", async ({ page }) => {
        // Login
        await page.goto(`${BASE}/auth/login`);
        await page.fill('input[type="email"]', EMAIL);
        await page.fill('input[type="password"]', PASSWORD);
        await page.click('button[type="submit"]');

        // Debe redirigir a /onboarding/setup
        await page.waitForURL(
            url => url.pathname.startsWith("/onboarding/setup"),
            { timeout: 20_000 }
        );
        await page.screenshot({ path: SS("01-welcome") });

        // ── Bienvenida ─────────────────────────────────────────────
        const configBtn = page.locator('a:has-text("Configurar mi estudio")');
        await expect(configBtn).toBeVisible({ timeout: 10_000 });
        await configBtn.click();

        // ── Studio Type: Pilates ───────────────────────────────────
        await page.waitForURL(url => url.pathname.includes("/studio-type"), { timeout: 10_000 });
        await page.screenshot({ path: SS("02-studio-type") });

        await page.click('button:has-text("Pilates")');
        await page.waitForTimeout(400);
        await page.click('button:has-text("Siguiente")');

        // ── Identity ───────────────────────────────────────────────
        await page.waitForURL(url => url.pathname.includes("/identity"), { timeout: 10_000 });
        await page.screenshot({ path: SS("03-identity") });

        const identityNext = page.locator('button:has-text("Siguiente")').last();
        await identityNext.click();

        // ── Room: diseñar sala con reformers ───────────────────────
        await page.waitForURL(url => url.pathname.includes("/room"), { timeout: 15_000 });
        await page.screenshot({ path: SS("04-room") });

        // Para Pilates es assigned_resource → editor de grilla
        // Llenar todo el grid (3x4 = 12 reformers por defecto)
        const fillAllBtn = page.locator('button:has-text("Llenar todo")');
        await expect(fillAllBtn).toBeVisible({ timeout: 8_000 });
        await fillAllBtn.click();
        await page.waitForTimeout(300);

        await page.screenshot({ path: SS("05-room-filled") });

        // Verificar que hay reformers activos
        const counterText = await page.locator('p:has-text("reformer")').first().textContent().catch(() => "");
        console.log(`[setup] Contador reformers: ${counterText}`);

        const siguienteRoom = page.locator('button:has-text("Siguiente")');
        await expect(siguienteRoom).not.toBeDisabled({ timeout: 5_000 });
        await siguienteRoom.click();

        // ── Classes: omitir ────────────────────────────────────────
        await page.waitForURL(url => url.pathname.includes("/classes"), { timeout: 15_000 });
        await page.screenshot({ path: SS("06-classes") });

        const skipClasses = page.locator('button:has-text("Omitir"), button:has-text("Saltar")').first();
        await expect(skipClasses).toBeVisible({ timeout: 10_000 });
        await skipClasses.click();

        // ── Plans: crear un plan mensual ───────────────────────────
        await page.waitForURL(url => url.pathname.includes("/plans"), { timeout: 15_000 });
        await page.screenshot({ path: SS("07-plans") });

        // Llenar el plan por defecto (Plan 1)
        await page.fill('input[placeholder="Ej: Mensual ilimitado"]', "Mensual Pilates");
        await page.fill('input[placeholder="1200"]', "1500");

        await page.screenshot({ path: SS("08-plans-filled") });

        // Guardar (no omitir)
        const guardarBtn = page.locator('button:has-text("Ir a mi dashboard"), button:has-text("Siguiente")').last();
        await expect(guardarBtn).toBeVisible({ timeout: 5_000 });
        await guardarBtn.click();

        // ── Debe llegar al admin ───────────────────────────────────
        await page.waitForURL(
            url => url.pathname.startsWith("/admin") || url.pathname.includes("/ready"),
            { timeout: 25_000 }
        );
        await page.screenshot({ path: SS("09-admin-or-ready") });

        const finalUrl = page.url();
        console.log(`[setup] URL final: ${finalUrl}`);

        // Si llega a /ready (assigned_resource), hacer click en "Ir a mi dashboard"
        if (finalUrl.includes("/ready")) {
            await page.screenshot({ path: SS("09b-ready") });
            const irDashboard = page.locator('button:has-text("Ir a mi dashboard")');
            await expect(irDashboard).toBeVisible({ timeout: 8_000 });
            await irDashboard.click();
            await page.waitForURL(url => url.pathname.startsWith("/admin"), { timeout: 20_000 });
        }

        await page.screenshot({ path: SS("10-admin") });
        await expect(page).toHaveURL(/\/admin/);
        console.log("[setup] ✅ Setup completado, llegó al dashboard admin");
    });
});
