export function diffSets(expected, actual) {
  const unauthorized = [...actual].filter(u => !expected.has(u));
  const missing = [...expected].filter(u => !actual.has(u));

  return {
    unauthorized,
    missing
  };
}
