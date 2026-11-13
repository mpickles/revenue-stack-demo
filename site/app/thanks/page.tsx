import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thanks | Roadwren",
};

export default function Thanks() {
  return (
    <main>
      <h1>Thanks, your demo request is in</h1>
      <p>
        In a real company, someone would now be in touch to book a time. Roadwren
        is fictional, so no one will contact you.
      </p>
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </main>
  );
}
