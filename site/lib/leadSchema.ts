import { isFleetSizeBand, type FleetSizeBand } from "./fleetSize";
import { HIDDEN_FIELD_NAMES, type HiddenFieldName } from "./hiddenFields";
import { PLAN_IDS, type PlanId } from "./plans";

export const FORM_IDS = ["demo"] as const;
export type FormId = (typeof FORM_IDS)[number];

export type Lead = {
  form_id: FormId;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  fleet_size: FleetSizeBand;
  plan: PlanId | null;
} & Partial<Record<HiddenFieldName, string>>;

export type LeadResult = { ok: true; lead: Lead } | { ok: false; errors: string[] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HIDDEN_FIELD_MAX = 500;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

// Returns field names only on error, never values, so nothing personal is
// echoed back or logged. Unknown keys are dropped.
export function validateLead(input: unknown): LeadResult {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: string[] = [];

  const formId = text(body.form_id);
  if (!(FORM_IDS as readonly string[]).includes(formId)) errors.push("form_id");

  const required = (name: string, max: number) => {
    const value = text(body[name]);
    if (!value || value.length > max) errors.push(name);
    return value;
  };
  const firstName = required("first_name", 100);
  const lastName = required("last_name", 100);

  const email = text(body.email).toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) errors.push("email");

  const company = required("company", 200);

  const fleetSize = text(body.fleet_size);
  if (!isFleetSizeBand(fleetSize)) errors.push("fleet_size");

  const rawPlan = body.plan;
  let plan: PlanId | null = null;
  if (rawPlan !== undefined && rawPlan !== null && rawPlan !== "") {
    if ((PLAN_IDS as readonly unknown[]).includes(rawPlan)) plan = rawPlan as PlanId;
    else errors.push("plan");
  }

  const hidden: Partial<Record<HiddenFieldName, string>> = {};
  for (const name of HIDDEN_FIELD_NAMES) {
    const raw = body[name];
    if (raw === undefined || raw === null) continue;
    const value = text(raw);
    if (typeof raw !== "string" || value.length > HIDDEN_FIELD_MAX) errors.push(name);
    else if (value) hidden[name] = value;
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    lead: {
      form_id: formId as FormId,
      first_name: firstName,
      last_name: lastName,
      email,
      company,
      fleet_size: fleetSize as FleetSizeBand,
      plan,
      ...hidden,
    },
  };
}
