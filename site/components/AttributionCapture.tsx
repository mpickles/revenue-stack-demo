"use client";

import { useEffect } from "react";
import { captureLanding } from "@/lib/attribution";
import { readConsent } from "@/lib/consent";

// Runs once per full page load: that is the landing.
export function AttributionCapture() {
  useEffect(() => {
    captureLanding(window.location.search, readConsent(), {
      referrer: document.referrer,
      host: window.location.hostname,
      path: window.location.pathname,
    });
  }, []);
  return null;
}
