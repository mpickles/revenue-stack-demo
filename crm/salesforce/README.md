# Salesforce: lead to campaign, routing and the path back to ads

Status: in progress. The Salesforce account is a free Developer Edition. Every lead in it is made up.

## What this part does

1. The Roadwren demo form sends a lead into Salesforce with its fleet size, UTM values, click IDs, referring domain and consent choice. It goes through the Salesforce API, signed in as an integration user that can create and edit leads and nothing else. Web-to-Lead is not used, because it never tells the site whether a lead was saved. A repeat form fill updates the open lead with the same email.
2. No lead is ever blocked. A lead that does not fit is saved with a stage and a reason that say why.
3. Two record-triggered Flows judge the lead. One runs before the lead is saved and sets the fields on the lead. One runs after it is saved, sets the owner queue and adds the lead to its campaign. The fleet size rules are not typed into either Flow. They are six records of a custom metadata type, Fleet Band, that the Flows look up. Between them they set the lifecycle stage, the stage reason, the segment, the expected annual value, the Lead Source, the campaign and the owner queue.
4. Three validation rules guard what a person does by hand. `Stage_Reason_Required` stops a move to Nurture or Disqualified without a reason. `MQL_Needs_Fleet_Size` stops a lead being released to MQL with no fleet size or below the floor. `Convert_Only_From_SQL` stops a conversion from any stage but SQL. None of them can stop a form lead. A custom permission, Bypass Lead Automation, is the off switch for the rules and the Flows during a bulk load.
5. When a lead converts, the click IDs, UTM values and consent fields carry over to the opportunity.
6. A third Flow waits one day after a lead becomes MQL. If the lead is still MQL, it ticks Response Overdue and sends an alert.
7. A script writes the Google Ads conversion upload file for qualified leads and checks every row. It leaves out anyone without Ad User Data Consent.

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
| Campaign | Each channel is a parent campaign with no members. The lead joins the child campaign named as its utm_campaign value. A channel campaign is never matched, even when a utm_campaign has its name. With no utm_campaign it joins the channel's catch-all, such as "Direct - Other" |
| Stage reason | Required on Nurture and Disqualified |
| Owner | Set after the save, by the second Flow. Salesforce runs its own lead assignment after a before-save Flow and a Web-to-Lead lead always goes through it, so an owner set before the save would be overwritten. A lead a rep has taken is never pulled back to a queue |
| Free email release | A person sets the stage to MQL by hand. The first Flow clears the reason and the second sends the lead to its segment's queue. The free email check runs every time the first Flow judges the stage, on creation and on a Fleet Size change, unless the lead is already MQL. So a lead held for review stays held when the form is sent again, and a released lead is not sent back |

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

The brief's rule: the same person sending the form again is one lead, and the repeat is logged.

The form meets it in the site, not in Salesforce. Before it creates a lead, the site looks for a lead with the same email that is not converted. If it finds one it updates that lead with the latest values, adds 1 to Form Fill Count and stamps Latest Form Fill Date.

The Standard Lead Duplicate Rule has to be set to Allow, with Report ticked and Alert unticked, before the form is connected. As pulled on Nov 25 it still had Alert ticked, and through the API an alert refuses the lead. It matches on more than the email, so set to Block or Alert it could refuse a real second person who comes in through the API. With Allow and Report the lead is saved and the pair is listed under Duplicate Record Sets.

Not confirmed, and needing a real run:

- D01 and D02 through the Data Import Wizard, using "Add new and update existing records" matched on Email.
- What the wizard does with D02, which has the same email as T02 and a different name.

Until then D01 and D02 say "not confirmed, see Part M" and their other expected columns are blank. Record the outcome under Results, then fill in the two rows of the answer key.

Limit: a repeat is matched on the exact email. The same person using a second address becomes a second lead.

A Nurture lead who sends the form again is judged again by the first Flow, which watches Form Fill Count. A repeat only replaces a click ID or UTM value when the new form fill carries one. The upload dates the click from Latest Form Fill Date when there is one, and leaves out a conversion that happened before that click.

## The setup, saved as files

Fields, the validation rule, both Flows, their tests, the queues and the lead field mapping are pulled out of Salesforce as files with the Salesforce CLI, so the build can be read and compared without logging in.

One-time setup on Windows:

1. Install the Salesforce CLI from https://developer.salesforce.com/tools/salesforcecli (the Windows installer).
2. Open a new terminal and run `sf version` to check it works.

