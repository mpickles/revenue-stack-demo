// The only valid ?plan= values. /demo will validate against this list.
export const PLAN_IDS = ["core", "pro", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  summary: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "core",
    name: "Core",
    price: "$19 per vehicle / month",
    summary: "For fleets getting started with live tracking.",
    features: ["Live vehicle location", "Trip history, 90 days", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29 per vehicle / month",
    summary: "For fleets that manage driver safety and upkeep.",
    features: [
      "Everything in Core",
      "Driver safety scores",
      "Maintenance alerts",
      "Trip history, 1 year",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom pricing",
    summary: "For large fleets with many depots.",
    features: [
      "Everything in Pro",
      "Single sign-on",
      "Data export API",
      "Named account manager",
    ],
  },
];

// Reads ?plan= and returns a valid plan ID or null.
export function toPlanId(raw: string | string[] | undefined): PlanId | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (PLAN_IDS as readonly string[]).includes(value ?? "") ? (value as PlanId) : null;
}
