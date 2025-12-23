import { chromium } from "playwright";
import fs from "fs";
import path from "path";

export async function captureUserListEvidence(app, adapter) {
    const {
        userDataDir,
        login,
        gotoUsers,
        selector,
        headless = false
    } = adapter;

    if (!selector) {
        throw new Error(`[${app.toUpperCase()}] Adapter is missing 'selector'`);
    }

    console.log(`[${app.toUpperCase()}] Opening browser (persistent profile)`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless,
        viewport: { width: 1340, height: 1200 }
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        // 1️⃣ Login
        await login(page);

        // 2️⃣ Navigate + apply filters
        await gotoUsers(page);

        // ⛔ DO NOT wait for the table (Slack never stabilizes)
        // Just make sure selector exists ONCE
        console.log(`[${app.toUpperCase()}] Taking screenshot`);

        // Prepare output directory
        const dir = path.join("evidence", app);
        fs.mkdirSync(dir, { recursive: true });

        // Define file path FIRST
        const file = path.join(
            dir,
            `users-${new Date().toISOString().replace(/[:.]/g, "-")}.png`
        );

        console.log(`[${app.toUpperCase()}] Taking screenshot`);

        // Take screenshot (no selector waits, no fullPage)
        await Promise.race([
            page.screenshot({
                path: file,
                fullPage: false
            }),
            page.waitForTimeout(60_000).then(() => {
                throw new Error("Screenshot timed out");
            })
        ]);

        console.log(`[${app}] Evidence saved → ${file}`);

    } finally {
        console.log(`[${app.toUpperCase()}] Closing browser`);
        await context.close();
    }
}
