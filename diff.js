function normalize(input) {
  const map = new Map();
  if (!input) return map;

  const add = (item) => {
    if (typeof item === "string") {
      map.set(item, { email: item });
    } else if (item?.email) {
      map.set(item.email, item);
    }
  };

  if (input instanceof Set || Array.isArray(input)) {
    for (const item of input) add(item);
    return map;
  }

  if (typeof input === "object") {
    for (const value of Object.values(input)) add(value);
  }

  return map;
}


export function diffSets(expected, actual) {
  const expectedMap = normalize(expected);
  const actualMap = normalize(actual);

  const unauthorized = [];
  const missing = [];

  for (const [email, value] of actualMap) {
    if (!expectedMap.has(email)) {
      unauthorized.push(value);
    }
  }

  for (const [email, value] of expectedMap) {
    if (!actualMap.has(email)) {
      missing.push(value);
    }
  }

  return { unauthorized, missing };
}
