# Salesforce: lead to campaign, routing and the path back to ads

Status: in progress. The Salesforce account is a free Developer Edition. Every lead in it is made up.

## What this part does

1. The Roadwren demo form sends a lead into Salesforce with its fleet size, UTM values, click IDs, referring domain and consent choice.
2. No lead is ever blocked. A lead that does not fit is saved with a stage and a reason that say why.
3. Two record-triggered Flows judge the lead. One runs before the lead is saved and sets the fields on the lead. One runs after it is saved and adds the lead to its campaign. Between them they set the lifecycle stage, the stage reason, the segment, the expected annual value, the Lead Source, the campaign and the owner queue.
4. One validation rule, `Stage_Reason_Required`, stops a lead being moved to Nurture or Disqualified without a reason.
5. When a lead converts, the click IDs, UTM values and consent fields carry over to the opportunity.
6. A script writes the Google Ads conversion upload file for qualified leads and checks every row. It leaves out anyone without Ad User Data Consent.

The rules come from [`docs/roadwren-brief.md`](../../docs/roadwren-brief.md). The fields are listed in [`fields.md`](fields.md).

## The rules

The qualifying question is fleet size, in vehicles. The form offers six bands.

| Fleet size | Stage | Segment | Owner queue | Expected annual value |
|---|---|---|---|---|
| 1-19 | Nurture, reason "Below fleet threshold" | Below Threshold | Nurture Queue | blank |
| 20-49 | MQL | Small Business | Small Business Queue | $4,560 |
| 50-199 | MQL | Mid-Market | Mid-market Queue | $11,400 |
| 200-499 | MQL | Mid-Market | Mid-market Queue | $45,600 |
| 500-999 | MQL | Enterprise | Enterprise Queue | $114,000 |
| 1,000+ | MQL | Enterprise | Enterprise Queue | $228,000 |
| blank | New, no reason | blank | Needs Review Queue | blank |

| Rule | Logic |
|---|---|
| Free email | A gmail, yahoo, hotmail or outlook address with 20 or more vehicles is saved as New, reason "Free email needs review", in the Needs Review Queue. It keeps its segment and value. Capitals make no difference |
| Order | No fleet size is checked first, then under 20 vehicles, then free email. So a free email under 20 vehicles is Nurture, not New |
| Consent | Consent never changes the stage or the owner. It only decides whether the lead may be sent to an ad platform |
| Channel, with a UTM | utm_medium of cpc or ppc is Paid Search. paid_social is Paid Social. email is Email. referral is Referral. Any other value is Other. Upper and lower case are treated the same |
| Channel, no UTM | Read from the Referring Domain: a search engine is Organic Search, an AI assistant is AI Search, another website is Referral, blank is Direct |
| Lead Source | The channel is written to the standard Lead Source field |
| Campaign | Each channel is a parent campaign with no members. The lead joins the child campaign named as its utm_campaign value. With no utm_campaign it joins the channel's catch-all, such as "Direct - Other" |
| Stage reason | Required on Nurture and Disqualified |

## The answer keys

Two files. Each row states the result it should get: stage, stage reason, segment, expected annual value, Lead Source, campaign and owner queue. The build is graded against these files.

The expected columns are not typed by hand. [`make_answer_keys.py`](make_answer_keys.py) works them out from the rules in the brief. To change a test lead, edit its input columns and run the script again.

```
python crm/salesforce/make_answer_keys.py
python crm/salesforce/make_answer_keys.py --check
```

The first command rewrites both files. The second changes nothing and fails if a file no longer matches the rules.

| File | Rows | Expected "created" | Not confirmed | Load order |
|---|---|---|---|---|
| `test_leads.csv` | 25 | 25 | 0 | First |
| `test_leads_edge_cases.csv` | 12 | 10 | 2 | Second, after the first file is in |

The second file has to load after the first because two of its rows repeat leads from the first file.

Across the 35 rows with an expected outcome:

| Expected stage | Rows | | Expected owner queue | Rows |
|---|---|---|---|---|
| MQL | 24 | | Mid-market Queue | 16 |
| New | 9 | | Needs Review Queue | 9 |
| Nurture | 2 | | Small Business Queue | 5 |
| | | | Enterprise Queue | 3 |
| | | | Nurture Queue | 2 |

### Campaigns to create first

The keys expect these campaigns to exist in your Salesforce account before the leads are loaded. The eight parents hold no members. Set Type to the channel's name on each parent and its children, and a Status and Start Date on all of them. There is no campaign for the year: these campaigns are always on, and a period is a date filter on the report.

| Parent (channel) | Child campaigns |
|---|---|
| Paid Search | brand_search, fleet_tracking, competitor, maintenance_alerts, enterprise, Paid Search - Other |
| Paid Social | ops_leaders, safety_scores, Paid Social - Other |
| Email | october_issue, Email - Other |
| Referral | fleet_summit, Referral - Other |
| Organic Search | Organic Search - Other |
| AI Search | AI Search - Other |
| Direct | Direct - Other |
| Other | Other - Other |

### What the edge cases test

