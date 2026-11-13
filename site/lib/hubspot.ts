import { HIDDEN_FIELD_NAMES } from "./hiddenFields";
import type { Lead } from "./leadSchema";

const UPSERT_URL = "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert";

// Property names must exist in the portal: see docs/hubspot-properties.md.
// Empty values are left out so a new lead never blanks a stored value.
export function toHubSpotProperties(lead: Lead): Record<string, string> {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.first_name,
    lastname: lead.last_name,
    company: lead.company,
    employees: lead.employees,
    form_id: lead.form_id,
  };
  if (lead.plan) properties.plan = lead.plan;
  for (const name of HIDDEN_FIELD_NAMES) {
    const value = lead[name];
    if (value) properties[name] = value;
  }
  return properties;
}

export type UpsertResult = { delivered: true } | { delivered: false; status: number | null };

// Upserts on email so a repeat lead updates the contact instead of failing
// with 409. Never returns or logs the response body: it can hold the email.
export async function upsertContact(lead: Lead, token: string): Promise<UpsertResult> {
  const res = await fetch(UPSERT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: [{ idProperty: "email", id: lead.email, properties: toHubSpotProperties(lead) }],
    }),
  });
  // 207 means at least one input in the batch failed; there is only one.
  if (res.ok && res.status !== 207) return { delivered: true };
  return { delivered: false, status: res.status };
}