Then, from this folder (`crm/salesforce`):

```
sf org login web --alias roadwren-dev --set-default
sf project retrieve start --manifest manifest/package.xml
python strip_queue_members.py
```

The first command opens a browser to log in. The login is stored on the computer, outside this repo. The second command writes the files into `force-app/`. The third takes the queue members back out of the queue files. A pull writes them in as Salesforce usernames, this repo is public, and a username only exists in one account, so who sits in each queue is set by hand in each account. `python strip_queue_members.py --check` changes nothing and fails if a queue file still has members.

If the installer says it could not update PATH, add `C:\Program Files\sf\bin` to the user PATH by hand and open a new terminal. If the account is opened with a Google sign-in, the browser page still wants the Salesforce username and password.

`manifest/package.xml` lists what to pull: every custom field in [`fields.md`](fields.md), the three validation rules, the off switch permission and its permission set, the Flows and their tests, the queues, the duplicate rules, the lead field mapping, the Fleet Band type with its six records, and the campaign Type and Lead Source lists, which hold the channel names. A field's name is its label with underscores and `__c` on the end. The consent checkbox is `Ad_User_Data_Consent__c` on both the Lead and the Opportunity. If a name in your Salesforce account is different, edit the file to match. Campaigns are records, not setup, so the manifest does not pull them. Only their Type list comes across. The manifest was first run on Nov 25, 2026. It found one wrong name, the Lead's consent checkbox, which this file had as `Consent_Given__c`. Everything not built yet comes back as a "cannot be found" warning, and the rest still downloads.

## Flow tests

The Flows get saved tests, one per path, so a change can be re-checked in one click. These are the planned tests. None has been run.

| Test | Lead | Checks |
|---|---|---|
| MQL, enterprise | Fleet size 500-999, business email | Stage is MQL, segment is Enterprise, value is 114,000 |
| MQL, small business | Fleet size 20-49, business email | Stage is MQL, segment is Small Business |
| Below threshold | Fleet size 1-19 | Stage is Nurture, reason is "Below fleet threshold" |
| Free email | Fleet size 20-49, gmail address | Stage is New, reason is "Free email needs review" |
| No fleet size | Fleet size blank | Stage is New, no reason |
| Mixed case | utm_medium `CPC` | Lead Source is Paid Search |
| No UTM | Referring domain `gemini.google.com` | Lead Source is AI Search |

Limits of Flow tests, from Salesforce: up to 200 tests per flow, only paths that run immediately, and a test can only check the lead itself. So a test cannot confirm the campaign member was created. The owner is set after the save, so a test of the first Flow cannot see it either. Both are checked by the answer keys.

Run them from the terminal:

```
sf flow run test --target-org roadwren-dev --test-level RunLocalTests
```

## What the tests show, and what they do not

Roadwren, the test leads and the answer keys are all made up, and I made them. So a match between the build and the keys proves some things and not others.

What it shows:

- The build does what the written rules say. The rules are in the [company brief](../../docs/roadwren-brief.md). The keys are worked out from the brief by a script, before the Flows exist.
- Two separate builds of the same rules agree. A Python script writes the keys and a Salesforce Flow does the routing. A rule misread in one of them shows up as a row that does not match.
- The cases that break routing are covered: no fleet size, a free email address on a large fleet, a UTM medium in capitals, a mistyped medium, the same person twice.
- You can check it yourself. Read the brief, pick any test lead, predict its result, and compare it with the key.

What it does not show:

- That these are the right rules for a real company.
- That the build holds up on real, messy data at volume. The test files are a few dozen rows.
- Any business result. No revenue moved.

The rows that did not match on the first run, and what was done about each, go in Results below. They are the most useful part of this page.

## Three choices

- Fleet size over employee count as the one qualifying question. The price is per vehicle, so vehicles decide what a deal is worth.
- No lead is ever blocked. A lead that does not fit gets a stage and a reason, because a blocked web lead is never created and nobody can review it.
- The Salesforce setup is saved as files with the Salesforce CLI, not as screenshots. A reviewer can read the Flow and the rules, and a change shows up as a diff.

The full list, one line each, is in [`docs/decisions.md`](../../docs/decisions.md).

## Results

Nothing has been run yet. Added once the runs are done: how many leads matched each answer key, what happened to the repeat leads, and what broke.
