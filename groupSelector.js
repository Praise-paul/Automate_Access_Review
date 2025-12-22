import readline from "readline-sync";

export function selectGroups(app, groups) {
  console.log(`\n=== ${app.toUpperCase()} ===`);
  groups.forEach((g, i) => console.log(`[${i}] ${g.name}`));

  const input = readline.question(
    "Select group numbers (comma-separated) or press ENTER to skip: "
  );

  if (!input) return [];

  return input.split(",").map(i => groups[Number(i)]);
}
