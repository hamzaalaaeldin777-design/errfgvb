export const PLAN_METADATA = {
  free: {
    label: "Free",
    dailyLimit: 100,
    price: "$0",
    tagline: "100 requests/day for prototyping.",
  },
  pro: {
    label: "Pro",
    dailyLimit: 10_000,
    price: "$49",
    tagline: "10,000 requests/day for production apps.",
  },
  enterprise: {
    label: "Enterprise",
    dailyLimit: null,
    price: "Custom",
    tagline: "Unlimited requests with priority support.",
  },
} as const;

export type PlanName = keyof typeof PLAN_METADATA;

export function getDailyLimit(plan: PlanName) {
  return PLAN_METADATA[plan].dailyLimit;
}

