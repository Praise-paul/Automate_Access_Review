import "dotenv/config";

import App from "./app.js";
import { listGroups, groupMembers } from "./jumpcloud.js";
import { selectGroups } from "./groupSelector.js";
import slackUsers from "./slack.js";
import crowdstrikeUsers from "./crowdstrike.js";
import ociUsers from "./oci.js";
import writeCSV from "./report.js";

const FETCHERS = {
  slack: slackUsers,
  crowdstrike: crowdstrikeUsers,
  oci: ociUsers
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

  let matches;

  if (app === "oci") {
    // 🔥 Auto-detect all OCI SCIM groups
    matches = jcGroups.filter(g =>
      typeof g.name === "string" &&
      g.name.startsWith(App.oci.autoGroupPrefix)
    );
  } else {
    // Existing keyword-based logic
    matches = jcGroups.filter(g => {
      const text = ((g.name || "") + " " + (g.description || "")).toLowerCase();
      return Array.isArray(cfg.keywords) &&
        cfg.keywords.some(k => text.includes(k));
    });
  }


  if (!matches.length) {
    console.log("No matching JumpCloud groups, skipping.");
    continue;
  }

  let selected;

  if (app === "oci") {
    selected = matches.filter(g =>
      g.name.startsWith(App.oci.autoGroupPrefix)
    );
  } else {
    selected = selectGroups(app, matches);
  }

  const ociResults = [];

  console.log("\n==============================");
  console.log(`APPLICATION: ${app.toUpperCase()}`);
  console.log("==============================");
  console.log("Selected JumpCloud groups:");
  selected.forEach(g => console.log(` - ${g.name} (${g.id})`));

  if (!selected.length) {
    console.log("No groups selected, skipping.");
    continue;
  }

  // ================= OCI AUTO GROUP REVIEW =================
  if (app === "oci") {
    const ociResults = [];

    for (const g of selected) {
      const expected = await groupMembers(g.id);
      const actual = await FETCHERS.oci({ groups: [g] });

      const unauthorized = [...actual].filter(u => !expected.has(u));
      const missing = [...expected].filter(u => !actual.has(u));

      if (unauthorized.length || missing.length) {
        ociResults.push({
          group: g.name,
          unauthorized,
          missing
        });
      }
    }

    // ===== OCI SUMMARY OUTPUT =====
    console.log("\n--- OCI ACCESS REVIEW SUMMARY ---");

    if (!ociResults.length) {
      console.log("✅ All OracleOCI-* groups are in sync");
    } else {
      for (const r of ociResults) {
        console.log(`\n❌ Group: ${r.group}`);

        if (r.unauthorized.length) {
          console.log("  Unauthorized users:");
          r.unauthorized.forEach(u => console.log("   -", u));
        }

        if (r.missing.length) {
          console.log("  Missing users:");
          r.missing.forEach(u => console.log("   -", u));
        }
      }
    }

    continue; // ⛔ skip generic logic for OCI
  }
  // =========================================================


  // Inside your main.js loop
  const expected = new Set();
  for (const g of selected) {
    const members = await groupMembers(g.id, true);
    // Ensure 'members' is an array of email strings
    members.forEach(email => {
      if (email) expected.add(email.toLowerCase().trim());
    });
  }

  // FETCHERS['slack'] calls your slackUsers function
  const actualRaw = await FETCHERS[app]({
    groups: selected
  });
  const actual = new Set([...actualRaw].map(e => e.toLowerCase().trim()));

  // The "Comparison" you asked for:
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
