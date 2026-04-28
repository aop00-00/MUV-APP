import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    retries: 1,
    timeout: 30_000,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: "http://localhost:5173",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "iPhone SE",
            use: { ...devices["iPhone SE"] },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
        },
        {
            name: "iPhone 14",
            use: { ...devices["iPhone 14"] },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
        },
        {
            name: "Pixel 5",
            use: { ...devices["Pixel 5"] },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
        },
        {
            name: "Desktop Chrome",
            use: { ...devices["Desktop Chrome"] },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
        },
    ],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
