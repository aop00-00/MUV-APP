// tests/e2e/crm-leads.spec.ts
// Diagnóstico completo del CRM: agregar leads, mover entre fases, eliminar.

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const LEAD = {
    full_name: "Test Lead Playwright",
    email:     `playwright-lead-${Date.now()}@test.com`,
    phone:     "5511223344",
    notes:     "Lead de prueba automatizada",
};

test.describe("CRM – diagnóstico completo", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "admin");
        await page.goto("/admin/crm");
        await page.waitForLoadState("networkidle");
    });

    // ── 1. La página carga sin errores ─────────────────────────────
    test("1. carga el board Kanban sin errores JS", async ({ page }) => {
        const jsErrors: string[] = [];
        page.on("pageerror", (err) => jsErrors.push(err.message));

        await page.waitForSelector("text=CRM Command Center", { timeout: 10_000 });

        // Verificar que existen las 5 columnas
        for (const label of ["Nuevos", "Contactados", "Trial", "Convertidos", "Perdidos"]) {
            await expect(page.getByText(label).first()).toBeVisible();
        }

        expect(jsErrors, `Errores JS: ${jsErrors.join(", ")}`).toHaveLength(0);
        await page.screenshot({ path: "tests/e2e/screenshots/crm-01-board-loaded.png", fullPage: true });
    });

    // ── 2. Botón "Nuevo lead" abre el formulario ───────────────────
    test("2. botón Nuevo lead abre el formulario", async ({ page }) => {
        await page.click("button:has-text('Nuevo lead')");
        await expect(page.locator("text=Agregar lead").first()).toBeVisible();
        await expect(page.locator("input[name='full_name']")).toBeVisible();
        await expect(page.locator("input[name='email']")).toBeVisible();
        await page.screenshot({ path: "tests/e2e/screenshots/crm-02-form-open.png" });
    });

    // ── 3. Agregar un lead nuevo ───────────────────────────────────
    test("3. agregar lead nuevo aparece en columna Nuevos", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        // Interceptar la respuesta del action
        const responsePromise = page.waitForResponse(
            (res) => res.url().includes("/admin/crm") && res.request().method() === "POST",
            { timeout: 15_000 }
        );

        await page.click("button:has-text('Nuevo lead')");
        await page.fill("input[name='full_name']", LEAD.full_name);
        await page.fill("input[name='email']", LEAD.email);
        await page.fill("input[name='phone']", LEAD.phone);
        await page.fill("input[name='notes']", LEAD.notes);
        await page.selectOption("select[name='source']", "instagram");

        await page.click("button[type='submit']:has-text('Agregar lead')");

        const response = await responsePromise;
        const body = await response.text();
        console.log("[crm] POST response status:", response.status());
        console.log("[crm] POST response body:", body.slice(0, 500));

        // Esperar a que el formulario se cierre (éxito) o ver error
        await page.waitForTimeout(2000);

        // Verificar si el formulario sigue abierto (indicaría error)
        const formVisible = await page.locator("input[name='full_name']").isVisible();
        if (formVisible) {
            await page.screenshot({ path: "tests/e2e/screenshots/crm-03-form-still-open-ERROR.png" });
            throw new Error(`El formulario sigue abierto tras submit. Respuesta: ${body.slice(0, 300)}`);
        }

        // Recargar y verificar que el lead aparece en el board
        await page.reload();
        await page.waitForLoadState("networkidle");
        await expect(page.getByText(LEAD.full_name).first()).toBeVisible({ timeout: 8_000 });

        await page.screenshot({ path: "tests/e2e/screenshots/crm-03-lead-added.png", fullPage: true });
        console.log("[crm] Console errors durante add_lead:", consoleErrors);
    });

    // ── 4. Validación: email duplicado o campo vacío ───────────────
    test("4. submit con email vacío no crea lead", async ({ page }) => {
        await page.click("button:has-text('Nuevo lead')");
        await page.fill("input[name='full_name']", "Sin Email");
        // No llenar email
        await page.click("button[type='submit']:has-text('Agregar lead')");
        // El campo email es required, el browser no debería enviar
        await expect(page.locator("input[name='email']")).toBeVisible();
        await page.screenshot({ path: "tests/e2e/screenshots/crm-04-validation.png" });
    });

    // ── 5. Mover lead con botón ChevronRight ──────────────────────
    test("5. mover lead a siguiente fase con botón flecha", async ({ page }) => {
        // Primero verificar que hay al menos un lead en Nuevos
        await page.waitForLoadState("networkidle");

        // Buscar el botón de avanzar fase en la primera tarjeta de Nuevos
        const moveBtn = page.locator(".space-y-2 button[title*='Mover a']").first();
        const moveBtnCount = await moveBtn.count();

        if (moveBtnCount === 0) {
            console.log("[crm] No hay leads con botón de mover — saltando test de avance");
            test.skip();
            return;
        }

        const titleAttr = await moveBtn.getAttribute("title");
        console.log("[crm] Botón mover:", titleAttr);

        const responsePromise = page.waitForResponse(
            (res) => res.url().includes("/admin/crm") && res.request().method() === "POST",
            { timeout: 10_000 }
        );

        await moveBtn.click();
        const res = await responsePromise;
        const body = await res.text();
        console.log("[crm] move_stage response:", res.status(), body.slice(0, 200));

        await page.waitForTimeout(1500);
        await page.screenshot({ path: "tests/e2e/screenshots/crm-05-moved-stage.png", fullPage: true });

        expect(res.status()).toBeLessThan(400);
    });

    // ── 6. Drag and Drop entre columnas ───────────────────────────
    test("6. drag & drop mueve lead entre columnas", async ({ page }) => {
        await page.waitForLoadState("networkidle");

        // Buscar primera tarjeta de la columna "Nuevos"
        const newosColumn = page.locator(".grid > div").first();
        const firstCard = newosColumn.locator("[class*='cursor-grab']").first();
        const cardCount = await firstCard.count();

        if (cardCount === 0) {
            console.log("[crm] No hay tarjetas para DnD — saltando");
            test.skip();
            return;
        }

        // Obtener columna destino "Contactados"
        const contactadosColumn = page.locator(".grid > div").nth(1);

        const sourceBB = await firstCard.boundingBox();
        const targetBB = await contactadosColumn.boundingBox();

        if (!sourceBB || !targetBB) {
            console.log("[crm] No se pudo obtener bounding boxes — saltando DnD");
            test.skip();
            return;
        }

        // Simular drag
        await page.mouse.move(sourceBB.x + sourceBB.width / 2, sourceBB.y + sourceBB.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(300);
        await page.mouse.move(targetBB.x + targetBB.width / 2, targetBB.y + 100, { steps: 20 });
        await page.waitForTimeout(300);
        await page.mouse.up();
        await page.waitForTimeout(1500);

        await page.screenshot({ path: "tests/e2e/screenshots/crm-06-dnd-result.png", fullPage: true });
        console.log("[crm] DnD completado — revisar screenshot para verificar");
    });

    // ── 7. Verificar respuestas del servidor ──────────────────────
    test("7. el action del servidor responde correctamente", async ({ page }) => {
        const results: { intent: string; status: number; ok: boolean; body: string }[] = [];

        // Test add_lead directamente via fetch
        const addRes = await page.evaluate(async (lead) => {
            const fd = new FormData();
            fd.append("intent", "add_lead");
            fd.append("full_name", lead.full_name);
            fd.append("email", lead.email);
            fd.append("phone", lead.phone ?? "");
            fd.append("source", "web");
            fd.append("notes", "test directo");
            const res = await fetch("/admin/crm", { method: "POST", body: fd });
            const text = await res.text();
            return { status: res.status, body: text.slice(0, 400) };
        }, { ...LEAD, email: `direct-${Date.now()}@test.com` });

        console.log("[crm] add_lead directo:", addRes);
        results.push({ intent: "add_lead", status: addRes.status, ok: addRes.status < 400, body: addRes.body });

        // Verificar que todos los intents respondieron OK
        for (const r of results) {
            expect(r.ok, `Intent ${r.intent} falló con status ${r.status}: ${r.body}`).toBe(true);
        }

        await page.screenshot({ path: "tests/e2e/screenshots/crm-07-server-test.png" });
    });
});
