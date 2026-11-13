import { readAttribution } from "./attribution";
import { ATTRIBUTION_KEYS } from "./clickIds";
import { readConsent } from "./consent";
import { readGaClientId } from "./gaClientId";

export const HIDDEN_FIELD_NAMES = [...ATTRIBUTION_KEYS, "ga_client_id"] as const;
export type HiddenFieldName = (typeof HIDDEN_FIELD_NAMES)[number];

// Read fresh each call. Empty unless the visitor has granted consent.
export function readHiddenFieldValues(): Record<HiddenFieldName, string> {
  const values = Object.fromEntries(HIDDEN_FIELD_NAMES.map((name) => [name, ""])) as Record<
    HiddenFieldName,
    string
  >;
  if (readConsent() !== "granted") return values;
  Object.assign(values, readAttribution());
  values.ga_client_id = readGaClientId() ?? "";
  return values;
}
