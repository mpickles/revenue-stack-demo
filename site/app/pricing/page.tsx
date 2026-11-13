import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing | Roadwren",
};

const FEATURED_PLAN = "pro";

// "$19 per vehicle / month" -> amount "$19", unit "per vehicle / month".
function splitPrice(price: string) {
  const [first, ...rest] = price.split(" ");
  return first.startsWith("$") ? { amount: first, unit: rest.join(" ") } : { amount: price, unit: "" };
}

export default function Pricing() {
  return (
    <main>
      <div className="page-intro">
        <h1>Plans and pricing</h1>
        <p>Prices are per vehicle, billed monthly. All prices are made up.</p>
      </div>
      <div className="plans">
        {PLANS.map((plan) => {
          const featured = plan.id === FEATURED_PLAN;
          const { amount, unit } = splitPrice(plan.price);
          return (
            <section
              key={plan.id}
              className={featured ? "plan plan-featured" : "plan"}
              aria-labelledby={`plan-${plan.id}`}
            >
              <h2 id={`plan-${plan.id}`} className="plan-name">
                {plan.name}
              </h2>
              <p className="plan-summary">{plan.summary}</p>
              <p className="plan-price">
                <span className={unit ? "plan-amount" : "plan-amount plan-amount-text"}>{amount}</span>
                {unit && <span className="plan-unit">{unit}</span>}
              </p>
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link
                className={featured ? "button button-primary" : "button button-secondary"}
                href={`/demo?plan=${plan.id}`}
              >
                Book a demo
              </Link>
            </section>
          );
        })}
      </div>
    </main>
  );
}
