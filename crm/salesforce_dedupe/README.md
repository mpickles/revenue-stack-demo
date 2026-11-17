# CRM cleanup: duplicates merged by script and graded against an answer key

Status: planned. Nothing in this folder is built yet. This page says what it will do and how it will be graded.

A Salesforce account seeded with a known mess, a script that finds and merges the duplicates, and an answer key that grades every merge. It is for a team whose CRM has duplicate accounts and contacts and who cannot afford a wrong merge.

## What it will do

1. Seed the same mess every time: 80 accounts and 300 contacts with planted duplicates, contacts with no account, broken names, and decoys that look like duplicates but are not.
2. Export the records and find duplicate groups with SQL.
3. Write a plan file that lists every merge before any is made. Dry run is the default.
4. Write a backup of every seeded record before the first merge.
5. Merge each group into one surviving record, chosen by a written rule.
6. Leave any account with an open opportunity alone and put it on a list for a person.
7. Grade the result against the answer key.

## How it will be graded

| Check | Pass bar |
|---|---|
| Merges made | 0 wrong, decoys included |
| True duplicates | The share found is stated. Each miss is kept in the table with the reason |
| Groups of three or more | Each ends as one record, with the right survivor |
| Three accounts with an open opportunity | All three are on the list for a person and untouched |
| A second run | Nothing to do |
| A run stopped halfway and restarted | No pair is merged twice. The final grade is the same |
| API calls in a full run | Counted, printed and far under the daily limit |

## Planned files

- `seed.py` and `answer_key.json`
- `find_duplicates.sql`: written by hand
- `clean.py`: dry run by default
- `audit.py`: grades against the answer key

## Choices already made

- A Salesforce merge deletes the other records and cannot be undone. So the backup and the plan are written first, and the script never merges an account with open pipeline on its own.
- Every seeded record carries a marker, so the script can never touch the routing build's test leads.
- A wrong merge is worse than a missed duplicate. The script is tuned for 0 wrong merges, and the misses are reported.

## Limits

- The mess is one I planted. A real CRM has kinds of mess nobody planned for.
- 380 records. Real cleanups run on far more, where API limits and run time matter more.

## About the data

The Salesforce account is real. Every account and contact in it is made up, on example.com addresses.
