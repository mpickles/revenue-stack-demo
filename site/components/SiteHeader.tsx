import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark">
          Roadwren
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/pricing">Pricing</Link>
          <Link href="/demo" className="button button-primary button-sm">
            Book a demo
          </Link>
        </nav>
      </div>
    </header>
  );
}
