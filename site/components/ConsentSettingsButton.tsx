"use client";

import { CONSENT_OPEN_EVENT } from "@/lib/consent";

export function ConsentSettingsButton() {
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
    >
      Cookie settings
    </button>
  );
}
