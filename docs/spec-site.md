# Site spec
Stack: Next.js (App Router), TypeScript. Deploy on Vercel. No UI library.

Company (fictional)
- Name: Roadwren. Fleet telematics software for delivery and service fleets:
 live vehicle location, driver safety scores, maintenance alerts.
- Buyers: fleet managers and operations leaders. Fleets of 20 to 2,000 vehicles.
- Plans on /pricing: Core, Pro, Enterprise. The ?plan= values are core, pro
 and enterprise.
- No real logos, no real customer names, no testimonials.

Every page: a top banner and footer line that say this is a fictional demo
project, and a robots noindex tag. The banner asks visitors to use a made-up
email address.

Pages
- / home
- /pricing three plans, each with a "Book a demo" link that carries ?plan=
- /demo custom React form: first name, last name, work email, company,
 employees (select). Posts to /api/lead.
- /start a three-step form (role, company size, contact). One event per step.
- /hs an embedded HubSpot form
- /framed a page that embeds a form from a second origin in an iframe
- /thanks confirmation page
- /privacy what the demo collects, where it is sent, how to ask for deletion
- /debug the consent state, the stored click IDs and UTMs, and the GA
 client ID, so a phone can be checked with no developer tools.
 No personal data on it.

Data layer contract
- window.dataLayer exists before the container snippet. Only push, never reassign.
- Events: form_start, form_step {step_number, step_name},
 generate_lead {form_id, form_type, plan}.
- No personal data in the data layer except user_data {email} on generate_lead,
 used for enhanced conversions. Record that choice in docs/decisions.md.

Consent
- A banner sets all four consent mode signals to denied before the container
 loads, then updates them on choice. Remember the choice in a first-party cookie.

Click IDs
- On landing, read gclid, gbraid, wbraid, fbclid, li_fat_id, msclkid and the
 five utm parameters. Store them in a first-party cookie for 90 days, only
 after ad storage is granted. If consent comes later in the visit, store then.
- Also read the GA client ID so the CRM record can be joined to GA4 later.
- Every form carries these as hidden fields.

/api/lead
- Validates input, sends the lead to HubSpot using HUBSPOT_TOKEN from the
 environment, returns JSON. Never logs an email address.

Tests
- Unit tests for the click ID parser and the consent gate.
- One browser test: open /demo?gclid=TEST123, accept consent, submit, and
 assert the generate_lead push and the /api/lead payload.

Proof page (proof/index.html, its own Vercel project and free address)
- Plain HTML and CSS. No framework, no tracking.
- My name, two sentences, then one line with my three or four best real
 numbers. Then six slots. Each slot: title, one-line claim, one number, one
 line on what broke and what I changed, a video link, a repo link, the date
 it shipped. A slot that is not built yet shows its title and "planned" or
 "in progress".
- At the bottom: how to reach me. My LinkedIn, and an email address I made
 for the job search.
- robots noindex until I say otherwise.
