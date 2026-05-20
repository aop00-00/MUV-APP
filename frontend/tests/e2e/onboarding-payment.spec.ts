import { test, expect } from "@playwright/test";

async function fillStep2(page: any, gymName: string) {
    await expect(page.getByRole("heading", { name: "Tu estudio" })).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Ej: Studio Valentina Pilates").fill(gymName);
    await page.locator("button").filter({ hasText: /HIT|Funcional|Cycling|Pilates|Yoga|Barre/i }).first().click();
    await page.locator("select").selectOption("MX");
    await page.getByPlaceholder("CDMX").fill("CDMX");
    await page.getByRole("button", { name: /siguiente/i }).click();
}

async function fillStep3(page: any, email: string) {
    await expect(page.getByPlaceholder("Tu nombre")).toBeVisible({ timeout: 8_000 });
    await page.getByPlaceholder("Tu nombre").fill("Test");
    await page.getByPlaceholder("Tus apellidos").fill("Owner");
    await page.getByPlaceholder("tu@estudio.com").fill(email);
    await page.getByPlaceholder("Mínimo 8 caracteres").fill("Test1234!");
    await page.getByPlaceholder("Repetir contraseña").fill("Test1234!");
    await page.getByRole("button", { name: /siguiente/i }).click();
}

// ══════════════════════════════════════════════════════════════════════
// TEST 1: Diagnóstico — POST directo al action con token falso
// Objetivo: ver el error exacto que devuelve MP al crear preapproval
// ══════════════════════════════════════════════════════════════════════
test.describe("Onboarding — Diagnóstico MP error", () => {
    test.setTimeout(60_000);

    test("POST directo al action — captura error exacto de MP (starter mensual)", async ({ request }) => {
        const email = `diag-${Date.now()}@mailinator.com`;

        const res = await request.post("http://localhost:5173/onboarding", {
            form: {
                intent: "complete_onboarding",
                plan: "starter",
                cycle: "monthly",
                payMethod: "card",
                cardToken: "TEST_TOKEN_FAKE_12345",   // token inválido a propósito
                email,
                password: "Test1234!",
                studioName: "Diag Studio",
                ownerName: "Test Owner",
                country: "MX",
                city: "CDMX",
                phone: "",
                studioType: "pilates",
                landingPageUpsell: "false",
                msi: "1",
            },
        });

        const body = await res.text();
        console.log("📡 HTTP status:", res.status());
        console.log("📡 Respuesta action (starter mensual):", body.substring(0, 1000));

        let parsed: any = {};
        try { parsed = JSON.parse(body); } catch {}

        if (parsed.mpDebug) {
            console.log("🔴 Error exacto de MP:", parsed.mpDebug);
        }
        if (parsed.error) {
            console.log("❌ Error parseado:", parsed.error);
        }
        if (parsed.pendingPayment) {
            console.log("✅ Preapproval creado con éxito (pendingPayment=true)");
        }
        if (parsed.success) {
            console.log("✅ Éxito completo — slug:", parsed.slug);
        }

        // Limpiar pending_registration creada si quedó
        expect(res.status()).toBeLessThan(500);
    });

    test("POST directo al action — pro mensual (verifica preapproval con tarjeta falsa)", async ({ request }) => {
        const email = `diag-pro-${Date.now()}@mailinator.com`;

        const res = await request.post("http://localhost:5173/onboarding", {
            form: {
                intent: "complete_onboarding",
                plan: "pro",
                cycle: "monthly",
                payMethod: "card",
                cardToken: "TEST_TOKEN_FAKE_12345",
                email,
                password: "Test1234!",
                studioName: "Diag Pro Studio",
                ownerName: "Test Owner",
                country: "MX",
                city: "CDMX",
                phone: "",
                studioType: "yoga",
                landingPageUpsell: "false",
                msi: "1",
            },
        });

        const body = await res.text();
        console.log("📡 Respuesta action (pro mensual):", body.substring(0, 1000));
        let parsed: any = {};
        try { parsed = JSON.parse(body); } catch {}
        if (parsed.mpDebug) console.log("🔴 Error MP pro mensual:", parsed.mpDebug);
        expect(res.status()).toBeLessThan(500);
    });
});

