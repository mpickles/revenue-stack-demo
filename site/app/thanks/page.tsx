import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thanks | Roadwren",
};

export default function Thanks() {
  return (
    <main className="thanks">
      <div className="thanks-card">
        <svg className="thanks-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <circle cx="24" cy="24" r="24" className="thanks-mark-bg" />
          <path d="M15 24.5 L21.5 31 L33.5 18" className="thanks-mark-check" />
        </svg>
        <h1>Thanks, your demo request is in</h1>
        <p>
          In a real company, someone would now be in touch to book a time. Roadwren
          is fictional, so no one will contact you.
        </p>
        <Link className="button button-secondary" href="/">
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
