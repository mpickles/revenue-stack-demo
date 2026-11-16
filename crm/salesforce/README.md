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
| Campaign | utm_medium of cpc or ppc goes to Paid Search. paid_social goes to Paid Social. Anything else goes to Organic and Direct |
| Owner | 200 or more employees goes to the Enterprise Queue. 50 to 199 goes to the Mid-market Queue. Under 50 goes to the Small Business Queue |
| Blocked: no consent | A lead with Consent Given unchecked is rejected |
| Blocked: free email | A lead from a company of 200 or more employees using a gmail, yahoo, hotmail or outlook address is rejected |

## The answer key

`test_leads.csv` holds 25 test leads: 20 that should be created and 5 that should be blocked. Each row states the result it should get: lifecycle stage, campaign, owner queue, or the reason it is blocked. The build is graded against this file.

Results get added here once the run is done: leads routed, how many matched the answer key, and what broke.
