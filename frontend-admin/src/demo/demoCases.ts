export type AdminCase = {
  id: string;
  userId: string;
  applicant: string;
  journeyState: "HITL_ESCALATION" | "FRAUD_LOCKOUT" | "ADMIN_APPROVED" | "REJECTED";
  trustScore: number;
  altScore: number;
  reasoning?: string;
  riskLevel?: string;
  updatedAt?: string;
  isDemo?: boolean;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Aarav",
  "Diya",
  "Ishaan",
  "Meera",
  "Kabir",
  "Ananya",
  "Rohan",
  "Sara",
  "Vihaan",
  "Nisha",
  "Arjun",
  "Kavya",
  "Reyansh",
  "Tara",
  "Neel",
  "Maya",
  "Advait",
  "Ira",
  "Shaurya",
  "Aisha",
];
const LAST = [
  "Sharma",
  "Iyer",
  "Nair",
  "Gupta",
  "Reddy",
  "Khan",
  "Patel",
  "Mehta",
  "Das",
  "Chatterjee",
  "Joshi",
  "Singh",
  "Kulkarni",
  "Bose",
  "Malhotra",
  "Rao",
  "Saxena",
  "Kapoor",
  "Bhat",
  "Verma",
];

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffleInPlace<T>(rng: () => number, arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function isoMinutesAgo(minutesAgo: number) {
  const d = new Date(Date.now() - minutesAgo * 60_000);
  return d.toISOString();
}

function makeId(rng: () => number) {
  const chunk = () => Math.floor(rng() * 36 ** 4).toString(36).padStart(4, "0").toUpperCase();
  return `DEMO-${chunk()}-${chunk()}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function templateForState(state: AdminCase["journeyState"], rng: () => number) {
  if (state === "HITL_ESCALATION") {
    const reasons = [
      "Policy eligible but bank engine failed due to FOIR stress; recommend co-applicant or longer tenure.",
      "Name/address variance across documents triggered manual review threshold.",
      "Borderline credit profile with limited history; clarification required for income stability.",
      "High requested amount relative to income; suggest reducing amount or adding collateral.",
    ];
    return {
      riskLevel: pick(rng, ["MEDIUM", "HIGH"]),
      reasoning: pick(rng, reasons),
      trustScore: clamp(Math.round(62 + rng() * 20), 55, 84),
      altScore: clamp(Math.round(420 + rng() * 180), 380, 620),
    };
  }
  if (state === "FRAUD_LOCKOUT") {
    const reasons = [
      "Layer 1 checksum/format failure detected on government ID; locked for security review.",
      "Vision analysis flagged tampering markers with inconsistent typography; lockout recommended.",
      "Cross-document mismatches exceeded threshold; potential identity swap risk.",
      "Document readability too low across critical IDs; resubmission required before proceeding.",
    ];
    return {
      riskLevel: pick(rng, ["HIGH", "CRITICAL"]),
      reasoning: pick(rng, reasons),
      trustScore: clamp(Math.round(5 + rng() * 35), 0, 49),
      altScore: clamp(Math.round(300 + rng() * 140), 250, 480),
    };
  }
  if (state === "ADMIN_APPROVED") {
    const reasons = [
      "Manual review completed: documents consistent; approved to continue pipeline.",
      "Verified co-applicant and bank details; waiver granted for minor variance.",
      "Risk acceptable after clarification; approve and proceed to disbursal.",
      "Admin override: strong academic + income signals; approved with monitoring.",
    ];
    return {
      riskLevel: pick(rng, ["LOW", "MEDIUM"]),
      reasoning: pick(rng, reasons),
      trustScore: clamp(Math.round(86 + rng() * 12), 85, 100),
      altScore: clamp(Math.round(610 + rng() * 180), 580, 850),
    };
  }
  // REJECTED
  const reasons = [
    "Core policy requirements not met (income/CIBIL threshold).",
    "Fraud risk remained unresolved after review; rejected for safety.",
    "Bank rules failed with no mitigations (no co-applicant/collateral).",
    "Multiple high-risk flags across engines; rejected with re-application guidance.",
  ];
  return {
    riskLevel: pick(rng, ["HIGH", "CRITICAL"]),
    reasoning: pick(rng, reasons),
    trustScore: clamp(Math.round(30 + rng() * 35), 10, 70),
    altScore: clamp(Math.round(320 + rng() * 220), 250, 650),
  };
}

export function generateDemoCases(seed = 42): AdminCase[] {
  const rng = mulberry32(seed);
  const out: AdminCase[] = [];
  const namePool = FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`));
  shuffleInPlace(rng, namePool);
  let nameIndex = 0;

  const nextName = () => {
    const name = namePool[nameIndex % namePool.length];
    nameIndex += 1;
    return name;
  };

  const mk = (journeyState: AdminCase["journeyState"], count: number) => {
    for (let i = 0; i < count; i++) {
      const name = nextName();
      const t = templateForState(journeyState, rng);
      out.push({
        id: makeId(rng),
        userId: `demo_user_${journeyState.toLowerCase()}_${i}_${Math.floor(rng() * 10_000)}`,
        applicant: name,
        journeyState,
        trustScore: t.trustScore,
        altScore: t.altScore,
        reasoning: t.reasoning,
        riskLevel: t.riskLevel,
        updatedAt: isoMinutesAgo(Math.floor(5 + rng() * 240)),
        isDemo: true,
      });
    }
  };

  // ~20 each, distinct per tab.
  mk("HITL_ESCALATION", 19);
  mk("FRAUD_LOCKOUT", 21);
  mk("ADMIN_APPROVED", 18);
  mk("REJECTED", 20);

  // Shuffle so lists feel organic.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

