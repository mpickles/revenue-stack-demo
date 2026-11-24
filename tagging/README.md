# Tracked site: consent, click IDs and one conversion event

Status: in progress. The site code is live at https://roadwren-demo.vercel.app. The Tag Manager setup, the HubSpot account and the test runs are not done yet.

A B2B demo site that only stores a click ID after the visitor accepts, and carries it through the form into the CRM. It is for a marketing team that needs to prove its tracking respects consent and still closes the loop.

## What works today

1. All four consent signals are set to denied before the Tag Manager container loads.
2. On landing, the site reads gclid, gbraid, wbraid, fbclid, li_fat_id, msclkid and the five UTM values. Before consent they are held in memory only. After Accept they are stored in a first-party cookie.
3. Every form carries hidden fields for the click IDs, the UTM values and the GA client ID. They are filled at submit time and stay empty unless consent was given.
4. A successful submit pushes one `generate_lead` event.
5. The lead API checks the input and creates or updates a HubSpot contact. It never logs an email address.

The site code is in [`site/`](../site). The spec it was built from is [`docs/spec-site.md`](../docs/spec-site.md).

## What is left

- Tag Manager: a Google tag, three data layer variables, the `generate_lead` trigger and a GA4 event tag. Then the container is exported into this folder as `container.json`.
- GA4: `generate_lead` marked as a key event.
- HubSpot: a free account, the contact properties in [`docs/hubspot-properties.md`](../docs/hubspot-properties.md) and a service key.
- The test runs in the table below, written down with what did not match.

## How it will be graded

| Run | Passes when |
|---|---|
| Reject | No `_ga` cookie and no stored click ID. Requests to Google carry `gcs=G100` |
| Accept | `generate_lead` shows in GA4. The HubSpot contact has the click ID and both UTM values. Requests carry `gcs=G111` |
| Withdraw | After accepting and then rejecting, the stored click ID is gone |
| Returning visitor | A saved Accept is applied before the container loads |
| iPhone click | A landing with gbraid and no gclid stores the gbraid |
| Repeat submit | The same email sent twice is one contact, and the first click ID is still on it |

## Three choices

- Advanced consent mode over basic. Google tags load with every signal denied and send requests with no cookies, so Google can model conversions from visitors who reject. A company whose legal team wants nothing sent before consent would pick basic.
- Last touch over first touch for click IDs. The most recent ad click is the one an ad platform will match an offline conversion to.
- Click IDs are held in memory before consent, not in browser storage. Browser storage is storage too and needs the same consent.

The full list, one line each, is in [`docs/decisions.md`](../docs/decisions.md).

## Tests

Nine unit test files and three browser tests are in [`site/tests/`](../site/tests). GitHub runs the type check and the unit tests on every pull request that touches the site.

## Limits

- No ad account is connected. Nothing here proves a live import into Google Ads.
- The `gcs` codes come from consent tool guides, not from a Google page.
- One made-up company. A real site has more forms, more tags and older code.

## About the data

The systems are real and running. Every person, company and lead is made up.