// ══════════════════════════════════════════════════════════════════════
// TEST 2: Plan Pro trimestral → redirige a Checkout Pro de MP
// ══════════════════════════════════════════════════════════════════════
test.describe("Onboarding — Plan Pro Trimestral", () => {
    test.setTimeout(120_000);

    test("pro trimestral redirige a Checkout Pro de MP", async ({ page }) => {
        await page.goto("/onboarding?plan=pro&cycle=quarterly");
        await expect(page.getByText("Plan Pro")).toBeVisible({ timeout: 10_000 });
        await page.getByRole("button", { name: /confirmar plan pro/i }).click();

        await fillStep2(page, `Pro Trim ${Date.now()}`);
        await fillStep3(page, `pro-trim-${Date.now()}@mailinator.com`);

        await expect(page.getByRole("button", { name: /activar/i })).toBeVisible({ timeout: 10_000 });
        const navPromise = page.waitForURL(/mercadopago|sandbox/, { timeout: 30_000 }).catch(() => null);
        await page.getByRole("button", { name: /activar/i }).click();

        await navPromise;
        const finalUrl = page.url();
        const isMP = finalUrl.includes("mercadopago");
        const isSuccess = finalUrl.includes("success");
        expect(isMP || isSuccess).toBeTruthy();
        console.log(isMP ? "✅ Redirigido a Checkout Pro de MP" : "✅ Directo a success — URL: " + finalUrl);
    });
});

// ══════════════════════════════════════════════════════════════════════
// TEST 3: Validaciones
// ══════════════════════════════════════════════════════════════════════
test.describe("Onboarding — Validaciones", () => {
    test.setTimeout(60_000);

    test("email duplicado muestra error", async ({ page }) => {
        await page.goto("/onboarding?plan=pro&cycle=quarterly");
        await expect(page.getByText("Plan Pro")).toBeVisible({ timeout: 10_000 });
        await page.getByRole("button", { name: /confirmar plan pro/i }).click();
        await fillStep2(page, "Gym Duplicado");
        await fillStep3(page, "al.decoplast@gmail.com");
        await page.getByRole("button", { name: /activar/i }).click();
        await expect(page.getByText(/ya está registrado/i)).toBeVisible({ timeout: 15_000 });
        console.log("✅ Validación email duplicado funciona");
    });

    test("plan Emprendedor activa sin pagar", async ({ page }) => {
        await page.goto("/onboarding?plan=emprendedor");
        await page.getByRole("button", { name: "Emprendedor" }).click();
        await page.getByRole("button", { name: /comenzar|confirmar.*emprendedor/i }).first().click();
        await fillStep2(page, `Free Gym ${Date.now()}`);
        await fillStep3(page, `free-${Date.now()}@mailinator.com`);
        await page.getByRole("button", { name: /activar/i }).click();
        await page.waitForTimeout(5_000);
        expect(page.url()).not.toContain("mercadopago");
        console.log("✅ Plan gratuito no redirigió a MP");
    });

    test("plan mensual carga iframe del Brick", async ({ page }) => {
        await page.goto("/onboarding?plan=pro&cycle=monthly");
        await expect(page.getByText("Plan Pro")).toBeVisible({ timeout: 10_000 });
        await page.getByRole("button", { name: /confirmar plan pro/i }).click();
        await fillStep2(page, `Monthly Gym ${Date.now()}`);
        await fillStep3(page, `monthly-${Date.now()}@mailinator.com`);
        await expect(page.getByRole("button", { name: /Tarjeta/i })).toBeVisible({ timeout: 10_000 });
        await expect(page.locator("#mp-card-brick")).toBeVisible({ timeout: 5_000 });
        await page.waitForSelector("#mp-card-brick iframe", { timeout: 20_000 });
        console.log("✅ Brick de MP con iframe cargado correctamente");
    });
});
