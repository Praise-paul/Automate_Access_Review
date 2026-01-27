import dotenv from 'dotenv';
import './playwright/crowdstrike.js';
import './playwright/slack.js';
import https from 'https';
dotenv.config({ override: true });

import App from "./app.js";
import { listGroups, groupMembers, getJumpCloudUserName } from "./jumpcloud.js";
import { confirmApp, selectGroups, filterGroupsForApp } from "./groupSelector.js";

import slackUsers from "./slack.js";
import crowdstrikeUsers from "./crowdstrike.js";
import ociUsers from "./oci.js";
import cloudflareUsers from "./cloudflare.js";



import writeCSV from "./report.js";
import { diffSets } from "./diff.js";
import { updateJiraTicket, createAccessTicket } from './jira.js';

import { captureUserListEvidence } from "./playwright/index.js";
import { ociAdapter } from './playwright/oci.js';
import { slackAdapter } from "./playwright/slack.js";
import { crowdstrikeAdapter } from "./playwright/crowdstrike.js";
import { caniphishAdapter } from "./playwright/caniphish.js";
import { csatAdapter } from "./playwright/csat.js";
import { cloudflareAdapter } from "./playwright/cloudflare.js";


const agent = new https.Agent({
  rejectUnauthorized: false
});

// Auto mode: if true, skips confirmation prompts
const AUTO_MODE = true;

if (!process.env.NODE_EXTRA_CA_CERTS) {
  throw new Error('Missing trusted CA configuration');
}

/* ============================
   FETCHERS
============================ */

const FETCHERS = {
  slack: slackUsers,
  crowdstrike: crowdstrikeUsers,
  cloudflare: cloudflareUsers,
  oci: ociUsers,
};

/* ============================
   LOAD JUMPCLOUD GROUPS ONCE
============================ */

console.log("[INIT] Fetching JumpCloud groups...");
const ALL_JC_GROUPS = await listGroups();
console.log(`[INIT] Loaded ${ALL_JC_GROUPS.length} groups`);

/* ============================
   MAIN LOOP
============================ */

