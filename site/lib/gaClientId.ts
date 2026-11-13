// The _ga cookie looks like GA1.1.1234567890.1731500000. The client ID that
// GA4 reports, and that the CRM record is joined on, is the last two parts.
export function parseGaClientId(raw: string | undefined): string | null {
  const match = raw?.match(/^GA\d+\.\d+\.(\d+\.\d+)$/);
  return match ? match[1] : null;
}

export function readGaClientId(): string | null {
  const match = document.cookie.match(/(?:^|; )_ga=([^;]*)/);
  return parseGaClientId(match?.[1]);
}
