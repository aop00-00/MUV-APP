// tests/e2e/onboarding-pilates-fix.spec.ts
// Verifica que el bug gyms_plan_status_check está corregido:
// crear un estudio de pilates con plan Pro usando pilates1@gmail.com

import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const EMAIL = "pilates1@gmail.com";
const PASSWORD = "12345678";
const SS = (name: string) => `tests/e2e/screenshots/pilates-${name}.png`;

test.describe("Fix: onboarding plan Pro sin error plan_status", () => {
    test.setTimeout(120_000);

    test("crear estudio Pilates con plan Pro + transferencia — sin error DB", async ({ page }) => {
        // Capturar todos los logs de consola para diagnóstico
        const consoleLogs: string[] = [];
        page.on("console", msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

        await page.goto(`${BASE}/onboarding`);

        // ── Paso 1: Seleccionar plan Pro ───────────────────────────
        await page.waitForSelector('text=Paso 1 de 4', { timeout: 15_000 });
        await page.screenshot({ path: SS("01-paso1") });

        await page.click('button:has-text("Pro")');
        await page.waitForTimeout(800);
        await page.click('button:has-text("Confirmar plan Pro")');

        // ── Paso 2: Datos del estudio ──────────────────────────────
        await page.waitForSelector('text=Paso 2 de 4', { timeout: 15_000 });
        await page.screenshot({ path: SS("02-paso2") });

        await page.fill('input[placeholder="Ej: Studio Valentina Pilates"]', "Studio Pilates 1");

        const pilatesBtn = page.locator('button:has-text("Pilates")').first();
        await expect(pilatesBtn).toBeVisible({ timeout: 5_000 });
        await pilatesBtn.click();

        await page.selectOption('select', 'MX');
        await page.fill('input[placeholder="CDMX"]', "León");

        await page.screenshot({ path: SS("03-paso2-filled") });

        const nextBtn = page.locator('button:has-text("Siguiente paso →")').first();
        await expect(nextBtn).not.toBeDisabled({ timeout: 5_000 });
        await nextBtn.click();

        // ── Paso 3: Datos de la cuenta ─────────────────────────────
        await page.waitForSelector('text=Paso 3 de 4', { timeout: 15_000 });
        await page.screenshot({ path: SS("04-paso3") });

        const textInputs = page.locator(
            'div:has(label:has-text("Nombre")) input[type="text"], div:has(label:has-text("Apellido")) input[type="text"]'
        );
        await textInputs.nth(0).fill("Pilates");
        await textInputs.nth(1).fill("Uno");
        await page.fill('input[type="email"]', EMAIL);
        const pwInputs = page.locator('input[type="password"]');
        await pwInputs.nth(0).fill(PASSWORD);
        await pwInputs.nth(1).fill(PASSWORD);

        await page.screenshot({ path: SS("05-paso3-filled") });

        const nextBtn2 = page.locator('button:has-text("Siguiente paso →")').first();
        await expect(nextBtn2).not.toBeDisabled({ timeout: 5_000 });
        await nextBtn2.click();

        // ── Paso 4: Pago — transferencia ───────────────────────────
        await page.waitForSelector('text=Paso 4 de 4', { timeout: 15_000 });
        await page.screenshot({ path: SS("06-paso4") });

        await page.click('button:has-text("Transferencia")');
        await page.waitForTimeout(500);

        const submitBtn = page.locator('button[type="submit"]:has-text("Activar mi cuenta")');
        await expect(submitBtn).toBeVisible({ timeout: 5_000 });
        await expect(submitBtn).not.toBeDisabled();

        await page.screenshot({ path: SS("07-paso4-ready") });

        // Click submit y esperar la respuesta real del servidor (hasta 40s)
        await Promise.all([
            page.waitForResponse(
                res => res.url().includes("/onboarding") && res.request().method() === "POST",
                { timeout: 40_000 }
            ),
            submitBtn.click(),
        ]);

        // Esperar a que React Router procese la respuesta
        await page.waitForTimeout(3_000);
        await page.screenshot({ path: SS("08-after-submit") });

        const currentUrl = page.url();
        console.log(`[pilates] URL después del submit: ${currentUrl}`);

        // Capturar texto de la página
        const pageText = await page.locator("body").innerText().catch(() => "");
        const first800 = pageText.substring(0, 800);
        console.log(`[pilates] Texto del body:\n${first800}`);
        console.log(`[pilates] Console logs:\n${consoleLogs.slice(-10).join("\n")}`);

        // Verificar que NO hay error de constraint de base de datos
        const hasDbConstraintError = await page.locator(':text("gyms_plan_status_check")').isVisible({ timeout: 2_000 }).catch(() => false);
        expect(hasDbConstraintError, "No debe aparecer el error gyms_plan_status_check").toBeFalsy();

        // Verificar que hay pantalla de éxito o redirección a pago
        const successVisible = await page.locator(
            ':text("¡Todo listo!"), :text("Todo listo"), :text("Activando estudio"), :text("¡Suscripción")'
        ).first().isVisible({ timeout: 5_000 }).catch(() => false);

        const redirectedToPayment = currentUrl.includes("mercadopago") || currentUrl.includes("/onboarding/success");

        console.log(`[pilates] Success visible: ${successVisible}, Redirected to payment: ${redirectedToPayment}`);

        expect(
            successVisible || redirectedToPayment,
            `Debe mostrar éxito o redirigir a pago. URL actual: ${currentUrl}\nTexto: ${first800}`
        ).toBeTruthy();

        console.log("✅ Estudio Pilates creado correctamente con plan Pro + transferencia");
    });
});
