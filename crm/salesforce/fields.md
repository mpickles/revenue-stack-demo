# Salesforce custom fields

Every custom field this build uses, with the text to paste into Description and Help Text. The rules behind them are in [`docs/roadwren-brief.md`](../../docs/roadwren-brief.md).

Leave Required, Unique and External ID unticked on all of them. Text fields are length 255.

## Lead, already created

| Label | Type |
|---|---|
| UTM Source, UTM Medium, UTM Campaign | Text 255 |
| GCLID | Text 255 |
| Lead Email Copy | Text 255 |
| Consent Given | Checkbox. Relabel to Ad User Data Consent. Keep the API name `Consent_Given__c` |
| Lifecycle Stage | Picklist, restricted. Add the values Working and Nurture |

New text for Consent Given after the relabel:
- Description: Ticked when the visitor accepted the cookie banner, which covers sending their data to ad platforms. The conversion upload leaves out any lead where this is unticked. Never blocks a lead.
- Help Text: Did this person agree to their data being used for ads? Unticked means never send them to an ad platform.

## Lead, to create

| Label | Type | Description | Help Text |
|---|---|---|---|
| Fleet Size | Picklist: 1-19, 20-49, 50-199, 200-499, 500-999, 1,000+. No default, restricted | Number of vehicles, as chosen on the demo form. Decides segment, stage, queue and expected value. | How many vehicles the company runs. Blank means the lead did not come from the demo form. |
| Segment | Picklist: Below Threshold, Small Business, Mid-Market, Enterprise. No default, restricted | Set by the Lead Flow from Fleet Size. Do not edit by hand. | Sales segment, worked out from fleet size. |
| Expected Annual Value | Currency (16, 2) | Set by the Lead Flow: lowest fleet size in the band, times $19, times 12. Sent as the conversion value. | Lowest yearly value this deal could have. A planning number, not a quote. |
| Stage Reason | Picklist: Below fleet threshold, Not a fleet operator, Competitor, Student or personal, Spam or test, Duplicate, Existing customer, No response, No budget or timing, Free email needs review, Other. No default, restricted | Why the lead is in Nurture, Disqualified or held in New. Set by the Lead Flow or a rep. Required on Nurture and Disqualified. | Why this lead is not moving forward. |
| First MQL Date | Date/Time | Stamped by the Lead Flow the first time the stage becomes MQL. Never overwritten. | When this lead first qualified. |
| Latest MQL Date | Date/Time | Stamped by the Lead Flow every time the stage becomes MQL. Response time is measured from here. | When this lead most recently qualified. |
| MQL Count | Number (3, 0) | Raised by one by the Lead Flow each time the stage becomes MQL. | How many times this lead has qualified. |
| SQL Date | Date/Time | Stamped by the Lead Flow when the stage becomes SQL. | When a rep confirmed this lead. |
| Disqualified Date | Date/Time | Stamped by the Lead Flow when the stage becomes Disqualified. | When this lead was ruled out. |
| First Response Date | Date/Time | Stamped by the Lead Flow the first time the stage becomes Working. | When a rep first replied. |
| UTM Term | Text 255 | utm_term from the landing page URL. Set by the site form. | The keyword on the ad link, if any. |
| UTM Content | Text 255 | utm_content from the landing page URL. Set by the site form. | The ad or link variant, if any. |
| GBRAID | Text 255 | Google click ID used for some iPhone app-to-web ad clicks. Set by the site form. Do not edit by hand. | Google click ID for some iPhone ad clicks. |
| WBRAID | Text 255 | Google click ID used for some iPhone web ad clicks. Set by the site form. Do not edit by hand. | Google click ID for some iPhone ad clicks. |
| MSCLKID | Text 255 | Microsoft Advertising click ID. Set by the site form. Do not edit by hand. | Microsoft Ads click ID. |
| LI_FAT_ID | Text 255 | LinkedIn click ID. Set by the site form. Do not edit by hand. | LinkedIn Ads click ID. |
| Referring Domain | Text 255 | Domain of the page the visitor came from, such as www.google.com. Set by the site form. Blank for a direct visit. The Lead Flow reads it to pick the channel when there is no UTM. | The website this person came from. Blank means they came direct. |
| Landing Page | Text 255 | Path of the first page the visitor landed on, such as /pricing. Set by the site form. | The first page this person saw on the site. |
| Ad Personalization Consent | Checkbox, default unchecked | Ticked when the visitor accepted ad personalization on the cookie banner. Sent with the conversion upload. | Did this person agree to personalized ads? |
| Ad Consent Timestamp | Date/Time | When the visitor made their cookie banner choice. Set by the site form. | When consent was given or refused. |

Wait for the lead qualifier build: AI Fit Score, AI Score Status, AI Score Reason, AI Score Version.

## Opportunity, already created

UTM Source, UTM Medium, UTM Campaign, GCLID, Lead Email. All Text 255.

## Opportunity, to create

Each is filled once, at lead conversion, through Map Lead Fields. Use this Description on all of them, with the Lead field's name filled in: "Copied from the Lead's [field] at conversion by Map Lead Fields."

| Label | Type | Mapped from the Lead's | Help Text |
|---|---|---|---|
| UTM Term | Text 255 | UTM Term | The keyword on the ad link the original lead came in on. |
| UTM Content | Text 255 | UTM Content | The ad or link variant the original lead came in on. |
| GBRAID | Text 255 | GBRAID | Google click ID for some iPhone ad clicks. |
| WBRAID | Text 255 | WBRAID | Google click ID for some iPhone ad clicks. |
| MSCLKID | Text 255 | MSCLKID | Microsoft Ads click ID. |
| LI_FAT_ID | Text 255 | LI_FAT_ID | LinkedIn Ads click ID. |
| Ad User Data Consent | Checkbox, default unchecked | Ad User Data Consent (Consent Given) | Did the person who clicked agree to their data being used for ads? |
| Ad Personalization Consent | Checkbox, default unchecked | Ad Personalization Consent | Did the person who clicked agree to personalized ads? |
| Ad Consent Timestamp | Date/Time | Ad Consent Timestamp | When consent was given or refused. |
| Fleet Size | Text 255 | Fleet Size | Fleet size the lead gave on the demo form. |
| Segment | Text 255 | Segment | Sales segment of the original lead. |
| Expected Annual Value | Currency (16, 2) | Expected Annual Value | The planning value set on the lead. The real deal value goes in Amount. |
| First MQL Date | Date/Time | First MQL Date | When the original lead first qualified. |

Lifecycle Stage and Stage Reason are not copied. The deal has its own Stage.
