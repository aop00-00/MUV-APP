import { test as setup } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../.auth/user.json");

setup("authenticate as member", async ({ page }) => {
    await page.goto("/auth/login");

    // Try email + password fields
    const emailInput = page.locator("input[type=email], input[name=email]").first();
    const passInput = page.locator("input[type=password]").first();
    await emailInput.fill("alfonso1@gmail.com");
    await passInput.fill("12345678");

    const submitBtn = page.locator("button[type=submit]").first();
    await submitBtn.click();

    // Wait until redirected away from login
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 15000 });

    // Save auth state
    await page.context().storageState({ path: authFile });
});
