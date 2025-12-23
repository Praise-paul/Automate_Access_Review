import readline from "readline-sync";

export function selectGroups(app, groups) {
  console.log(`\n=== ${app.toUpperCase()} ===`);
  groups.forEach((g, i) => console.log(`[${i}] ${g.name}`));

  const input = readline.question(
    "Select group numbers (comma-separated) or press ENTER to skip: "
  );

  if (!input) return [];

  return input
    .split(",")
    .map(i => Number(i.trim()))
    .filter(i => !isNaN(i) && groups[i])
    .map(i => groups[i]);
}

export function confirmApp(appName) {
  const answer = readline.question(
    `\nProceed with ${appName.toUpperCase()} access review? (y/N): `
  );

  return answer.trim().toLowerCase() === "y";
}