for (const app of Object.keys(App)) {
  let evidenceFiles = [];
  console.log(`\n=== ${app.toUpperCase()} ===`);

  if (!AUTO_MODE) {
  if (!(await confirmApp(app))) {
    console.log(`Skipping ${app.toUpperCase()}`);
    continue;
  }
} else {
  // AUTO MODE behavior
  if (app === "csat") {
    console.log("Skipping CSAT (AUTO_MODE enabled)");
    continue;
  }
}

  const cfg = App[app];


  /* ----- FILTER GROUPS FOR THIS APP ----- */
  const relevantGroups = filterGroupsForApp(
    app,
    ALL_JC_GROUPS,
    App
  );

  if (!relevantGroups.length) {
    console.log("No relevant JumpCloud groups found, skipping.");
    continue;
  }

  // ============================
// GROUP SELECTION
// ============================
let selectedGroups = [];

if (AUTO_MODE) {
  if (app === "oci") {
    // OCI always uses all groups
    selectedGroups = relevantGroups;
  } else {
    // Slack → index 1, all others → index 0
    const index = app === "slack" ? 1 : 0;

    if (!relevantGroups[index]) {
      console.warn(
        `[AUTO_MODE] No group at index ${index} for ${app.toUpperCase()}, skipping`
      );
      continue;
    }

    selectedGroups = [relevantGroups[index]];
  }
} else {
  // Interactive mode (current behavior)
  selectedGroups =
    app === "oci"
      ? relevantGroups
      : selectGroups(app, relevantGroups);
}


  if (!selectedGroups.length) {
    console.log("No groups selected, skipping.");
    continue;
  }

  console.log("Selected groups:");
  selectedGroups.forEach(g =>
    console.log(` - ${g.name} (${g.id})`)
  );

  /* ============================
     OCI ACCESS REVIEW
  ============================ */

 if (app === "oci") {
    const ociResults = await ociUsers({ groups: selectedGroups });
    const ociCsvRows = [];
    const unauthorizedEmails = [];
    const missingEmails = [];

    for (const group of selectedGroups) {
      const expectedMembers = await groupMembers(group.id);
      const actualMembers = ociResults[group.name]?.users || new Set();
      const { unauthorized, missing } = diffSets(expectedMembers, actualMembers);

      unauthorized.forEach(u => {
  const email = typeof u === "string" ? u : u.email;
  ociCsvRows.push({ email, status: "unauthorized", group: group.name });
  unauthorizedEmails.push(`${email} (${group.name})`);
});

missing.forEach(u => {
  const email = typeof u === "string" ? u : u.email;
  ociCsvRows.push({ email, status: "missing", group: group.name });
  missingEmails.push(`${email} (${group.name})`);
});

    }

    if (ociCsvRows.length) {
      const csvPath = `./evidence/api/oci/oci.csv`; // Ensure writeCSV uses this path
      await writeCSV({ app: "oci", group: "oci", rows: ociCsvRows });
      evidenceFiles.push(csvPath);
    }

    // CAPTURE RETURNED PATHS
    const ociUiGroups = Object.entries(ociResults).map(([name, v]) => ({ name, groupId: v.groupId }));
    const screenshotPaths = await captureUserListEvidence("oci", ociAdapter, ociUiGroups);
    evidenceFiles.push(...screenshotPaths);

    // Update Jira for OCI
    await updateJiraTicket("OCI", unauthorizedEmails, missingEmails, evidenceFiles);
    continue;
  }

  /* ============================
     OTHER APPS (Slack / CrowdStrike)
  ============================ */

  /* ============================
     OTHER APPS (Slack / CrowdStrike / etc.)
   ============================ */
const allSelectedMembers = []; 
const expectedEmails = new Set();

for (const g of selectedGroups) {
  const members = await groupMembers(g.id); // Now returns [{email, name}]
  members.forEach(m => {
    expectedEmails.add(m.email);
    // Add to our lookup list if not already there
    if (!allSelectedMembers.find(existing => existing.email === m.email)) {
      allSelectedMembers.push(m);
    }
  });
}

// 🔒 Evidence-only applications
if (cfg.evidenceOnly) {
  const adapterMap = { caniphish: caniphishAdapter, csat: csatAdapter };
  const screenshots = await captureUserListEvidence(app, adapterMap[app]);
  // Update Jira immediately for evidence-only apps
  await updateJiraTicket(app, [], [], screenshots); 
  continue;
}

const actual = await FETCHERS[app]({ groups: selectedGroups });
const { unauthorized, missing } = diffSets(expectedEmails, actual);

// 1. Write CSV and capture the path automatically
if (unauthorized.length) {
  const path = await writeCSV({
    app,
    group: "unauthorized", 
    rows: unauthorized.map(u => ({
  email: typeof u === "string" ? u : u.email
}))

  });
  if (path) evidenceFiles.push(path);
}

if (missing.length) {
  const path = await writeCSV({
    app,
    group: "missing",
    rows: missing.map(u => ({
  email: typeof u === "string" ? u : u.email
}))

  });
  if (path) evidenceFiles.push(path);
}

// 2. Capture Screenshots and capture the paths automatically
const adapters = {
  slack: slackAdapter,
  crowdstrike: crowdstrikeAdapter,
  cloudflare: cloudflareAdapter
};

if (adapters[app]) {
  const screenshots = await captureUserListEvidence(app, adapters[app]);
  if (screenshots) evidenceFiles.push(...screenshots);
}

    const friendlyName = app.charAt(0).toUpperCase() + app.slice(1);
    console.log(`[PROCESS] Initiating Jira update for ${friendlyName}...`);
    await updateJiraTicket(friendlyName, unauthorized, missing, evidenceFiles);

    if (unauthorized.length > 0) {
  console.log(`[PROCESS] Creating individual requests for ${unauthorized.length} unauthorized users...`);
  
  for (const user of unauthorized) {
   const { name, email } = await getJumpCloudUserName(user);
  const jcGroup = selectedGroups[0]?.name || "Jumpcloud";

  await createAccessTicket(name, email, jcGroup);
  }
}
}

console.log("\n Access review completed");
