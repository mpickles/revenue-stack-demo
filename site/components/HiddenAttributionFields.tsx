"use client";

import { useEffect, useRef } from "react";
import { HIDDEN_FIELD_NAMES, readHiddenFieldValues } from "@/lib/hiddenFields";

// Hidden inputs for click IDs, UTMs, the referring domain, the landing page
// and the GA client ID. Values are filled
// on submit, not on render: capture runs after hydration, and consent can
// change while the form is open. The native submit listener on the form runs
// before React's onSubmit, so the handler sees the fresh values.
export function HiddenAttributionFields() {
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = firstInput.current?.form;
    if (!form) return;
    const fill = () => {
      const values = readHiddenFieldValues();
      for (const name of HIDDEN_FIELD_NAMES) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = values[name];
      }
    };
    form.addEventListener("submit", fill);
    return () => form.removeEventListener("submit", fill);
  }, []);

  return (
    <>
      {HIDDEN_FIELD_NAMES.map((name, i) => (
        <input key={name} ref={i === 0 ? firstInput : undefined} type="hidden" name={name} defaultValue="" />
      ))}
    </>
  );
}
