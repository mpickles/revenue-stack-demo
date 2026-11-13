import type { Metadata } from "next";
import { PLANS, toPlanId } from "@/lib/plans";
import { DemoForm } from "./DemoForm";

export const metadata: Metadata = {
  title: "Book a demo | Roadwren",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const plan = toPlanId((await searchParams).plan);
  const planName = PLANS.find((p) => p.id === plan)?.name;

  return (
    <main>
      <h1>Book a demo</h1>
      <p>
        See Roadwren on your own routes in 30 minutes.
        {planName && <> You picked the <strong>{planName}</strong> plan.</>}
      </p>
      <DemoForm plan={plan} />
    </main>
  );
}
