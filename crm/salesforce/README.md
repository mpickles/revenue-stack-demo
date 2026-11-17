# Salesforce: lead to campaign, routing and the path back to ads

Status: in progress. The Salesforce account is a free Developer Edition. Every lead in it is made up.

## What this part does

1. The Roadwren demo form sends a lead into Salesforce with its UTM values, click ID and consent choice.
2. Two validation rules block leads that should not get in.
3. One record-triggered Flow sets the lifecycle stage, adds the lead to the right campaign and assigns it to a queue.
4. When a lead converts, the click ID and UTM values carry over to the opportunity.
5. A script writes the Google Ads conversion upload file for qualified leads and checks every row.

## The rules

| Rule | Logic |
|---|---|
| Lifecycle stage | 50 or more employees with consent given is MQL. Everything else is New |
| Campaign | utm_medium of cpc or ppc goes to Paid Search. paid_social goes to Paid Social. Anything else goes to Organic and Direct. Upper and lower case are treated the same |
| Owner | 200 or more employees goes to the Enterprise Queue. 50 to 199 goes to the Mid-market Queue. 1 to 49 goes to the Small Business Queue |
| Owner, size unknown | No employee count, or a count of 0, goes to the Needs Review Queue. An unknown size is not a small company |
| Blocked: no consent | A lead with Consent Given unchecked is rejected |
| Blocked: free email | A lead from a company of 200 or more employees using a gmail, yahoo, hotmail or outlook address is rejected |

## The answer keys

Two files. Each row states the result it should get: lifecycle stage, campaign, owner queue, or the reason it is blocked. The build is graded against these files.

| File | Rows | Should be created | Should be blocked | Load order |
|---|---|---|---|---|
| `test_leads.csv` | 25 | 20 | 5 | First |
| `test_leads_edge_cases.csv` | 12 | 9 | 3 | Second, after the first file is in |

The second file has to load after the first because two of its rows repeat leads from the first file.

### What the edge cases test

| Rows | Case | Expected |
|---|---|---|
| R01, R02 | No employee count | Created as New, sent to the Needs Review Queue |
| R03 | Employee count of 0 | Same as no count |
| R04 | Free email with no employee count | Created. The free email rule only applies at 200 or more, and a blank count is not 200 or more |
| C01, C02 | utm_medium typed as `CPC` and `Paid_Social` | Routed the same as lower case |
| C03 | utm_medium misspelled as `paidsocial` | Falls to Organic and Direct. This is a known limit: the Flow cannot guess a typo. The campaign QA agent (Build 2) is the guard for it |
| B01, B02 | Free email at exactly 200 and at 199 employees | 200 is blocked, 199 is created |
| B03 | Free email typed in capitals | Blocked. The rule lowercases the address first |
| D01 | Same person as T01, sent again | Blocked as a duplicate |
| D02 | Same email as T02 with a different name | Not confirmed, see below |

## Duplicates

Salesforce ships with a Standard Lead Duplicate Rule. Check it is active: Setup, search Duplicate Rules.

What Salesforce's own help page says about the form: when a duplicate rule is set to Block, or to Allow with an alert, a matching Web-to-Lead submission is blocked. The form cannot show the alert to anyone, so the lead is not created. That means the same person sending the Roadwren form twice can lose the second lead. Salesforce's fix is a separate duplicate rule for the Web-to-Lead user set to Allow and Report, which creates the lead and logs the match.

Two things are not confirmed from Salesforce's own pages and need a real run:

- D01 through the Data Import Wizard. Other sources say an alert rule acts as a block on import and the row fails with a duplicate error. Expected: blocked.
- D02. Sources disagree on whether the standard rule matches on email alone. Expected here: created. If it is blocked instead, write that down as the result.

Record the outcome of both rows, and of one repeat submit through the live form, under Results.

## The setup, saved as files

Fields, validation rules, the Flow, its tests, the queues and the lead field mapping are pulled out of Salesforce as files with the Salesforce CLI, so the build can be read and compared without logging in.

One-time setup on Windows:

1. Install the Salesforce CLI from https://developer.salesforce.com/tools/salesforcecli (the Windows installer).
2. Open a new terminal and run `sf version` to check it works.

Then, from this folder (`crm/salesforce`):

```
sf org login web --alias roadwren-dev --set-default
sf project retrieve start --manifest manifest/package.xml
```

The first command opens a browser to log in. The login is stored on the computer, outside this repo. The second command writes the files into `force-app/`.

`manifest/package.xml` lists what to pull. The field names in it are the ones this build uses. If a name in Salesforce is different, edit the file to match. The manifest has not been run yet.

## Flow tests

The Flow has saved tests, one per path, so a change to the Flow can be re-checked in one click.

| Test | Lead | Checks |
|---|---|---|
| MQL, enterprise | 340 employees, consent given | Lifecycle Stage is MQL, owner is the Enterprise Queue |
| New, small | 18 employees | Lifecycle Stage is New, owner is the Small Business Queue |
| Size unknown | No employee count | Owner is the Needs Review Queue |
| Mixed case | utm_medium `CPC` | Follows the Paid Search path |

Limits of Flow tests, from Salesforce: up to 200 tests per flow, only paths that run immediately, and a test can only check the lead itself. So a test cannot confirm the campaign member was created. That part is checked by the answer keys.

Run them from the terminal:

```
sf flow run test --target-org roadwren-dev --test-level RunLocalTests
```

## Three choices

- A Needs Review Queue for leads with no employee count, over letting them fall into Small Business. An unknown size is not a small company, and a wrong owner costs more than a short wait.
- UTM medium is lowercased inside the Flow, not only on the site. Imports and other forms create leads too.
- The Salesforce setup is saved as files with the Salesforce CLI, not as screenshots. A reviewer can read the Flow and the rules, and a change shows up as a diff.

The full list, one line each, is in [`docs/decisions.md`](../../docs/decisions.md).

## Results

Added once the runs are done: leads routed, how many matched each answer key, what happened to the duplicates, and what broke.
