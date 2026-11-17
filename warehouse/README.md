# Funnel in SQL, and a reporting agent that cannot misquote

Status: planned. Nothing in this folder is built yet. This page says what it will do and how it will be graded.

Roadwren's leads, opportunities and ad spend modeled in SQL, plus a weekly summary written by Claude where code checks every number before anything is published. It is for a marketing lead who needs to trust a report they did not write.

## What it will do

1. Generate made-up leads, opportunities and daily ad spend from a fixed seed, so every run gives the same data.
2. Pull the real test leads out of Salesforce as files and load them next to the made-up data.
3. Model the funnel by source, and credit by channel under first touch and last touch, in dbt on DuckDB.
4. Hand Claude a block of figures taken from the SQL output and ask for a weekly summary.
5. Check every number in the summary against the figures block. One number that is not there and nothing is published.
6. Push one field, a segment worked out in SQL, back onto the lead in Salesforce.

## How it will be graded

| Check | Pass bar |
|---|---|
| Funnel | Every lead is counted once |
| Attribution | Each model hands out exactly 100 percent of opportunities |
| Five funnel edge cases, as unit tests | All pass. Each is three to six rows that can be read aloud |
| Three planted failures: a wrong number, a number only in the notes, no figures block | All three are rejected |
| Number check on rounding, formats and numbers that are not metrics | Each case has a test and a written rule |
| Score check | One query shows conversion by score band and names the group where the score misleads |
| Salesforce in | The lead count in the warehouse matches Salesforce |
| Salesforce out | The segment shows on the lead. A second run changes nothing |
| Two made-up A/B tests | The first is called a real win. The second is called cannot tell yet |

## Planned files

- [`pipelines/synthetic/`](../pipelines/synthetic): `make_data.py`
- `models/`: staging, funnel, attribution. The funnel model is written by hand
- `tests/assert_attribution_reconciles.sql`
- [`agents/analyst/`](../agents/analyst): `summary.py`, `verify_numbers.py` and their tests

## One choice already made

dbt Core with DuckDB on my own machine, not a hosted warehouse. It is free, it runs in CI, and a reviewer can run the whole build in one command.

## Limits

- Most of the data is made up, so the funnel shape is one I chose. The 37 real test leads are too few for a funnel. They prove the pipe works end to end.
- Two attribution models only. Nothing here settles which model is right.
- The number check proves each number is in the data. It does not prove the sentence around the number is fair.

## About the data

The systems are real. The records are made up from a fixed seed.
