import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { ConsentBanner } from "@/components/ConsentBanner";
import { DemoFooter } from "@/components/DemoFooter";
import { CONSENT_DEFAULT_SCRIPT, gtmId, gtmScript } from "@/lib/headScripts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roadwren",
  description: "Fictional fleet telematics company. A demo project.",
  robots: { index: false, follow: false },
};

const GTM_ID = gtmId(process.env.NEXT_PUBLIC_GTM_ID);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT_SCRIPT }} />
        {GTM_ID && <script dangerouslySetInnerHTML={{ __html: gtmScript(GTM_ID) }} />}
      </head>
      <body>
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <DemoBanner />
        {children}
        <DemoFooter />
        <ConsentBanner />
      </body>
    </html>
  );
}
