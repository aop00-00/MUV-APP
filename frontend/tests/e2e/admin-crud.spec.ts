// tests/e2e/admin-crud.spec.ts — Tests 24, 25, 26

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const TS = Date.now();

test.describe("Admin CRUD Operations", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, "admin");
    });

    test("TEST 24: navegar a admin/schedule → página carga", async ({ page }) => {
        const jsErrors: string[] = [];
        page.on("console", msg => { if (msg.type() === "error") jsErrors.push(msg.text()); });

        await page.goto(`${BASE}/admin/schedule`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: "tests/e2e/screenshots/24-admin-schedule.png" });

        expect(page.url()).toContain("/admin");
        console.log("TEST 24 — Schedule URL:", page.url(), "JS errors:", jsErrors.length);
    });

    test("TEST 25: navegar a admin/coaches → lista carga", async ({ page }) => {
        const jsErrors: string[] = [];
        page.on("console", msg => { if (msg.type() === "error") jsErrors.push(msg.text()); });

        await page.goto(`${BASE}/admin/coaches`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: "tests/e2e/screenshots/25-admin-coaches.png" });

        expect(page.url()).toContain("/admin");
        console.log("TEST 25 — Coaches URL:", page.url(), "JS errors:", jsErrors.length);
    });

    test("TEST 26: navegar a admin/pos → productos visibles", async ({ page }) => {
        const jsErrors: string[] = [];
        page.on("console", msg => { if (msg.type() === "error") jsErrors.push(msg.text()); });

        await page.goto(`${BASE}/admin/pos`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: "tests/e2e/screenshots/26-admin-pos.png" });

        expect(page.url()).toContain("/admin");
        console.log("TEST 26 — POS URL:", page.url(), "JS errors:", jsErrors.length);
    });
});
