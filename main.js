import "dotenv/config";

import App from "./app.js";
import { listGroups, groupMembers } from "./jumpcloud.js";
import { selectGroups } from "./groupSelector.js";
import slackUsers from "./slack.js";
import crowdstrikeUsers from "./crowdstrike.js";
import diff from "./diff.js";
import writeCSV from "./report.js";

const FETCHERS = {
  slack: slackUsers,
  crowdstrike: crowdstrikeUsers
};

const jcGroups = await listGroups();

console.log("=== ALL JUMPCLOUD GROUPS ===");
jcGroups.forEach(g => {
  console.log({ name: g.name, description: g.description });
});
console.log("================================");


for (const app of Object.keys(App)) {
  console.log(`\n=== ${app.toUpperCase()} ===`);

  const cfg = App[app];

  const matches = jcGroups.filter(g => {
    const text = ((g.name || "") + " " + (g.description || "")).toLowerCase();
    return Array.isArray(cfg.keywords) &&
           cfg.keywords.some(k => text.includes(k));
  });

  if (!matches.length) {
    console.log("No matching JumpCloud groups, skipping.");
    continue;
  }

  const selected = selectGroups(app, matches);
  console.log("\n==============================");
console.log(`APPLICATION: ${app.toUpperCase()}`);
console.log("==============================");
console.log("Selected JumpCloud groups:");
selected.forEach(g => console.log(` - ${g.name} (${g.id})`));

  if (!selected.length) {
    console.log("No groups selected, skipping.");
    continue;
  }

  // inside the App loop in main.js
const expected = new Set();
for (const g of selected) {
  const members = await groupMembers(g.id, true);
  members.forEach(u => expected.add(u.toLowerCase().trim())); // Normalize expected
}

const actualRaw = await FETCHERS[app](true);
const actual = new Set(
  [...actualRaw]
    .filter(Boolean)
    .map(e => e.toLowerCase().trim()) // Normalize actual
);

console.log("EXPECTED SAMPLE:", [...expected].slice(0, 5));
console.log("ACTUAL SAMPLE:", [...actual].slice(0, 5));

  // ===== COMPARISON =====
  const unauthorized = [...actual].filter(u => !expected.has(u));
  const missing = [...expected].filter(u => !actual.has(u));

  // ===== OUTPUT =====
  console.log("\n--- ACCESS REVIEW RESULTS ---");

  if (unauthorized.length === 0) {
    console.log("✅ No unauthorized users");
  } else {
    console.log("❌ UNAUTHORIZED USERS:");
    unauthorized.forEach(u => console.log(" -", u));
  }

  if (missing.length === 0) {
    console.log("✅ No missing users");
  } else {
    console.log("⚠️ MISSING USERS:");
    missing.forEach(u => console.log(" -", u));
  }

  // ===== CSV EXPORT =====
  if (unauthorized.length) {
    await writeCSV(
      `${app}_unauthorized.csv`,
      unauthorized.map(u => ({ email: u }))
    );
  }

  if (missing.length) {
    await writeCSV(
      `${app}_missing.csv`,
      missing.map(u => ({ email: u }))
    );
  }
}

console.log("\n✔ Access review completed");
