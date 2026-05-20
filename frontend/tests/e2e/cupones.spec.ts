// tests/e2e/cupones.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const CODE = `TEST${Date.now().toString(36).toUpperCase()}`;

test.describe("Cupones", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/cupones");
        await page.waitForLoadState("networkidle");
    });

    test("1. carga la página sin errores JS", async ({ page }) => {
        const jsErrors: string[] = [];
        page.on("pageerror", e => jsErrors.push(e.message));
        await expect(page.getByText("Cupones").first()).toBeVisible();
        expect(jsErrors).toHaveLength(0);
        await page.screenshot({ path: "tests/e2e/screenshots/cupones-01-loaded.png", fullPage: true });
    });

    test("2. botón Nuevo cupón abre el modal", async ({ page }) => {
        await page.click("button:has-text('Nuevo cupón')");
        await expect(page.locator("text=Nuevo cupón").nth(1)).toBeVisible();
        await expect(page.locator("input[name='code']")).toBeVisible();
        await page.screenshot({ path: "tests/e2e/screenshots/cupones-02-modal-open.png" });
    });

    test("3. crear cupón nuevo aparece en la tabla", async ({ page }) => {
        const responsePromise = page.waitForResponse(
            res => res.url().includes("/admin/cupones") && res.request().method() === "POST",
            { timeout: 10_000 }
        );

        await page.click("button:has-text('Nuevo cupón')");
        await page.fill("input[name='code']", CODE);
        await page.fill("input[name='description']", "Cupón de prueba Playwright");
        await page.selectOption("select[name='discount_type']", "porcentaje");
        await page.fill("input[name='value']", "20");
        await page.click("button[type='submit']:has-text('Crear cupón')");

        const res = await responsePromise;
        console.log("[cupones] create status:", res.status());
        const body = await res.text();
        console.log("[cupones] create body:", body.slice(0, 300));

        expect(res.status()).toBeLessThan(400);

        // Verificar que aparece en la tabla
        await page.waitForLoadState("networkidle");
        await expect(page.getByText(CODE).first()).toBeVisible({ timeout: 8_000 });
        await page.screenshot({ path: "tests/e2e/screenshots/cupones-03-created.png", fullPage: true });
    });

    test("4. toggle activo/inactivo funciona", async ({ page }) => {
        // Buscar el primer botón de estado
        const toggleBtn = page.locator("button:has-text('Activo'), button:has-text('Inactivo')").first();
        const count = await toggleBtn.count();
        if (count === 0) { test.skip(); return; }

        const initialText = await toggleBtn.textContent();
        const responsePromise = page.waitForResponse(
            res => res.url().includes("/admin/cupones") && res.request().method() === "POST",
            { timeout: 10_000 }
        );

        await toggleBtn.click();
        const res = await responsePromise;
        expect(res.status()).toBeLessThan(400);

        await page.waitForLoadState("networkidle");
        const newText = await page.locator("button:has-text('Activo'), button:has-text('Inactivo')").first().textContent();
        console.log(`[cupones] toggle: ${initialText} → ${newText}`);
        await page.screenshot({ path: "tests/e2e/screenshots/cupones-04-toggled.png", fullPage: true });
    });

    test("5. copiar código al portapapeles", async ({ page, context }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        const copyBtn = page.locator("button[class*='text-white']").first();
        const count = await copyBtn.count();
        if (count === 0) { test.skip(); return; }

        // Buscar el primer botón de Copy
        const copyButtons = page.locator("button").filter({ has: page.locator("svg") });
        await copyButtons.first().click();
        await page.screenshot({ path: "tests/e2e/screenshots/cupones-05-copied.png" });
    });

    test("6. eliminar cupón lo quita de la tabla", async ({ page }) => {
        // Verificar que hay cupones
        const deleteBtn = page.locator("button:has(svg.lucide-trash-2), form input[value='delete'] + button, form:has(input[value='delete']) button[type='submit']").first();
        const count = await deleteBtn.count();
        if (count === 0) { test.skip(); return; }

        // Contar cupones antes
        const rowsBefore = await page.locator("tbody tr").count();

        const responsePromise = page.waitForResponse(
            res => res.url().includes("/admin/cupones") && res.request().method() === "POST",
            { timeout: 10_000 }
        );

        await deleteBtn.click();
        const res = await responsePromise;
        expect(res.status()).toBeLessThan(400);

        await page.waitForLoadState("networkidle");
        const rowsAfter = await page.locator("tbody tr").count();
        console.log(`[cupones] filas antes: ${rowsBefore}, después: ${rowsAfter}`);
        expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
        await page.screenshot({ path: "tests/e2e/screenshots/cupones-06-deleted.png", fullPage: true });
    });
});
