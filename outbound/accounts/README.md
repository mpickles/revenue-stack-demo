# Account list: the right companies found, enriched and scored in Clay

Status: planned. Nothing in this folder is built yet. This page says what it will do and how it will be graded.

A written definition of who Roadwren sells to, a list of real companies that fit it, the missing details filled in from several data sources, and a score that sorts them into tiers. It is for a team that wants outbound to start from a list it can defend, not from whoever was easy to find.

## What it will do

1. Write the ideal customer on one page: who buys, who does not, and three things that rule a company out. It comes from `docs/roadwren-brief.md`.
2. Find about 150 real companies that fit, in Clay.
3. Fill in three fields with a waterfall: try the cheapest source first and stop at the first answer.
4. Score each company with a formula whose weights are written down, then sort into tiers A, B and C.
5. Find two or three people at each Tier A company by a written title rule, with a verified work email.
6. Load the Tier A companies and people into Salesforce through an n8n workflow, matched on website domain so nothing is created twice.
7. Write down what each company and each usable contact cost in credits.

## How it will be graded

| Check | Pass bar |
|---|---|
| 30 companies labeled by hand before the score is written | The score's tier matches the hand label on at least 24 of 30. Each miss is listed with the reason |
| Fill rate for each of the three fields | Stated for each source and for the waterfall as a whole |
| Tier A contacts | Each has a verified email, or is left out and counted |
| A second run of the Salesforce load | Creates nothing and changes nothing |
| Cost | Credits per company and per usable contact are stated |

## Planned files

- `icp.md`: the one-page definition
- `score.md`: the formula, the weights and why
- `labels.csv`: the 30 hand labels, with company names replaced by an ID
- `n8n/accounts_to_salesforce.json`: the exported workflow
- `results.md`: counts, fill rates and cost

## Choices already made

- This repo holds no real company names. The list itself lives in Clay and in the practice Salesforce account. The repo holds the rules, the workflow and the counts.
- Clay's free plan allows 200 rows a table and has no Salesforce connection, so the load goes through a sheet export and n8n.
- The hand labels are written before the score, so the score is checked against a judgment it could not have been tuned to.
