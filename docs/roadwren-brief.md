# Roadwren company brief

Version 4, November 25, 2026. Roadwren is made up. This page is the one place that says who it sells to and how a lead is judged. Every build in this repo reads its rules from here. If a rule changes, it changes here first, then in the build.

Review it whenever a threshold, a stage or a channel name changes, and bump the version.

## 1. The company

| | |
|---|---|
| What it sells | Fleet telematics software: live vehicle location, driver safety scores, maintenance alerts |
| Pricing | Core $19 per vehicle a month. Pro $29 per vehicle a month. Enterprise is custom |
| How it sells | A demo request form on the site, then a sales conversation. No free signup |
| Systems | The site, Tag Manager and GA4, HubSpot for marketing contacts, Salesforce for leads and deals |

## 2. Who it sells to

**Ideal customer:** US companies that run 20 to 2,000 light and medium duty vehicles for delivery or field service work. Last-mile delivery, distribution, HVAC, plumbing, electrical, landscaping, pest control.

**Buyers:** the fleet manager or operations lead. At smaller fleets, the owner.

**Not a customer for the sales team:**

| Who | Why | What happens |
|---|---|---|
| Fleets under 20 vehicles | Too small for a sales conversation at these prices | Saved, never blocked. Stage Nurture, reason "Below fleet threshold" |
| Long-haul trucking that mainly needs hours-of-service compliance | Roadwren has no such product | Disqualified, reason "Other" |
| Students, personal use, competitors, spam | No deal possible | Disqualified with the matching reason |

The 20-vehicle floor is a choice. Real vendors in this market start sales conversations lower, at about 10 vehicles. Twenty keeps the made-up sales team small.

## 3. The one qualifying question

The demo form asks **fleet size, in vehicles**. It does not ask employee count.

Why: the price is per vehicle, so vehicles decide what a deal is worth. Real fleet software vendors ask this question on their demo forms and define their sales segments with it.

| Fleet size on the form | Segment | Goes to | Expected annual value |
|---|---|---|---|
| 1-19 | Below Threshold | Nurture Queue | blank |
| 20-49 | Small Business | Small Business Queue | $4,560 |
| 50-199 | Mid-Market | Mid-market Queue | $11,400 |
| 200-499 | Mid-Market | Mid-market Queue | $45,600 |
| 500-999 | Enterprise | Enterprise Queue | $114,000 |
| 1,000+ | Enterprise | Enterprise Queue | $228,000, treated as custom priced |
| blank (imports, other forms) | blank | Needs Review Queue | blank |

**Expected annual value** is the lowest fleet size in the band, times $19, times 12. It is the lowest the deal could be, on the cheapest plan. The midpoint of the band is the other defensible rule. The floor was chosen because a value that is too low is safer to bid on than one that is too high.

In Salesforce this table is six records of a custom metadata type, Fleet Band, one for each fleet size on the form. The Flows look a lead's band up there. A threshold, a queue or a value is changed in a record, not in a Flow.

Employee count stays as Salesforce's standard field. Nothing on the form fills it. An enrichment step can.

## 4. Lead stages

One custom field on the Lead, Lifecycle Stage, holds marketing's view of the lead. The standard Lead Status field is left to the rep as a follow-up worklist. The two are never mixed.

| Stage | Means | Who sets it | How a lead gets in | How it leaves |
|---|---|---|---|---|
| New | Saved, not yet judged, or missing what is needed to judge it | The Flow | No fleet size, or a free email address that needs a look | A person fills the gap, then MQL, Nurture or Disqualified |
| MQL | Asked for a demo, runs 20 or more vehicles, used a business email | The Flow, or a person releasing a lead from review | All three are true when the lead is created or updated | A rep picks it up: Working |
| Working | A rep owns it and has replied | The rep | The rep takes it from the queue and makes first contact | SQL, Nurture or Disqualified |
| SQL | A rep confirmed it on a call | The rep | All of: runs 20 or more vehicles, has a problem Roadwren solves, agreed to a next step | Converted to an opportunity |
| Nurture | Real, but not now or too small | The Flow or the rep | Under 20 vehicles, or the rep found no timing or budget. A reason is required | Comes back as MQL if they ask again and now fit |
| Disqualified | Will never be a customer | The rep | A reason is required | Does not leave |

Every form lead is a demo request, which is the strongest signal of interest there is. So the MQL rule is "asked for a demo and fits", not a score.

A Nurture lead who sends the demo form again is judged again, even when the fleet size is the same. The Flow sees Form Fill Count go up and runs the stage rules. A lead held in New for a free email address stays held, because the free email check runs on every judgment.

