export default {
  netskope: {
    keywords: ["netskope"],
  },
  jumpcloud: {
    keywords: ["jumpcloud admin", "jc admin"],
    evidenceOnly: true
  },
  github: {
    keywords: ["github group offline"]
  },
  slack: {
    keywords: ["slack"]
  },

  crowdstrike: {
    keywords: ["crowdstrike", "falcon"]
  },
  caniphish: {
    keywords: ["caniphish"],
    evidenceOnly: true
  },
  csat: {
    keywords: ["csat", "cis"],
    evidenceOnly: true
  },
  cloudflare: {
    keywords: ["cloudflare", "cf"]
  },
  oci: {
    autoGroupPrefix: "OracleOCI-"
  },
};
