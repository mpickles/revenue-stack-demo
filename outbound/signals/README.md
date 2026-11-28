# Outbound: a hiring signal starts a checked, approved email sequence

Status: planned. Nothing in this folder is built yet. This page says what it will do and how it will be graded.

A workflow that watches the Tier A accounts for a reason to reach out, drafts a short sequence with Claude, checks every claim in the draft, waits for a person to approve it, and logs each step in Salesforce. It is for a team that wants outbound to be timely and specific without anyone sending something untrue.

## What it will do

1. Watch each Tier A account's public job board once a day. A new posting for a fleet, dispatch or logistics role is the signal.
2. Save each new signal once. A repeat of the same posting is ignored.
3. Ask Claude for a three-email plain-text sequence, written from the signal and the account record in a fixed format.
4. Check the draft in code: every claim must trace to the signal or the account record, or the draft is rejected.
5. Hold every draft for a person to approve, edit or reject.
6. Respect a do-not-contact list, one sequence per person in 30 days, and a daily cap.
7. Send from a domain set up with SPF, DKIM and DMARC.
8. Write each step to Salesforce as a task, and keep a sequence status on the contact.
9. Read each reply, sort it (interested, not now, unsubscribe, wrong person) and update Salesforce.

## How it will be graded

| Check | Pass bar |
|---|---|
| 20 planted signals with an answer key | Every signal that should start a sequence does. None of the ones that must not (a repeat, the wrong role, a suppressed account, a contact reached in the last 30 days) does |
| 10 drafts with a planted false claim | All 10 rejected by the check |
| Drafts | Nothing is queued without an approval on record |
| Authentication | SPF, DKIM and DMARC all pass on a test message |
| Planted replies | Each is sorted into the right group, and an unsubscribe adds the person to the do-not-contact list |
| A second run on the same day | Sends nothing new |

## Planned files

- `signal_rule.md`: which postings count, and why
- `n8n/signal_to_sequence.json`: the exported workflow
- `prompts/sequence.md` and `check_claims.py`
- `signals_planted.json` and `answer_key.json`
- `results.md`

## Choices already made

- Roadwren is made up, so no email goes to a real prospect. Sends go only to test inboxes I own. The system is real; the audience is not, and the page says so.
- A person approves every draft. The check in code is there to catch what a tired reviewer would miss, not to replace the reviewer.
- Hiring is the signal because a public job board can be read for free and a new fleet or dispatch role says something true about the account.
