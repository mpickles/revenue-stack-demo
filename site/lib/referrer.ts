// Where the visit came from, for leads with no UTM values. The CRM turns the
// domain into a channel (docs/roadwren-brief.md, section 6). The site only
// records it, under the same consent gate as the click IDs.
export const VISIT_KEYS = ["referring_domain", "landing_page"] as const;
export type VisitKey = (typeof VISIT_KEYS)[number];

const LANDING_PAGE_MAX = 200;

const bareHost = (host: string): string => host.trim().toLowerCase().replace(/^www\./, "");

// The host name of the referrer, in lower case, when it is a web page on
// another site. Empty for no referrer, a referrer that is not http or https,
// and the site's own domain with or without www.
export function referringDomain(referrer: string, ownHost: string): string {
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  const host = url.hostname.toLowerCase();
  if (!host || bareHost(host) === bareHost(ownHost)) return "";
  return host;
}

// The path only. The query string is left out: it is where click IDs travel.
export function landingPath(pathname: string): string {
  return pathname.startsWith("/") ? pathname.slice(0, LANDING_PAGE_MAX) : "";
}
