# Site spec
Stack: Next.js (App Router), TypeScript. Deploy on Vercel. No UI library.

Company (fictional)
- Name: Roadwren. Fleet telematics software for delivery and service fleets:
 live vehicle location, driver safety scores, maintenance alerts.
- Buyers: fleet managers and operations leaders. Fleets of 20 to 2,000 vehicles.
- The one qualifying question is fleet size in vehicles, because the price is
 per vehicle. The site never asks employee count. The rules are in
 docs/roadwren-brief.md.
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
 fleet size (select). Posts to /api/lead.
 - The select is required. Its label is "Fleet size (vehicles)". Its name is
  fleet_size.
 - The six bands, sent exactly as written: 1-19, 20-49, 50-199, 200-499,
  500-999, 1,000+.
 - No band is blocked. A fleet under 20 vehicles is still saved as a lead.
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
- Remember the time of the choice too, as an ISO 8601 UTC time, in a second
 first-party cookie with the same lifetime. A new choice replaces the time.
 Both cookies record the choice itself, so they need no consent.
- The site exposes three consent values for the lead payload:
 ad_user_data_consent and ad_personalization_consent (booleans) and
 ad_consent_timestamp (the stored time, or empty).
- The banner has one Accept all and one Reject all. So both booleans always
 take the same value: true after Accept all, false after Reject all.
- Before any choice both booleans are false and the timestamp is empty.
- A saved choice with no saved time (made before the time was recorded) is
 kept. The banner stays hidden. The lead goes out with the saved booleans and
 an empty timestamp.

Click IDs
- On landing, read gclid, gbraid, wbraid, fbclid, li_fat_id, msclkid and the
 five utm parameters. Store them in a first-party cookie for 90 days, only
 after ad storage is granted. If consent comes later in the visit, store then.
- Also read the GA client ID so the CRM record can be joined to GA4 later.
- Every form carries these as hidden fields.

Referrer and landing page
- A landing is a full page load. On each landing also read:
 - referring_domain: the host name of document.referrer, in lower case, when
  the referrer is an http or https page on a different site. Otherwise empty.
  The site's own domain, with or without www, is never a referrer.
 - landing_page: the path of the page the visit landed on, with no query
  string. At most 200 characters.
- Both follow the same consent gate as the click IDs and UTM values. Before
 consent they are held in memory only. They are stored (in the same 90-day
 cookie) and sent only after ad storage is granted. Rejecting deletes them.
- The stored set has two groups, and each has its own rule.
 - The click ID group: gclid, gbraid, wbraid, fbclid, li_fat_id, msclkid.
  It is replaced only when the new landing carries at least one click ID,
  and then the whole group is replaced. A landing with no click ID never
  removes a stored click ID.
 - The latest touch group: the five UTM values, referring_domain and
  landing_page. It is replaced as a whole by any landing that has a source.
  A landing has a source when it carries a click ID, a UTM value or a
  referring domain.
- So a visitor who clicks an ad and later comes back from a search engine
 keeps the stored click ID, and gets the new referring_domain, landing_page
 and UTM values (none, in that case). The click ID and the UTM values on one
 lead can then come from different visits.
- A second ad click replaces the click ID group and the latest touch group.
- A direct landing (no click ID, no UTM value, no referring domain) changes
 nothing that is stored. When nothing is stored yet, it stores landing_page
 on its own.
- The same rules apply when consent comes later in the visit and the values
 held in memory are stored then.
- Every form carries both as hidden fields, empty unless consent was given.
- The site does not decide the channel. The CRM does, from utm_medium first
 and referring_domain second (docs/roadwren-brief.md, section 6).

Lead payload (the JSON body the /demo form posts to /api/lead)
- Always: form_id, first_name, last_name, email, company, fleet_size, plan
 (core, pro, enterprise or null).
- Always, because they record the choice itself and not the visitor's
 browsing: ad_user_data_consent, ad_personalization_consent (booleans from
 the banner state at submit time) and ad_consent_timestamp (ISO time of the
 choice, empty when no choice was made).
- Only after ad storage is granted, otherwise empty strings: the six click
 IDs, the five UTM values, ga_client_id, referring_domain, landing_page.
- A visitor who rejects is still a lead. The payload then carries the form
 fields, both consent booleans as false and the time of the rejection.

/api/lead
- Validates input, sends the lead to HubSpot using HUBSPOT_TOKEN from the
 environment, returns JSON. Never logs an email address.
- fleet_size must be one of the six bands. Anything else is a 400.
- A consent boolean that is missing counts as false. One that is present and
 not a boolean is a 400. ad_consent_timestamp must be empty or an ISO 8601
 time. referring_domain is lower-cased.
- HubSpot: empty fields are left out of the upsert, so a repeat lead cannot
 wipe a stored value. The three consent properties are written together, and
 only when the payload has a consent timestamp. A lead sent before any banner
 choice leaves the consent already on the contact alone.
- Nothing is sent to Salesforce from the site. That sync is a later build.

Tests
- Unit tests for the click ID parser and the consent gate.
- Unit tests for fleet size: each of the six bands validates, and a value
 that is not a band is rejected.
- Unit tests for the two groups: an ad click then a return from a search
 engine keeps the click ID and updates the latest touch group. A second ad
 click replaces the click IDs. An ad click then a direct landing changes
 nothing.
- Unit tests for the referrer and landing page: empty before consent and
 after a rejection, present after consent, and the site's own domain is
 never sent as a referrer.
- Unit tests for consent in the payload: both booleans and the timestamp are
 sent on the accept path and on the reject path.
- One browser test: open /demo?gclid=TEST123, accept consent, submit, and
 assert the generate_lead push and the /api/lead payload.
- One browser test for the reject path: reject, submit, and assert the
 payload has no click ID, referrer or landing page, and has both consent
 booleans as false with a timestamp.

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
