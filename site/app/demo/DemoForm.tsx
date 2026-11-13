"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HiddenAttributionFields } from "@/components/HiddenAttributionFields";
import { push } from "@/lib/dataLayer";
import { EMPLOYEE_BANDS } from "@/lib/employees";
import type { PlanId } from "@/lib/plans";

const FORM_ID = "demo";
const FORM_TYPE = "custom";

const FIELD_LABELS: Record<string, string> = {
  first_name: "first name",
  last_name: "last name",
  email: "work email",
  company: "company",
  employees: "employees",
};

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };

export function DemoForm({ plan }: { plan: PlanId | null }) {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // After a blocked submit, show every invalid field, not only touched ones.
  // "invalid" does not bubble, so listen in the capture phase on the form.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const mark = () => setAttempted(true);
    form.addEventListener("invalid", mark, true);
    return () => form.removeEventListener("invalid", mark, true);
  }, []);

  const onFocus = () => {
    if (started.current) return;
    started.current = true;
    push({ event: "form_start" });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Hidden attribution fields were filled by their own submit listener,
    // which runs before this handler.
    const fields = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setStatus({ kind: "sending" });

    let res: Response;
    try {
      res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, form_id: FORM_ID, plan }),
      });
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server. Please try again." });
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
      const bad = (body.errors ?? []).map((name) => FIELD_LABELS[name]).filter(Boolean);
      setStatus({
        kind: "error",
        message: bad.length
          ? `Please check: ${bad.join(", ")}.`
          : "Something went wrong sending the form. Please try again.",
      });
      return;
    }

    push({
      event: "generate_lead",
      form_id: FORM_ID,
      form_type: FORM_TYPE,
      plan,
      user_data: { email: fields.email.trim().toLowerCase() },
    });
    router.push("/thanks");
  };

  return (
    <form
      className="lead-form"
      onFocus={onFocus}
      onSubmit={onSubmit}
      ref={formRef}
      data-attempted={attempted || undefined}
    >
      <p className="form-note">All fields are required.</p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="first_name">First name</label>
          <input id="first_name" name="first_name" autoComplete="given-name" required maxLength={100} />
          <span className="field-error-text">Enter your first name.</span>
        </div>
        <div className="field">
          <label htmlFor="last_name">Last name</label>
          <input id="last_name" name="last_name" autoComplete="family-name" required maxLength={100} />
          <span className="field-error-text">Enter your last name.</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          aria-describedby="email-hint"
        />
        <span id="email-hint" className="hint">
          This is a demo. Please use a made-up address.
        </span>
        <span className="field-error-text">Enter an email address like name@company.com.</span>
      </div>
      <div className="field">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" autoComplete="organization" required maxLength={200} />
        <span className="field-error-text">Enter your company name.</span>
      </div>
      <div className="field">
        <label htmlFor="employees">Employees</label>
        <select id="employees" name="employees" required defaultValue="">
          <option value="" disabled>
            Choose a range
          </option>
          {EMPLOYEE_BANDS.map((band) => (
            <option key={band.value} value={band.value}>
              {band.label}
            </option>
          ))}
        </select>
        <span className="field-error-text">Choose a range.</span>
      </div>
      <HiddenAttributionFields />
      {status.kind === "error" && (
        <p className="form-error" role="alert">
          {status.message}
        </p>
      )}
      <button type="submit" className="button button-primary" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Sending…" : "Book my demo"}
      </button>
    </form>
  );
}
