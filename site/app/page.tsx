import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Know where every vehicle is, and how it is driven</h1>
      <p>
        Roadwren is fleet telematics software for delivery and service fleets of
        20 to 2,000 vehicles. Built for fleet managers and operations leaders.
      </p>
      <ul className="features">
        <li>
          <h2>Live vehicle location</h2>
          <p>See every van and truck on one map, updated every few seconds.</p>
        </li>
        <li>
          <h2>Driver safety scores</h2>
          <p>Harsh braking, speeding and idling, scored per driver and per week.</p>
        </li>
        <li>
          <h2>Maintenance alerts</h2>
          <p>Service reminders by mileage and engine hours, before a breakdown.</p>
        </li>
      </ul>
      <p>
        <Link className="cta" href="/pricing">See plans and pricing</Link>
      </p>
    </main>
  );
}
