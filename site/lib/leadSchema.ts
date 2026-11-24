import { toConsentTimestamp } from "./consent";
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
  ad_user_data_consent: boolean;
  ad_personalization_consent: boolean;
  // ISO 8601 UTC. Empty when the visitor made no banner choice.
  ad_consent_timestamp: string;
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
    // Domains are compared in lower case downstream, so store them that way.
    const value = name === "referring_domain" ? text(raw).toLowerCase() : text(raw);
    if (typeof raw !== "string" || value.length > HIDDEN_FIELD_MAX) errors.push(name);
    else if (value) hidden[name] = value;
  }

  // A missing consent value is the safe one: false. A lead is never blocked
  // for having no consent, only for sending something that is not a boolean.
  const consentFlag = (name: string): boolean => {
    const raw = body[name];
    if (raw === undefined || raw === null) return false;
    if (typeof raw !== "boolean") errors.push(name);
    return raw === true;
  };
  const adUserData = consentFlag("ad_user_data_consent");
  const adPersonalization = consentFlag("ad_personalization_consent");

  let consentTimestamp = "";
  const rawTimestamp = body.ad_consent_timestamp;
  if (rawTimestamp !== undefined && rawTimestamp !== null && rawTimestamp !== "") {
    const parsed = typeof rawTimestamp === "string" ? toConsentTimestamp(rawTimestamp.trim()) : null;
    if (parsed) consentTimestamp = parsed;
    else errors.push("ad_consent_timestamp");
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
      ad_user_data_consent: adUserData,
      ad_personalization_consent: adPersonalization,
      ad_consent_timestamp: consentTimestamp,
      ...hidden,
    },
  };
}
