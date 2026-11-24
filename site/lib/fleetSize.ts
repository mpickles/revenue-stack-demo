// The six fleet size bands on the /demo form, in vehicles. The value sent to
// /api/lead and to the CRM is the same text the visitor sees. The bands and
// what each one means are in docs/roadwren-brief.md, section 3.
export const FLEET_SIZE_BANDS = ["1-19", "20-49", "50-199", "200-499", "500-999", "1,000+"] as const;

export type FleetSizeBand = (typeof FLEET_SIZE_BANDS)[number];

export function isFleetSizeBand(value: unknown): value is FleetSizeBand {
  return (FLEET_SIZE_BANDS as readonly unknown[]).includes(value);
}
