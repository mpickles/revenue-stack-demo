"use client";

import { useEffect, useState } from "react";
import { applyConsent } from "@/lib/attribution";
import {
  CONSENT_OPEN_EVENT,
  readConsent,
  readConsentTime,
  setConsent,
  type ConsentChoice,
} from "@/lib/consent";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // A choice saved before its time was recorded is asked again, so every
    // stored choice has a time.
    if (readConsent() === null || readConsentTime() === "") setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    setConsent(choice);
    applyConsent(choice);
    setOpen(false);
  };

  return (
    <div className="consent-banner" role="dialog" aria-label="Cookie consent">
      <p className="consent-title">Cookies on this demo</p>
      <p>
        This demo uses cookies to measure visits and to remember which ad or
        campaign brought you here. See the <a href="/privacy">privacy page</a>.
      </p>
      {/* Same size and style: neither choice is nudged. */}
      <div className="consent-actions">
        <button type="button" className="button button-secondary" onClick={() => choose("denied")}>
          Reject all
        </button>
        <button type="button" className="button button-secondary" onClick={() => choose("granted")}>
          Accept all
        </button>
      </div>
    </div>
  );
}
