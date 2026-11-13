import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing | Roadwren",
};

export default function Pricing() {
  return (
    <main>
      <h1>Plans and pricing</h1>
      <p>Prices are per vehicle, billed monthly. All prices are made up.</p>
      <div className="plans">
        {PLANS.map((plan) => (
          <section key={plan.id} className="plan">
            <h2>{plan.name}</h2>
            <p className="plan-price">{plan.price}</p>
            <p>{plan.summary}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <Link className="cta" href={`/demo?plan=${plan.id}`}>
              Book a demo
            </Link>
          </section>
        ))}
      </div>
    </main>
  );
}
