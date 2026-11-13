// Contact for privacy and deletion requests. The address comes only from
// NEXT_PUBLIC_CONTACT_EMAIL (inlined at build time); when it is unset or not
// an email, pages fall back to the repo owner's GitHub profile.
export const REPO_OWNER_PROFILE_URL = "https://github.com/mpickles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function contactEmail(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && EMAIL_PATTERN.test(value) ? value : null;
}
