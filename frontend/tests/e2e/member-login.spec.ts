// tests/e2e/member-login.spec.ts — Tests 3, 4, 5

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

test.describe("Member Login & Access Control", () => {
    test("TEST 3: login member exitoso → redirect a /dashboard, elementos visibles", async ({ page }) => {
        const errors: string[] = [];
        page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });

        await loginAs(page, "member");
        await expect(page).toHaveURL(/\/dashboard/);

        // Dashboard content visible
        await expect(page.locator("h1, main, [class*='dashboard']").first()).toBeVisible({ timeout: 10_000 });

        await page.screenshot({ path: "tests/e2e/screenshots/03-member-dashboard.png" });
        console.log("TEST 3 passed. Console errors:", errors);
    });

    test("TEST 4: member intenta acceder a /admin → redirect o 403", async ({ page }) => {
        await loginAs(page, "member");

        // Track network response for /admin loader
        let adminResponseStatus = 0;
        page.on("response", res => {
            if (res.url().includes(BASE + "/admin") || res.request().resourceType() === "document") {
                adminResponseStatus = res.status();
            }
        });

        await page.goto(`${BASE}/admin`);
        await page.waitForTimeout(2000);

        const url = page.url();
        // Guard returns 403 JSON — React Router renders ErrorBoundary in-place (URL stays /admin)
        // Blocked if: redirected away from /admin, OR admin sidebar nav is NOT present
        const hasAdminSidebar = await page.locator("nav a[href='/admin']").isVisible().catch(() => false);
        const isBlocked = !url.includes("/admin") || !hasAdminSidebar;
        console.log("TEST 4 — URL:", url, "| Has admin sidebar:", hasAdminSidebar);

        await page.screenshot({ path: "tests/e2e/screenshots/04-member-blocked-admin.png" });
        expect(isBlocked, `Member should not access /admin freely, current URL: ${url}`).toBeTruthy();
    });

    test("TEST 5: member intenta acceder a /staff → redirect o 403", async ({ page }) => {
        await loginAs(page, "member");
        await page.goto(`${BASE}/staff/checkin`);
        await page.waitForTimeout(2000);

        const url = page.url();
        // Member redirected away from /staff (to /dashboard or /auth/login)
        const isBlocked = !url.includes("/staff");
        console.log("TEST 5 — Redirected to:", url);
        // On production the route returns 404 (not deployed), which also counts as blocked
        expect(isBlocked || url.includes("404"), `Member should not access /staff, got: ${url}`).toBeTruthy();

        await page.screenshot({ path: "tests/e2e/screenshots/05-member-blocked-staff.png" });
    });
});