A lead is converted to an opportunity only from SQL. A rule refuses the conversion from any other stage, so every deal has passed through Working and SQL and has both dates.

**Reasons** (required on Nurture and Disqualified, and set by the Flow on New when it applies): Below fleet threshold, Not a fleet operator, Competitor, Student or personal, Spam or test, Duplicate, Existing customer, No response, No budget or timing, Free email needs review, Other.

**Dates the Flow stamps:** First MQL Date (never overwritten), Latest MQL Date, MQL Count, SQL Date, Disqualified Date, First Response Date (when the stage first becomes Working).

**Response target:** a rep replies to an MQL within one business day. It is measured from Latest MQL Date to First Response Date. A lead still in MQL one day after its Latest MQL Date gets Response Overdue ticked and an alert is sent. The tick is never removed, so it stays as a record of the miss.

## 5. Rules for odd cases

| Case | Rule | Why |
|---|---|---|
| Free email address (gmail, yahoo, hotmail, outlook) with 20 or more vehicles | Saved. Stage New, reason "Free email needs review", Needs Review Queue. A person who decides the lead is real sets the stage to MQL by hand. The Flow then clears the reason and sends the lead to its segment's queue | Small fleet owners often use personal email. Blocking would lose real buyers, and a blocked web lead is never created at all |
| The visitor rejected cookies | Saved and judged like any other lead. Click IDs and UTM values are blank. Never sent to an ad platform | Cookie consent is permission to track and to share data for ads. It is not permission to be a lead |
| The same person sends the form again | One lead. The repeat is logged, not saved as a second lead. Before it creates a lead, the site looks for one with the same email that is not converted. If it finds one it updates that lead with the latest values, adds 1 to Form Fill Count and stamps Latest Form Fill Date. A click ID or UTM value is only replaced when the new form fill carries one | Two records for one person split their history |
| Someone at a company that is already a customer | Saved and judged like any other lead. The person who spots it sets the stage to New with the reason "Existing customer". The Flow then moves it to the Needs Review Queue | Their account owner should answer, not a new-business rep. In New it is not counted against the response target. Nothing detects this automatically yet |
| UTM medium that matches no channel | Channel "Other" | A typo should be visible, not hidden inside a real channel |
| Free email address with under 20 vehicles | The fleet size rule wins. Stage Nurture, reason "Below fleet threshold", Nurture Queue | The lead is too small whatever its email address, so nobody needs to review it |
| Free email address with no fleet size | Stage New, Needs Review Queue, no reason | The free email rule needs 20 or more vehicles, and a blank is not 20 or more. The lead is already waiting for a person |
| No fleet size | Stage New, Needs Review Queue, no reason | The reason list has none for a missing answer, and the blank field says it already |

When more than one rule applies, the order is: no fleet size first, then under 20 vehicles, then a free email address. A free email address is one that ends in @gmail.com, @yahoo.com, @hotmail.com or @outlook.com, compared in lower case.

The free email check runs every time the Flow judges the stage: when the lead is created, and when its Fleet Size changes. The one exception is a lead that is already MQL. A free email lead can only be MQL because a person released it, so correcting its Fleet Size does not send it back to review. A lead still held in New stays held when the same person sends the form again with a different fleet size, because the site made that change and nobody has looked at the lead yet.

Segment and expected annual value follow fleet size whatever the stage. A free email lead held in New still has both.

## 6. Channels

One list, used by the Salesforce Flow, the campaign QA tool and the funnel model.

| Channel | A lead is in it when |
|---|---|
| Paid Search | utm_medium is cpc or ppc |
| Paid Social | utm_medium is paid_social |
| Email | utm_medium is email |
| Referral | utm_medium is referral, or there is no UTM and the visitor came from another website |
| Organic Search | no UTM, and the visitor came from a search engine |
| AI Search | no UTM, and the visitor came from an AI assistant's site |
| Direct | no UTM and no referring site |
| Other | a utm_medium that is none of the above |

UTM values are compared in lower case. "No UTM" means utm_medium is blank. The channel is read from utm_medium alone, so a lead with a utm_source and no utm_medium is judged by where it came from. When there is a utm_medium, it decides the channel and the Referring Domain is ignored.

Where the visitor came from is the Referring Domain field on the lead. The site form fills it with the domain of the page the visitor came from, and leaves it blank for a direct visit. It is compared in lower case. It only decides the channel when there is no UTM.

| Referring Domain | Counts as |
|---|---|
| Is one of chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com or claude.ai, or ends with a dot and one of them | An AI assistant |
| Has google, bing, duckduckgo, yahoo, ecosia or brave as one whole part between dots, as in www.google.com or search.brave.com | A search engine |
| Anything else that is not blank | Another website |
| Blank | No referring site |

