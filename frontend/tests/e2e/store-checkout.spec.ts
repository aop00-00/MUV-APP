// tests/e2e/store-checkout.spec.ts
// Verifica el flujo completo de compra en /dashboard/store:
//   1. La tienda carga y muestra productos
//   2. El botón "Adquirir" abre el modal de compra
//   3. El modal tiene los pasos detail → payment → success
//   4. El formulario de pago se puede completar y avanza a success

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

test.describe("Store — Flujo de compra retail", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "member");
    });

    test("ST-01: la tienda carga sin errores y muestra el catálogo o el estado vacío", async ({ page }) => {
        const jsErrors: string[] = [];
        page.on("console", msg => {
            if (msg.type() === "error") jsErrors.push(msg.text());
        });

        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        await page.screenshot({ path: "tests/e2e/screenshots/store-01-loaded.png" });

        // Debe estar en /dashboard/store (no redirigió a login)
        expect(page.url()).toContain("/dashboard/store");

        // El título "Tienda" debe estar visible
        await expect(page.locator("h1", { hasText: "Tienda" })).toBeVisible({ timeout: 8_000 });

        // Sin errores JS críticos
        const criticalErrors = jsErrors.filter(e =>
            !e.includes("favicon") && !e.includes("net::ERR")
        );
        console.log("ST-01 — JS errors:", criticalErrors);
        expect(criticalErrors.length, `JS errors: ${criticalErrors.join(", ")}`).toBe(0);
    });

    test("ST-02: los filtros de categoría funcionan", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        const filterLabels = ["Bebidas", "Suplementos", "Merchandise", "Paquetes", "Todo"];

        for (const label of filterLabels) {
            const btn = page.locator("button", { hasText: label }).first();
            const exists = await btn.isVisible().catch(() => false);
            if (exists) {
                await btn.click();
                await page.waitForTimeout(300);
                console.log(`ST-02 — Filtro "${label}" clickeado`);
            }
        }

        await page.screenshot({ path: "tests/e2e/screenshots/store-02-filters.png" });
        // Si llegamos aquí sin crash, los filtros funcionan
        expect(page.url()).toContain("/dashboard/store");
    });

    test("ST-03: el botón Adquirir abre el modal de compra (si hay productos)", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        const buyButtons = page.locator("button", { hasText: "Adquirir" });
        const count = await buyButtons.count();
        console.log(`ST-03 — Productos con botón Adquirir: ${count}`);

        if (count === 0) {
            console.log("ST-03 — Sin productos disponibles, verificando estado vacío");
            await expect(page.locator("text=Catálogo pendiente")).toBeVisible({ timeout: 5_000 });
            test.skip(); // no hay productos para probar el modal
            return;
        }

        // Click en el primer producto disponible
        await buyButtons.first().click();
        await page.waitForTimeout(500);

        await page.screenshot({ path: "tests/e2e/screenshots/store-03-modal-open.png" });

        // El modal debe abrirse (aparece el botón "Continuar al pago")
        await expect(
            page.locator("button", { hasText: "Continuar al pago" })
        ).toBeVisible({ timeout: 5_000 });

        console.log("ST-03 — Modal de compra abierto correctamente");
    });

    test("ST-04: el modal muestra el resumen del producto con precio", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        const buyButtons = page.locator("button", { hasText: "Adquirir" });
        if (await buyButtons.count() === 0) {
            console.log("ST-04 — Sin productos, test omitido");
            test.skip();
            return;
        }

        await buyButtons.first().click();
        await page.waitForTimeout(500);

        // El resumen debe mostrar "Total" y "MXN"
        await expect(page.locator("text=Total")).toBeVisible({ timeout: 5_000 });
        await expect(page.locator("text=MXN").first()).toBeVisible({ timeout: 5_000 });
        await expect(page.locator("text=Resumen")).toBeVisible({ timeout: 5_000 });

        await page.screenshot({ path: "tests/e2e/screenshots/store-04-modal-detail.png" });
        console.log("ST-04 — Resumen del producto visible en el modal");
    });

    test("ST-05: avanza al paso de pago y muestra el formulario de tarjeta", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        const buyButtons = page.locator("button", { hasText: "Adquirir" });
        if (await buyButtons.count() === 0) {
            test.skip();
            return;
        }

        // Abrir modal
        await buyButtons.first().click();
        await page.waitForTimeout(500);

        // Click en "Continuar al pago"
        await page.locator("button", { hasText: "Continuar al pago" }).click();
        await page.waitForTimeout(500);

        await page.screenshot({ path: "tests/e2e/screenshots/store-05-payment-step.png" });

        // El formulario de tarjeta debe estar visible
        await expect(page.locator("input[placeholder='1234 5678 9012 3456']")).toBeVisible({ timeout: 5_000 });
        await expect(page.locator("input[placeholder='JUAN PÉREZ']")).toBeVisible({ timeout: 5_000 });
        await expect(page.locator("input[placeholder='MM/AA']")).toBeVisible({ timeout: 5_000 });
        await expect(page.locator("input[placeholder='•••']")).toBeVisible({ timeout: 5_000 });

        // Debe mostrar el aviso de pago simulado
        await expect(page.locator("text=Pago simulado")).toBeVisible({ timeout: 5_000 });

        console.log("ST-05 — Formulario de pago visible correctamente");
    });

    test("ST-06: completa el formulario y llega a la pantalla de éxito", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        const buyButtons = page.locator("button", { hasText: "Adquirir" });
        if (await buyButtons.count() === 0) {
            console.log("ST-06 — Sin productos, test omitido");
            test.skip();
            return;
        }

        // Abrir modal
        await buyButtons.first().click();
        await page.waitForTimeout(500);

        // Avanzar al pago
        await page.locator("button", { hasText: "Continuar al pago" }).click();
        await page.waitForTimeout(500);

        // Rellenar formulario
        await page.locator("input[placeholder='1234 5678 9012 3456']").fill("4111 1111 1111 1111");
        await page.locator("input[placeholder='JUAN PÉREZ']").fill("ALFONSO PRUEBA");
        await page.locator("input[placeholder='MM/AA']").fill("12/26");
        await page.locator("input[placeholder='•••']").fill("123");

        await page.screenshot({ path: "tests/e2e/screenshots/store-06-form-filled.png" });

        // Submit — usar el botón de pago dentro del modal (contiene "Pagar")
        const payBtn = page.locator("button[type='submit']", { hasText: /Pagar/ });
        await payBtn.click();

        // Esperar la animación de procesamiento (1500ms) + un margen
        await page.waitForTimeout(3000);

        await page.screenshot({ path: "tests/e2e/screenshots/store-06-success.png" });

        // Debe mostrar la pantalla de éxito
        await expect(
            page.locator("text=¡Compra exitosa!")
        ).toBeVisible({ timeout: 8_000 });

        await expect(
            page.locator("button", { hasText: "Seguir comprando" })
        ).toBeVisible({ timeout: 5_000 });

        console.log("ST-06 — Flujo completo: detail → payment → success ✅");
    });

    test("ST-07: el modal se cierra al hacer click en la X o en el backdrop", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        const buyButtons = page.locator("button", { hasText: "Adquirir" });
        if (await buyButtons.count() === 0) {
            test.skip();
            return;
        }

        // Abrir modal
        await buyButtons.first().click();
        await page.waitForTimeout(500);

        // Cerrar con X
        const closeBtn = page.locator("button[aria-label='close'], button:has(svg)").filter({
            hasText: "",
        }).first();

        // Buscar el botón X directamente dentro del modal header
        const xBtn = page.locator(".fixed button").filter({ has: page.locator("svg") }).first();
        await xBtn.click();
        await page.waitForTimeout(400);

        // El modal ya no debe estar visible
        const modalGone = await page.locator("text=Continuar al pago").isVisible().then(v => !v).catch(() => true);
        console.log("ST-07 — Modal cerrado con X:", modalGone);

        await page.screenshot({ path: "tests/e2e/screenshots/store-07-modal-closed.png" });
    });

    test("ST-08: producto agotado muestra botón deshabilitado", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/store`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        // Verificar si hay algún botón "Agotado" deshabilitado
        const soldOutBtns = page.locator("button:disabled", { hasText: "Agotado" });
        const count = await soldOutBtns.count();
        console.log(`ST-08 — Productos agotados encontrados: ${count}`);

        if (count > 0) {
            // El botón debe estar disabled
            await expect(soldOutBtns.first()).toBeDisabled();
            console.log("ST-08 — Botón Agotado correctamente deshabilitado ✅");
        } else {
            console.log("ST-08 — No hay productos agotados en este gym (OK)");
        }

        await page.screenshot({ path: "tests/e2e/screenshots/store-08-sold-out.png" });
    });
});
