// tests/e2e/member-navigation.spec.ts — Tests 10, 11, 12

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

const MEMBER_SECTIONS = [
    { path: "/dashboard",          name: "Inicio" },
    { path: "/dashboard/schedule", name: "Horarios" },
    { path: "/dashboard/store",    name: "Tienda" },
    { path: "/dashboard/packages", name: "Membresías" },
    { path: "/dashboard/profile",  name: "Perfil" },
    { path: "/dashboard/fitcoins", name: "FitCoins" },
];

test.describe("Member — Navegación y QR", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "member");
    });

    test("TEST 10: visitar cada sección del member dashboard", async ({ page }) => {
        for (const section of MEMBER_SECTIONS) {
            const jsErrors: string[] = [];
            page.on("console", msg => { if (msg.type() === "error") jsErrors.push(msg.text()); });

            await page.goto(`${BASE}${section.path}`, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(1000);

            const loaded = page.url().includes("/dashboard");
            console.log(`${loaded ? "✅" : "❌"} Member ${section.name}: ${page.url()} — errors: ${jsErrors.length}`);

            await page.screenshot({
                path: `tests/e2e/screenshots/10-member-${section.name.toLowerCase()}.png`,
            });
            page.removeAllListeners("console");
        }
    });

    test("TEST 11: QR del member se muestra correctamente en /dashboard/profile", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/profile`);
        await page.waitForTimeout(2000);

        // QR should be an SVG or canvas element inside a white container
        const qrSvg = page.locator("svg").first();
        const qrVisible = await qrSvg.isVisible().catch(() => false);

        console.log("TEST 11 — QR SVG visible:", qrVisible);
        await page.screenshot({ path: "tests/e2e/screenshots/11-member-qr.png" });

        // The QR section should exist
        await expect(page.locator("text=Código de acceso QR, text=Código de acceso")).toBeVisible({ timeout: 5_000 });
    });

    test("TEST 12: intentar reservar una clase (si hay clases disponibles)", async ({ page }) => {
        await page.goto(`${BASE}/dashboard/schedule`);
        await page.waitForTimeout(2000);

        await page.screenshot({ path: "tests/e2e/screenshots/12-member-schedule-before.png" });

        // Check if any class cards/buttons are visible
        const classButtons = await page.locator("button:has-text('Reservar'), button:has-text('reservar')").count();
        console.log("TEST 12 — Available classes to book:", classButtons);

        if (classButtons > 0) {
            await page.locator("button:has-text('Reservar')").first().click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: "tests/e2e/screenshots/12-member-booking-attempt.png" });
            console.log("TEST 12 — Booking attempted, URL:", page.url());
        } else {
            console.log("TEST 12 — No classes available for booking (skipped)");
        }
    });
});
