export const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "li_fat_id", "msclkid"] as const;
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export const ATTRIBUTION_KEYS = [...CLICK_ID_KEYS, ...UTM_KEYS] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type Attribution = Partial<Record<AttributionKey, string>>;

// Reads the click IDs and UTMs from a query string. Unknown and empty
// parameters are dropped. URLSearchParams handles the decoding.
export function parseClickIds(search: string): Attribution {
  const params = new URLSearchParams(search);
  const found: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key)?.trim();
    if (value) found[key] = value;
  }
  return found;
}
