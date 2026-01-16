import { chromium } from "playwright";
import { ociAdapter } from "./playwright/oci.js";
import "dotenv/config";

const browser = await chromium.launchPersistentContext(
  "./.oci-profile",
  { headless: false }
);

const page = browser.pages()[0] || await browser.newPage();
console.log("[OCI DEBUG] DOMAIN =", process.env.OCI_DOMAIN_OCID);
console.log("[OCI DEBUG] REGION =", process.env.OCI_REGION);

await ociAdapter.login(page);

// ⚠️ Use a REAL group OCID you KNOW exists
await ociAdapter.gotoGroupUsers(
  page,
  "ocid1.group.oc1..aaaaaaaadzgpv7qiijez4a3hwomnkka57e4ywsik33mgun5w663tya7p2arq"
);

console.log("Group users page loaded");

