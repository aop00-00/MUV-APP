// tests/e2e/helpers/auth.ts
// Reusable login helpers for Playwright tests.

import type { Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";

export const CREDS = {
    admin:  { email: "muvtraining@gmail.com",  password: "12345678" },
    member: { email: "alfonso1@gmail.com",      password: "12345678" },
    // front_desk user must be created via Supabase before running staff tests.
    // Set via env var FRONT_DESK_EMAIL / FRONT_DESK_PASSWORD.
    frontDesk: {
        email:    process.env.FRONT_DESK_EMAIL    ?? "violeta@gmail.com",
        password: process.env.FRONT_DESK_PASSWORD ?? "12345678",
    },
};

export async function loginAs(page: Page, role: keyof typeof CREDS) {
    const { email, password } = CREDS[role];
    await page.goto(`${BASE}/auth/login`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    // Wait for redirect away from login
    await page.waitForURL(url => !url.pathname.includes("/auth/login"), { timeout: 15_000 });
}

export async function logout(page: Page) {
    await page.goto(`${BASE}/auth/logout`);
}
