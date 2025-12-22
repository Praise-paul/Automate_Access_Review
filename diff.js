function divergence(expected, actual) {
  return [...actual].filter(u => !expected.has(u));
}

export default divergence;
