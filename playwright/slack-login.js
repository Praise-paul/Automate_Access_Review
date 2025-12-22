import { chromium } from "playwright";

(async () => {
  const context = await chromium.launchPersistentContext(
    "./.auth/slack",
    {
      headless: false,   // 👈 REQUIRED
      slowMo: 50
    }
  );

  const page = await context.newPage();

  // Go directly to Slack sign-in
  await page.goto("https://slack.com/signin");

  console.log("=================================================");
  console.log("👉 Log in to Slack manually (SSO if needed)");
  console.log("👉 Make sure you land in the Admin UI");
  console.log("👉 Then CLOSE the browser window");
  console.log("=================================================");
})();
