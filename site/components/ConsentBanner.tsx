"use client";

import { useEffect, useState } from "react";
import { applyConsent } from "@/lib/attribution";
import { CONSENT_OPEN_EVENT, readConsent, setConsent, type ConsentChoice } from "@/lib/consent";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setOpen(true);
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
      <p>
        This demo uses cookies to measure visits and to remember which ad or
        campaign brought you here. See the <a href="/privacy">privacy page</a>.
      </p>
      <div className="consent-actions">
        <button type="button" onClick={() => choose("denied")}>Reject all</button>
        <button type="button" onClick={() => choose("granted")}>Accept all</button>
      </div>
    </div>
  );
}
