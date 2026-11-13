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
      <div className="demo-layout">
        <div className="demo-intro">
          <h1>Book a demo</h1>
          <p className="demo-lead">See Roadwren on your own routes in 30 minutes.</p>
          {planName && (
            <p className="demo-plan">
              You picked the <strong>{planName}</strong> plan.
            </p>
          )}
          <ul className="demo-points">
            <li>Your vehicles on a live map</li>
            <li>How driver safety scores are worked out</li>
            <li>Maintenance alerts set up for your fleet</li>
          </ul>
        </div>
        <div className="form-card">
          <DemoForm plan={plan} />
        </div>
      </div>
    </main>
  );
}
