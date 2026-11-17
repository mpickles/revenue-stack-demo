# Lead qualifier: scores a new lead, routes it, and asks a person when unsure

Status: planned. Nothing in this folder is built yet. This page says what it will do and how it will be graded.

A small Python service that picks up each new lead in Salesforce, fills in missing company facts, has Claude score it against a written rubric and gives strong leads an owner. It is for a sales team that wants fast routing without an AI writing to the CRM unchecked.

## What it will do

1. Notice a new lead in the Salesforce account from the [routing build](../../crm/salesforce).
2. Fill in missing company facts from three made-up data vendors, cheapest first, under a cost cap per lead.
3. Read the company website and have Claude score fit against a written rubric. The reply always has a score, a reason and a confidence.
4. Write the score and reason back to the lead. It writes only to its own fields.
5. Give a confident strong lead an owner and post one message to Slack.
6. Put an unsure lead on an approval screen, where a person approves or rejects the proposed owner.
7. Log every decision with its cost.

A small MCP server lets a person look up a lead, read why it got its score, or re-route it from Claude.

## How it will be graded

| Check | Pass bar |
|---|---|
| 36 leads labeled by hand | Agreement of 80 percent or more, shown by label |
| The same set, run three times | The number of leads that got the same band all three times is reported |
| Six leads with no website, a dead site or a thin site | All six go to a person. None is routed |
| Three pages with planted text that tries to give the agent orders | Each gets the same score band as its clean copy |
| A field changed by hand, then a second run | The hand edit is kept |
| A second run on the same leads | Nothing is written |
| A run stopped halfway and restarted | Every lead is scored exactly once |
| A re-route call without a confirm | Nothing changes in Salesforce |
| Enrichment | Average cost under 4 cents a lead |

## Planned files

- `rubric.md`: the written rubric
- `score.py`, `enrich.py`, `vendors.py`
- `salesforce.py`: read and write. It never overwrites a field a person edited
- `mcp_server.py`: look up, explain, re-route
- `eval/golden.csv`: the hand labels
- `eval/impact.sql`: the system's own results, from its log
- A runbook: how to run it and what to do when it fails

## Choices already made

- A person's edit always wins. The agent logs every value it writes. Before it writes again it compares the field to the last value it logged. If they differ, a person changed it, and the agent leaves that field alone.
- The agent may only change the owner while the owner is still one of the routing queues. If a person owns the lead, it stays theirs.
- Website text reaches the model as untrusted data, and the fixed output format limits what can come back.
- An off switch, a dry run and a daily spend cap exist before the first live write.

## Limits

- The data vendors are made up, because real ones return nothing for made-up companies. The order of sources and the cost cap are real. The data is not.
- It asks Salesforce for new leads every 15 seconds. At real volume Salesforce would push changes instead.
- 36 labels from one person is a small test set.

## About the data

The systems are real. Every lead and company is made up.