The AI assistant list is checked first, because gemini.google.com also has google in it.

The channel is written to the standard Lead Source field. In Salesforce the campaigns sit in two levels. Each channel is a parent campaign that holds no members. Under it sits one campaign per marketing effort, named exactly as its utm_campaign value, plus one catch-all per channel for leads whose utm_campaign matches nothing. A lead is added to one campaign, once, with the status Responded.

Every campaign has a Type, a Status and a Start Date. The Type of a channel campaign and of the campaigns under it is the channel's name, so a report can group by channel without the hierarchy. Cost fields are left blank until ad spend is loaded in the warehouse build.

The campaigns are always on. There is no level for the year and no new set each January, because an ad campaign keeps its utm_campaign value across years and the Flow finds a campaign by that name. A question about a period is answered with a date filter on the report, using the date the lead joined the campaign. A one-off effort, such as a single newsletter issue, has an End Date.

The catch-all is named after its channel and the word Other, as in "Paid Search - Other". A campaign is found by its name alone, using the utm_campaign value in lower case. Only a campaign that has a parent can be found this way, so a utm_campaign of email or direct never puts a lead on a channel campaign. It goes to the catch-all. So a lead with a mistyped utm_medium still lands in its real campaign, while its Lead Source says Other. A lead with no utm_campaign goes to its channel's catch-all.

## 7. Consent

| Field | Means | Used for |
|---|---|---|
| Ad User Data Consent | The visitor accepted the banner, which covers sending their data to ad platforms | The conversion upload leaves out anyone without it |
| Ad Personalization Consent | The visitor accepted ad personalization | Sent with the upload |
| Ad Consent Timestamp | When the choice was made | Proof, and handling a later change of mind |

All three travel with the click IDs onto the opportunity when a lead converts.

## 8. Conversions sent back to ad platforms

| Conversion | When | Role |
|---|---|---|
| Qualified lead | Stage becomes MQL | Primary. It is frequent and close to the click, so bidding can learn from it |
| Closed deal | The opportunity is won | Secondary. For reporting only. It is too rare and too late to bid on |

The qualified lead's value is its expected annual value. A row is only written inside the upload window: 63 days from the click when matching on a hashed email, 90 days when matching on a click ID alone.

The click is dated from the lead's Created Date. When a lead has sent the form more than once, it is dated from Latest Form Fill Date, because the click ID on the lead is then the latest one. A conversion that happened before that click is not written.

## 9. Who may write what

| Writer | May write | Never writes |
|---|---|---|
| The site form, through the Salesforce API as the integration user | Name, email, company, fleet size, Referring Domain, Landing Page, UTM values, click IDs, the three consent fields, Form Fill Count, Latest Form Fill Date | Stage, segment, owner |
| The Salesforce Flow | Lifecycle Stage, Stage Reason, Segment, Expected Annual Value, Lead Source, the stage dates, Response Overdue, Lead Email Copy, Owner (a queue) | The AI score fields |
| A rep | Stage (Working, SQL, Nurture, Disqualified, MQL only to release a lead held in New, and New only to hand an existing customer to review), Stage Reason, Owner (a person), Lead Status | The click ID, UTM and consent fields |
| The AI lead qualifier | Its own four score fields. It may move the owner off a queue | Lifecycle Stage. A field a person edited |

## 10. Known limits

- One set of UTM and click ID fields per lead: the latest values. A larger setup keeps first touch and latest touch apart.
- MQL is a rule, not a score. There is no behavior scoring because the only thing a visitor can do is ask for a demo.
- No lookup of whether a lead's company is already an account. The "Existing customer" reason is set by a person.
- Expected annual value uses the bottom of the band and the cheapest plan.
- A repeat is matched on the exact email. The same person using a second address becomes a second lead, and only the duplicate report catches it.
- A lead joins a campaign once, when it is created. After a repeat form fill from a different ad, UTM Campaign shows the new campaign and Campaign History still shows the first.
- A visitor who rejects cookies sends no UTM values and no referring domain, so the lead's channel is Direct even when it came from an ad.
- Form Fill Count is raised by the site only. A repeat that arrives through an import does not raise it.
- The site writes each lead to HubSpot and to Salesforce separately. A larger setup would sync the two.
- Every user can see and edit every lead until lead sharing is set to Private, which is done last, with made-up users to test it.
- The response alert counts one day as 24 hours by the clock, weekends included. The target itself is one business day.
- The 20-vehicle floor and the 500-vehicle Enterprise line are choices. Real vendors draw both lines in different places.
