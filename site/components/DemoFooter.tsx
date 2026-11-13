import Link from "next/link";
import { ConsentSettingsButton } from "./ConsentSettingsButton";

export function DemoFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <span className="wordmark">Roadwren</span>
          <p className="footer-disclaimer">
            Fictional demo project. Roadwren and all data on this site are made up.
          </p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          <Link href="/pricing">Pricing</Link>
          <Link href="/demo">Book a demo</Link>
          <Link href="/privacy">Privacy</Link>
          <ConsentSettingsButton />
        </nav>
      </div>
    </footer>
  );
}
