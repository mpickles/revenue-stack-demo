# Campaign QA agent: checks landing pages before a campaign goes live

Status: planned. Nothing in this folder is built yet. This page says what it will do and how it will be graded.

A Python tool that takes a campaign brief and checks every landing page in it for tags, consent, the conversion event and UTM values. It is for a marketing team that wants a go or no-go answer before spend starts.

## What it will do

1. Read a brief: one row per landing page, with the UTM values the page should carry.
2. Open each page in a real browser and run fixed checks. The container is present. Consent defaults are set before the container loads. The hidden fields hold the click ID after Accept. The UTM values match the naming rule. A redirect does not drop the click ID.
3. Watch the network requests. After a form submit, exactly one request carries `generate_lead`, with the right consent code.
4. Write a findings file: one row per page per check, with pass, fail or could not check, and the evidence.
5. Have Claude write the go or no-go report from the findings file only.
6. Compare every finding in the report to the findings file. A report that states anything else is thrown away.

## How it will be graded

| Check | Pass bar |
|---|---|
| 14 pages with one planted bug each | 13 or more caught |
| 8 clean pages | 0 false alarms |
| Report step, run three times on each findings file | 3 of 3 runs state nothing that is not in the file |
| A page that will not load | Reported as could not check. Never counted as a pass |
| A no-go run | The command exits with code 1 |

Both numbers will be shown: of the bugs planted, how many were caught, and of the alarms raised, how many were real. A miss stays in the table.

## Planned files

- `check_pages.py`: the page checks
- `utm_rules.py`: the UTM naming check, written by hand
- `report.py`: the Claude call, with a fixed output format
- `eval/broken_pages.csv`: the planted bugs and the expected finding for each
- `runs.csv`: one row per run with model, prompt version, tokens, cost and seconds
- `tests/`

## One choice already made

The checks are plain code. Only the wording of the report is Claude. A check must give the same answer every time. Page text is never sent to the model, so a page cannot give it orders.

## Limits

- It checks pages on the Roadwren demo site. Real sites have more tags, more consent tools and more ways to break.
- The planted bugs are ones I chose. It is not proof against bugs nobody planted.

## About the data

The pages are real pages on a made-up company's site. Every bug is planted on purpose and listed in the answer key.
