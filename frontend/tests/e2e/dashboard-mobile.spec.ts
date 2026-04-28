import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.use({ storageState: path.join(__dirname, "../.auth/user.json") });

async function hasHorizontalOverflow(page) {
    return page.evaluate(() => document.body.scrollWidth > window.innerWidth);
}

// Finds and clicks a day with classes in the compact mobile calendar,
// then returns the first class card element, or null if none found.
async function openFirstClassCard(page) {
    // The compact calendar grid is a 7-column grid of day buttons.
    // Days with classes have a div.flex containing colored span.rounded-full dot(s).
    // We look for buttons that have those dot spans and are within the calendar grid.
    for (let monthAttempt = 0; monthAttempt < 3; monthAttempt++) {
        // Use evaluate to find the first day button that has dot spans
        const dayIdx = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            // Day buttons: small buttons that contain only a number + optional dots
            // They are inside a grid.grid-cols-7
            const grid = document.querySelector('.grid.grid-cols-7');
            if (!grid) return -1;
            const dayBtns = Array.from(grid.querySelectorAll('button'));
            return dayBtns.findIndex(btn => btn.querySelector('span.rounded-full'));
        });

        if (dayIdx >= 0) {
            // Click that day button
            const grid = page.locator('.grid.grid-cols-7').first();
            const dayButtons = grid.locator('button');
            await dayButtons.nth(dayIdx).click();
            await page.waitForTimeout(400);

            // Class cards should appear below; they are buttons with class w-full text-left
            const cards = page.locator('button.w-full.text-left');
            if (await cards.count() > 0) return cards.first();
        }

        // Navigate to next month via the ">" chevron nav button
        // The nav buttons are adjacent to the month name in the header
        const nextMonthBtn = page.locator('main button').last();
        await nextMonthBtn.click();
        await page.waitForTimeout(300);
    }
    return null;
}

test.describe("Dashboard home mobile", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");
    });

    test("no horizontal overflow on dashboard home", async ({ page }) => {
        expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test("bottom nav is visible and fully within viewport", async ({ page }) => {
        const nav = page.locator("nav.fixed.bottom-0");
        await expect(nav).toBeVisible();
        const box = await nav.boundingBox();
        expect(box).not.toBeNull();
        const vh = page.viewportSize().height;
        expect(box.y + box.height).toBeLessThanOrEqual(vh + 2);
    });

    test("all bottom nav links are tappable min 44px height", async ({ page }) => {
        const links = page.locator("nav.fixed.bottom-0 a");
        const count = await links.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
            const box = await links.nth(i).boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
    });
});

test.describe("Agenda mobile", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/dashboard/schedule");
        await page.waitForLoadState("networkidle");
    });

    test("no horizontal overflow on schedule page", async ({ page }) => {
        expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test("schedule page loads without crash", async ({ page }) => {
        await expect(page.locator("main")).toBeVisible();
    });
});

test.describe("ClassDetailModal mobile", () => {
    test("Reservar button visible in viewport after opening modal", async ({ page }) => {
        await page.goto("/dashboard/schedule");
        await page.waitForLoadState("networkidle");

        const classCard = await openFirstClassCard(page);
        if (!classCard || await classCard.count() === 0) {
            test.skip();
            return;
        }

        await classCard.click({ force: true });
        await page.waitForTimeout(600);

        const reservarBtn = page.getByRole("button", { name: /reservar/i });
        await expect(reservarBtn).toBeVisible({ timeout: 8000 });

        const box = await reservarBtn.boundingBox();
        expect(box).not.toBeNull();
        const vh = page.viewportSize().height;
        expect(box.y + box.height).toBeLessThanOrEqual(vh);
        expect(box.height).toBeGreaterThanOrEqual(44);
    });

    test("modal closes when backdrop tapped", async ({ page }) => {
        await page.goto("/dashboard/schedule");
        await page.waitForLoadState("networkidle");

        const classCard = await openFirstClassCard(page);
        if (!classCard || await classCard.count() === 0) {
            test.skip();
            return;
        }

        await classCard.click({ force: true });
        await page.waitForTimeout(600);

        const reservarBtn = page.getByRole("button", { name: /reservar/i });
        const opened = await reservarBtn.isVisible().catch(() => false);
        if (!opened) { test.skip(); return; }

        await page.mouse.click(5, 5);
        await page.waitForTimeout(400);
        await expect(reservarBtn).not.toBeVisible({ timeout: 3000 });
    });
});

test.describe("SeatMap mobile", () => {
    test("seat map does not cause horizontal page overflow", async ({ page }) => {
        await page.goto("/dashboard/schedule");
        await page.waitForLoadState("networkidle");

        const classCard = await openFirstClassCard(page);
        if (classCard && await classCard.count() > 0) {
            await classCard.click({ force: true });
            await page.waitForTimeout(500);
        }
        expect(await hasHorizontalOverflow(page)).toBe(false);
    });
});

test.describe("Dashboard vertical scroll", () => {
    test("bottom nav stays fixed while scrolling", async ({ page }) => {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        const nav = page.locator("nav.fixed.bottom-0");
        if (await nav.count() === 0) { test.skip(); return; }

        const boxBefore = await nav.boundingBox();
        await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
        await page.waitForTimeout(200);
        const boxAfter = await nav.boundingBox();
        expect(Math.abs(boxBefore.y - boxAfter.y)).toBeLessThan(5);
    });
});

test.describe("Profile mobile", () => {
    test("no horizontal overflow on profile page", async ({ page }) => {
        await page.goto("/dashboard/profile");
        await page.waitForLoadState("networkidle");
        expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test("form inputs do not overflow viewport", async ({ page }) => {
        await page.goto("/dashboard/profile");
        await page.waitForLoadState("networkidle");

        const inputs = page.locator("input, select, textarea");
        const count = await inputs.count();
        const vw = page.viewportSize().width;
        for (let i = 0; i < Math.min(count, 5); i++) {
            const box = await inputs.nth(i).boundingBox();
            if (box && box.width > 0) {
                expect(box.x + box.width).toBeLessThanOrEqual(vw + 2);
            }
        }
    });
});
