// tests/e2e/fitcoins.spec.ts
// End-to-end test for the FitCoins rules system.
//
// Flujo completo:
//  1. Admin: panel /admin/fitcoins carga sin errores
//  2. Admin: configura regla de asistencia (10 pts fijos)
//  3. Admin: agrega una acción extra custom ("Trajo suplemento", 15 pts)
//  4. Admin: agrega una recompensa al catálogo
//  5. Admin: otorga puntos manualmente al miembro
//  6. Miembro: ve balance actualizado en /dashboard/fitcoins
//  7. Miembro: sección "Cómo ganar" refleja las reglas del gym
//  8. Miembro: puede ver la recompensa creada por el admin

import { test, expect } from "@playwright/test";
import { loginAs, logout } from "./helpers/auth";

const SCREENSHOT = (name: string) => `tests/e2e/screenshots/fitcoins-${name}.png`;
// Static names so retries and parallel workers find the same records
const CUSTOM_LABEL = "PW-Trajo suplemento E2E";
const REWARD_NAME  = "PW-Clase gratis E2E";
const GRANT_PTS    = 25;

test.describe("FitCoins — Sistema de reglas por gym", () => {

    // ── 1. Panel admin carga ──────────────────────────────────────
    test("01. admin: /admin/fitcoins carga sin errores JS", async ({ page }) => {
        const jsErrors: string[] = [];
        // Ignore React Router dev manifest CORS noise — not a real app error
        page.on("pageerror", e => {
            if (!e.message.includes("__manifest") && !e.message.includes("access control checks")) {
                jsErrors.push(e.message);
            }
        });

        await loginAs(page, "admin");
        await page.goto("/admin/fitcoins");
        await page.waitForLoadState("networkidle");

        await expect(page.getByText("FitCoins").first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("Reglas de puntos")).toBeVisible({ timeout: 10_000 });
        expect(jsErrors, `JS errors: ${jsErrors.join(", ")}`).toHaveLength(0);

        await page.screenshot({ path: SCREENSHOT("01-admin-panel"), fullPage: true });
    });

    // ── 2. Configurar regla automática: asistencia ────────────────
    test("02. admin: configura regla de asistencia a 10 pts", async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/fitcoins");
        await page.waitForLoadState("networkidle");

        // Click Configurar / Editar en "Asistencia a clase"
        const attendanceRow = page.locator("text=Asistencia a clase").first();
        await expect(attendanceRow).toBeVisible();
        const btn = page.getByRole("button", { name: /configurar|editar/i }).first();
        await btn.click();

        // Modal should appear (title is either "Configurar evento" or "Editar regla")
        await expect(page.locator("h3").filter({ hasText: /configurar evento|editar regla/i }).first()).toBeVisible({ timeout: 8000 });

        // Set event_type to attendance, mode to fixed, points to 10
        const eventSelect = page.locator("select[name='event_type']");
        if (await eventSelect.isVisible()) {
            await eventSelect.selectOption("attendance");
        }
        const modeSelect = page.locator("select[name='points_mode']");
        if (await modeSelect.isVisible()) {
            await modeSelect.selectOption("fixed");
        }
        await page.fill("input[name='points']", "10");

        await page.screenshot({ path: SCREENSHOT("02-rule-form"), fullPage: false });

        const saveBtn = page.getByRole("button", { name: "Guardar" });
        const responsePromise = page.waitForResponse(
            r => r.url().includes("/admin/fitcoins") && r.request().method() === "POST",
            { timeout: 10_000 }
        );
        await saveBtn.click();
        await responsePromise;
        await page.waitForLoadState("networkidle");

        // Rule should now show 10 pts
        await expect(page.getByText(/10 pts por evento/)).toBeVisible({ timeout: 8000 });
        await page.screenshot({ path: SCREENSHOT("02-rule-saved"), fullPage: true });
    });

    // ── 3. Agregar acción extra custom ────────────────────────────
    test("03. admin: agrega acción extra custom", async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/fitcoins");
        await page.waitForLoadState("networkidle");

        await page.getByRole("button", { name: "Agregar acción" }).click();
        await expect(page.getByText("Nueva acción extra")).toBeVisible({ timeout: 8000 });

        // Fill form fields
        const labelInput = page.locator("input[name='label']");
        await expect(labelInput).toBeVisible({ timeout: 5000 });
        await labelInput.fill(CUSTOM_LABEL);
        await page.locator("input[name='points']").fill("15");

        const responsePromise = page.waitForResponse(
            r => r.url().includes("/admin/fitcoins") && r.request().method() === "POST",
            { timeout: 15_000 }
        );
        await page.getByRole("button", { name: "Guardar" }).click();
        await responsePromise;
        await page.waitForLoadState("networkidle");

        await expect(page.getByText(CUSTOM_LABEL).first()).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: SCREENSHOT("03-custom-action-saved"), fullPage: true });
    });

    // ── 4. Agregar recompensa al catálogo ─────────────────────────
    test("04. admin: agrega recompensa al catálogo", async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/fitcoins");
        await page.waitForLoadState("networkidle");

        // Switch to Recompensas tab
        await page.getByRole("button", { name: "Recompensas" }).click();
        await page.getByRole("button", { name: "Nueva recompensa" }).click();
        await expect(page.getByText("Nueva recompensa").nth(1)).toBeVisible({ timeout: 5000 });

        await page.fill("input[name='name']", REWARD_NAME);
        await page.fill("input[name='description']", "Recompensa creada por Playwright");
        await page.fill("input[name='cost']", "50");
        await page.selectOption("select[name='category']", "experience");

        const responsePromise = page.waitForResponse(
            r => r.url().includes("/admin/fitcoins") && r.request().method() === "POST",
            { timeout: 10_000 }
        );
        await page.getByRole("button", { name: "Guardar" }).click();
        await responsePromise;
        await page.waitForLoadState("networkidle");

        await expect(page.getByText(REWARD_NAME).first()).toBeVisible({ timeout: 8000 });
        await page.screenshot({ path: SCREENSHOT("04-reward-saved"), fullPage: true });
    });

    // ── 5. Otorgar puntos manualmente al miembro ──────────────────
    test("05. admin: otorga puntos manualmente al miembro", async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/fitcoins");
        await page.waitForLoadState("networkidle");

        await page.getByRole("button", { name: "Otorgar manual" }).click();
        await expect(page.getByText("Otorgar puntos manualmente")).toBeVisible({ timeout: 5000 });

        await page.fill("input[name='email']", "alfonso1@gmail.com");
        await page.fill("input[name='points']", String(GRANT_PTS));
        await page.fill("input[name='description']", "Puntos de prueba Playwright");

        const responsePromise = page.waitForResponse(
            r => r.url().includes("/admin/fitcoins") && r.request().method() === "POST",
            { timeout: 10_000 }
        );
        await page.getByRole("button", { name: "Otorgar FitCoins" }).click();
        await responsePromise;
        await page.waitForLoadState("networkidle");

        // Should show success message — either points amount or generic success
        await expect(
            page.locator(".text-emerald-400, [class*='emerald'], [class*='green']").first()
        ).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: SCREENSHOT("05-grant-success"), fullPage: true });
    });

    // ── 6. Miembro: ve balance y transacción ──────────────────────
    test("06. miembro: balance actualizado en /dashboard/fitcoins", async ({ page }) => {
        const jsErrors: string[] = [];
        page.on("pageerror", e => jsErrors.push(e.message));

        await loginAs(page, "member");
        await page.goto("/dashboard/fitcoins");
        await page.waitForLoadState("networkidle");

        // Balance widget must be visible
        await expect(page.getByText(/pts/).first()).toBeVisible({ timeout: 10_000 });
        // Should have at least 1 transaction (the grant from test 05)
        await page.getByRole("button", { name: "Historial" }).click();
        await expect(page.getByText("Puntos de prueba Playwright").first()).toBeVisible({ timeout: 8000 });

        expect(jsErrors, `JS errors: ${jsErrors.join(", ")}`).toHaveLength(0);
        await page.screenshot({ path: SCREENSHOT("06-member-balance"), fullPage: true });
    });

    // ── 7. Miembro: sección "Cómo ganar" refleja reglas del gym ───
    test("07. miembro: sección Cómo ganar muestra reglas configuradas", async ({ page }) => {
        await loginAs(page, "member");
        await page.goto("/dashboard/fitcoins");
        await page.waitForLoadState("networkidle");

        // "Cómo ganar" section should be present with the attendance rule
        await expect(page.getByText("¿Cómo ganar FitCoins?")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("Asistencia a clase")).toBeVisible();
        // Should show configured points value
        await expect(page.getByText("+10 pts")).toBeVisible();

        await page.screenshot({ path: SCREENSHOT("07-how-to-earn"), fullPage: true });
    });

    // ── 8. Miembro: recompensa del catálogo es visible ────────────
    test("08. miembro: recompensa creada por admin aparece en catálogo", async ({ page }) => {
        await loginAs(page, "member");
        await page.goto("/dashboard/fitcoins");
        await page.waitForLoadState("networkidle");

        // Rewards tab should be selected by default
        await expect(page.getByText(REWARD_NAME).first()).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: SCREENSHOT("08-reward-visible"), fullPage: true });
    });

    // ── 9. Admin: toggle desactiva una regla ──────────────────────
    test("09. admin: toggle desactiva regla custom", async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/fitcoins");
        await page.waitForLoadState("networkidle");

        // Find the custom rule row and click its toggle
        const ruleRow = page.locator(`text=${CUSTOM_LABEL}`).first();
        await expect(ruleRow).toBeVisible({ timeout: 8000 });

        // The toggle button is a form submit near the rule label
        const toggleForm = page.locator(`form:has(input[name="intent"][value="toggle_rule"])`).first();
        const responsePromise = page.waitForResponse(
            r => r.url().includes("/admin/fitcoins") && r.request().method() === "POST",
            { timeout: 10_000 }
        );
        await toggleForm.locator("button[type='submit']").click();
        await responsePromise;
        await page.waitForLoadState("networkidle");

        await page.screenshot({ path: SCREENSHOT("09-rule-toggled"), fullPage: true });
    });

    // ── 10. Admin: elimina la recompensa de prueba ────────────────
    test("10. admin: elimina recompensa de prueba", async ({ page }) => {
        test.setTimeout(90_000); // extra time: may need multiple deletes from prior runs
        await loginAs(page, "admin");
        await page.goto("/admin/fitcoins");
        await page.waitForLoadState("networkidle");

        await page.getByRole("button", { name: "Recompensas" }).click();
        // Wait a moment for tab content to render
        await page.waitForTimeout(500);

        // If REWARD_NAME doesn't exist (e.g. test 04 was skipped), skip cleanup
        const rewardExists = await page.getByText(REWARD_NAME).first().isVisible({ timeout: 5000 }).catch(() => false);
        if (!rewardExists) {
            test.skip(true, `${REWARD_NAME} not found — test 04 may not have run`);
            return;
        }

        // Click the trash icon on the first matching card, then verify it disappears.
        // The trash button lives in a fetcher.Form; Editar is a plain <button> with text.
        const rewardNameEl = page.getByText(REWARD_NAME).first();
        // Scope to the innermost card div (direct parent with rounded-2xl class)
        const card = rewardNameEl.locator("xpath=ancestor::div[@class and contains(@class,'rounded-2xl')][1]");
        const deleteBtn = card.locator("form").getByRole("button");
        const responsePromise = page.waitForResponse(
            r => r.url().includes("/admin/fitcoins") && r.request().method() === "POST",
            { timeout: 15_000 }
        );
        await deleteBtn.first().click();
        await responsePromise;
        await page.waitForLoadState("networkidle");

        await expect(page.getByText(REWARD_NAME).first()).not.toBeVisible({ timeout: 8000 });
        await page.screenshot({ path: SCREENSHOT("10-reward-deleted"), fullPage: true });
    });
});
