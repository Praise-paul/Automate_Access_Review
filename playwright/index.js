import { chromium } from "playwright";
import fs from "fs";
import path from "path";

export async function captureUserListEvidence(app, adapter) {
    const { userDataDir, login, gotoUsers, selector, headless = false } = adapter;

    if (!selector) {
        throw new Error(`[${app.toUpperCase()}] Adapter is missing 'selector'`);
    }

    const dir = path.join("evidence", app);
    fs.mkdirSync(dir, { recursive: true });

    console.log(`[${app.toUpperCase()}] Opening browser (persistent profile)`);
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless,
        viewport: { width: 1340, height: 1200 }
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        await login(page);
        await gotoUsers(page);

        // OCI Logic: Capture all pages via the pagination loop
        if (app === "oci") {
            let pageIndex = 1;
            while (true) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const file = path.join(dir, `users-page-${pageIndex}-${timestamp}.png`);

                console.log(`[OCI] Capturing page ${pageIndex}`);
                await page.screenshot({ path: file, fullPage: false });

                const nextBtn = page.locator('button[aria-label="Next"]:not([disabled])');
                if (!(await nextBtn.count())) {
                    console.log("[OCI] No more pages to capture.");
                    break;
                }

                await nextBtn.click();
                await page.waitForTimeout(5000); // Wait for next set of rows
                pageIndex++;
            }
        } 
        // Non-OCI Logic: Standard single screenshot
        else {
            await page.waitForSelector(selector, { timeout: 60_000 });
            const file = path.join(dir, `users-${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
            console.log(`[${app.toUpperCase()}] Taking screenshot`);
            await page.screenshot({ path: file, fullPage: false });
            console.log(`[${app}] Evidence saved → ${file}`);
        }

    } finally {
        console.log(`[${app.toUpperCase()}] Closing browser`);
        await context.close();
    }
}