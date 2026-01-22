import 'dotenv/config';
import { generateSync } from 'otplib';

export const cloudflareAdapter = {
  name: "CLOUDFLARE",
  dashboardUrl: "https://dash.cloudflare.com/login",
  // Selector for the members table you provided
  selector: 'table[role="table"], h1:has-text("Members")',

  async login(page) {
    console.log("[CLOUDFLARE] Navigating to login (Stealth Enabled)...");
    await page.goto(this.dashboardUrl, { waitUntil: "domcontentloaded" });

    // 1. Enter Credentials
    await page.waitForSelector('#email');
    await page.fill('#email', process.env.CLOUDFLARE_EMAIL);
    await page.fill('#password', process.env.CLOUDFLARE_PASSWORD);

    // 2. THE AUTOMATIC BYPASS
    console.log("[CLOUDFLARE] Monitoring Turnstile challenge...");

    // Wait for the button. If it's disabled, we know there's a captcha.
    const loginBtn = page.getByTestId('login-submit-button');
    
    // Give it a few seconds to see if it auto-solves thanks to Stealth
    await page.waitForTimeout(3000);

    const isBlocked = await loginBtn.isDisabled();
    await page.waitForTimeout(3000);
    if (isBlocked) {
      console.log("[CLOUDFLARE] Captcha detected. ");
      
      // Attempt to find the widget area and hover/click
      try {
        const frame = page.frames().find(f => f.url().includes('challenges.cloudflare.com'));
        if (frame) {
            // We move the mouse to the center of the iframe
            const box = await page.locator('iframe[src*="challenges.cloudflare.com"]').boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            }
        }
      } catch (err) {
        console.log("[CLOUDFLARE] Auto-click failed, waiting for manual help or auto-solve...");
      }
    }

    // 3. Wait for the button to enable
    await page.waitForFunction(() => {
        const btn = document.querySelector('button[data-testid="login-submit-button"]');
        return btn && !btn.disabled;
    }, { timeout: 45000 });

    await loginBtn.click();

    // 4. TOTP Verification
    await page.waitForSelector('#twofactor_token');
    const token = generateSync({ secret: process.env.CLOUDFLARE_MFA_SECRET });
    await page.fill('#twofactor_token', token);
    await page.click('button[data-testid="two-factor-login-submit-button"]');
    
    // 5. Select Neospace Account
    await page.waitForSelector('text="Neospace"');
    await page.click('text="Neospace"');
  },

  async gotoUsers(page) {
    // We use the ID from the HTML you provided: a7b167e22d517a2054c054d1b5149694
    const membersUrl = page.url().split('/').slice(0, 4).join('/') + '/members';
    
    console.log(`[CLOUDFLARE] Navigating to members page...`);
    await page.goto(membersUrl, { waitUntil: "domcontentloaded" });

    // Wait for the specific table with the member list
    try {
      await page.waitForSelector('table[role="table"]', { timeout: 20000 });
      // Buffer for the "Active" badges to render
      await page.waitForTimeout(3000); 
    } catch (e) {
      console.warn("[CLOUDFLARE] Members table not detected, taking fallback screenshot.");
    }
  }
};