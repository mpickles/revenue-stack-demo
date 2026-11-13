import Link from "next/link";

const FEATURES = [
  {
    title: "Live vehicle location",
    body: "See every van and truck on one map, updated every few seconds.",
  },
  {
    title: "Driver safety scores",
    body: "Harsh braking, speeding and idling, scored per driver and per week.",
  },
  {
    title: "Maintenance alerts",
    body: "Service reminders by mileage and engine hours, before a breakdown.",
  },
];

export default function Home() {
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">Know where every vehicle is, and how it is driven</h1>
          <p className="hero-sub">
            Roadwren is fleet telematics software for delivery and service fleets of
            20 to 2,000 vehicles. Built for fleet managers and operations leaders.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/demo">
              Book a demo
            </Link>
            <Link className="button button-secondary" href="/pricing">
              See plans and pricing
            </Link>
          </div>
        </div>
        {/* A route with three stops and one vehicle on it. Decorative. */}
        <svg className="hero-route" viewBox="0 0 400 320" aria-hidden="true" focusable="false">
          <defs>
            <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" className="hero-route-grid" />
            </pattern>
          </defs>
          <rect width="400" height="320" fill="url(#hero-grid)" />
          <path
            className="hero-route-road"
            d="M 40 280 L 40 220 Q 40 200 60 200 L 180 200 Q 200 200 200 180 L 200 100 Q 200 80 220 80 L 340 80 Q 360 80 360 100 L 360 240"
          />
          <circle className="hero-route-stop" cx="40" cy="280" r="9" />
          <circle className="hero-route-stop" cx="200" cy="140" r="9" />
          <circle className="hero-route-stop" cx="360" cy="240" r="9" />
          <circle className="hero-route-vehicle-halo" cx="120" cy="200" r="16" />
          <circle className="hero-route-vehicle" cx="120" cy="200" r="7" />
        </svg>
      </section>

      <section className="features" aria-labelledby="features-title">
        <h2 id="features-title" className="features-title">
          One place to run the fleet
        </h2>
        <ul className="feature-grid">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
