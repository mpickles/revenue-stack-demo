import { upsertContact } from "@/lib/hubspot";
import { validateLead } from "@/lib/leadSchema";

const MAX_BODY_BYTES = 10_000;

// Log lines carry form_id and status only. Never an email or a request body.
export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) throw new Error("too large");
    input = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, errors: ["body"] }, { status: 400 });
  }

  const result = validateLead(input);
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors }, { status: 400 });
  }
  const { lead } = result;

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    console.info(`[lead] not delivered: HUBSPOT_TOKEN unset, form_id=${lead.form_id}`);
    return Response.json({ ok: true, delivered: false, reason: "hubspot_not_configured" });
  }

  try {
    const upsert = await upsertContact(lead, token);
    if (upsert.delivered) return Response.json({ ok: true, delivered: true });
    console.error(`[lead] HubSpot upsert failed: status=${upsert.status}, form_id=${lead.form_id}`);
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    console.error(`[lead] HubSpot request failed: ${name}, form_id=${lead.form_id}`);
  }
  return Response.json({ ok: false, delivered: false, reason: "crm_error" }, { status: 502 });
}