| Rows | Case | Expected |
|---|---|---|
| R01, R02 | No fleet size, with a UTM and without | New, no reason, Needs Review Queue. Segment and value are blank |
| R03 | No fleet size, no UTM, came from gemini.google.com | Channel AI Search. The AI assistant list is checked before the search engine list |
| R04 | Free email with no fleet size | New, no reason. The free email rule needs 20 or more vehicles, and a blank is not 20 or more |
| C01, C02 | utm_medium typed as `CPC` and `Paid_Social` | Same channel as lower case |
| C03 | utm_medium misspelled as `paidsocial` | Channel Other, so the typo shows. The lead still joins its real campaign, because a campaign is found by name |
| B01 | Free email at 20-49 vehicles, the lowest band the rule covers | New, reason "Free email needs review", Needs Review Queue |
| B02 | Free email at 1-19 vehicles | Nurture, reason "Below fleet threshold". The fleet size rule wins |
| B03 | Free email typed in capitals | Same as lower case |
| D01 | Same person as T01, sent again | Not confirmed, see below |
| D02 | Same email as T02 with a different name | Not confirmed, see below |

The first file covers the rest: every fleet band, consent refused with a click ID present (J01, J04), free email at 20 or more vehicles (J02, J03, J05), and a lead with no UTM from a search engine (T09), an AI assistant (T18), another website (J05) and nowhere (T10).

## Duplicates

The brief's rule: the same person sending the form again is one lead, and the repeat is logged. How Salesforce gets there is not confirmed. It is tested by hand in Part M of the build, the step for repeat leads. Until then D01 and D02 say "not confirmed, see Part M" and their other expected columns are blank. Nothing here claims an outcome.

What is known so far. Salesforce ships with a Standard Lead Duplicate Rule. Check it is active: Setup, search Duplicate Rules.

What Salesforce's own help page says about the form: when a duplicate rule is set to Block, or to Allow with an alert, a matching Web-to-Lead submission is blocked. The form cannot show the alert to anyone, so the lead is not created. That would lose the repeat, which breaks the rule that no lead is blocked. Salesforce's fix is a separate duplicate rule for the Web-to-Lead user set to Allow and Report, which creates the lead and logs the match. That gives two lead records, not one, so it does not meet the brief on its own either.

Not confirmed, and needing a real run:

- D01 through the Data Import Wizard. Other sources say an alert rule acts as a block on import and the row fails with a duplicate error.
- D02. Sources disagree on whether the standard rule matches on email alone.
- One repeat submit through the live form.

Record the outcome of all three under Results, then fill in the two rows of the answer key.

## The setup, saved as files

Fields, the validation rule, both Flows, their tests, the queues and the lead field mapping are pulled out of Salesforce as files with the Salesforce CLI, so the build can be read and compared without logging in.

One-time setup on Windows:

1. Install the Salesforce CLI from https://developer.salesforce.com/tools/salesforcecli (the Windows installer).
2. Open a new terminal and run `sf version` to check it works.

Then, from this folder (`crm/salesforce`):

```
sf org login web --alias roadwren-dev --set-default
sf project retrieve start --manifest manifest/package.xml
```

The first command opens a browser to log in. The login is stored on the computer, outside this repo. The second command writes the files into `force-app/`.

`manifest/package.xml` lists what to pull: every custom field in [`fields.md`](fields.md), the validation rule `Lead.Stage_Reason_Required`, the Flows and their tests, the queues, the duplicate rules, the lead field mapping and the campaign Type list, which holds the channel names. A field's name is its label with underscores and `__c` on the end. Two are different: the Lead's consent checkbox keeps its first name, `Consent_Given__c`, and the Opportunity's is `Ad_User_Data_Consent__c`. If a name in your Salesforce account is different, edit the file to match. Campaigns are records, not setup, so the manifest does not pull them. Only their Type list comes across. The manifest has not been run yet.

## Flow tests

The Flows get saved tests, one per path, so a change can be re-checked in one click. These are the planned tests. None has been run.

| Test | Lead | Checks |
|---|---|---|
| MQL, enterprise | Fleet size 500-999, business email | Stage is MQL, segment is Enterprise, value is 114,000, owner is the Enterprise Queue |
| MQL, small business | Fleet size 20-49, business email | Stage is MQL, segment is Small Business, owner is the Small Business Queue |
| Below threshold | Fleet size 1-19 | Stage is Nurture, reason is "Below fleet threshold", owner is the Nurture Queue |
| Free email | Fleet size 20-49, gmail address | Stage is New, reason is "Free email needs review", owner is the Needs Review Queue |
| No fleet size | Fleet size blank | Stage is New, no reason, owner is the Needs Review Queue |
| Mixed case | utm_medium `CPC` | Lead Source is Paid Search |
| No UTM | Referring domain `gemini.google.com` | Lead Source is AI Search |

Limits of Flow tests, from Salesforce: up to 200 tests per flow, only paths that run immediately, and a test can only check the lead itself. So a test cannot confirm the campaign member was created. That part is checked by the answer keys.

Run them from the terminal:

```
sf flow run test --target-org roadwren-dev --test-level RunLocalTests
```

## Three choices

- Fleet size over employee count as the one qualifying question. The price is per vehicle, so vehicles decide what a deal is worth.
- No lead is ever blocked. A lead that does not fit gets a stage and a reason, because a blocked web lead is never created and nobody can review it.
- The Salesforce setup is saved as files with the Salesforce CLI, not as screenshots. A reviewer can read the Flow and the rules, and a change shows up as a diff.

The full list, one line each, is in [`docs/decisions.md`](../../docs/decisions.md).

## Results

Nothing has been run yet. Added once the runs are done: how many leads matched each answer key, what happened to the repeat leads, and what broke.
