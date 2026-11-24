"""Fills in the expected columns of the two answer keys from the rules in the brief.

The rules are in docs/roadwren-brief.md. This script holds no test leads. It reads
the input columns of each CSV file (the made-up person and what the form sent),
works out what the brief says should happen, and writes the expected columns.

    python crm/salesforce/make_answer_keys.py           rewrite both files
    python crm/salesforce/make_answer_keys.py --check   change nothing, fail if a file is out of date
    python crm/salesforce/make_answer_keys.py --counts  also print the counts the README quotes

Standard library only. The same input always gives the same output.

Two things this script does not know and does not guess:
- What Salesforce does with a repeat lead. Those rows are marked "not confirmed,
  see Part M" and every other expected column is left blank.
- Which campaigns exist in your Salesforce account. It assumes every
  utm_campaign value in the keys has a campaign of the same name.
"""

import csv
import io
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Load order matters: a repeat lead is a row whose email was already seen.
FILES = ["test_leads.csv", "test_leads_edge_cases.csv"]

INPUT_COLUMNS = [
    "test_id", "first_name", "last_name", "email", "company", "fleet_size",
    "utm_source", "utm_medium", "utm_campaign", "gclid", "referring_domain",
    "consent_given",
]
EXPECTED_COLUMNS = [
    "expected_result", "expected_lifecycle_stage", "expected_stage_reason",
    "expected_segment", "expected_annual_value", "expected_lead_source",
    "expected_campaign", "expected_owner_queue",
]

# Brief, section 3. Band label: (lowest fleet size, segment, queue).
BANDS = {
    "1-19": (1, "Below Threshold", "Nurture Queue"),
    "20-49": (20, "Small Business", "Small Business Queue"),
    "50-199": (50, "Mid-Market", "Mid-market Queue"),
    "200-499": (200, "Mid-Market", "Mid-market Queue"),
    "500-999": (500, "Enterprise", "Enterprise Queue"),
    "1,000+": (1000, "Enterprise", "Enterprise Queue"),
}
FLOOR = 20                 # Brief, section 2: under 20 vehicles is not for the sales team.
PRICE_PER_VEHICLE = 19     # Brief, section 1: Core, per vehicle a month.
REVIEW_QUEUE = "Needs Review Queue"

# Brief, section 5.
FREE_EMAIL_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com"}

# Brief, section 6.
MEDIUM_TO_CHANNEL = {
    "cpc": "Paid Search",
    "ppc": "Paid Search",
    "paid_social": "Paid Social",
    "email": "Email",
    "referral": "Referral",
}
AI_ASSISTANT_DOMAINS = [
    "chatgpt.com", "perplexity.ai", "gemini.google.com",
    "copilot.microsoft.com", "claude.ai",
]
SEARCH_ENGINE_NAMES = {"google", "bing", "duckduckgo", "yahoo", "ecosia", "brave"}

REPEAT_RESULT = "not confirmed, see Part M"


def is_free_email(email):
    return email.strip().lower().rpartition("@")[2] in FREE_EMAIL_DOMAINS


def referrer_kind(referring_domain):
    """Returns 'ai', 'search', 'site' or 'none'. The AI list is checked first."""
    domain = referring_domain.strip().lower()
    if not domain:
        return "none"
    if any(domain == ai or domain.endswith("." + ai) for ai in AI_ASSISTANT_DOMAINS):
        return "ai"
    if SEARCH_ENGINE_NAMES & set(domain.split(".")):
        return "search"
    return "site"


def channel(utm_medium, referring_domain):
    medium = utm_medium.strip().lower()
    if medium:
        return MEDIUM_TO_CHANNEL.get(medium, "Other")
    return {
        "ai": "AI Search",
        "search": "Organic Search",
        "site": "Referral",
        "none": "Direct",
    }[referrer_kind(referring_domain)]


def campaign(utm_campaign, lead_source):
    name = utm_campaign.strip().lower()
    return name if name else f"{lead_source} - Other"


def judge(row):
    """Returns the expected columns for one lead that is not a repeat."""
    fleet = row["fleet_size"].strip()
    if fleet and fleet not in BANDS:
        raise ValueError(f'{row["test_id"]}: fleet_size "{fleet}" is not a picklist value')

    lead_source = channel(row["utm_medium"], row["referring_domain"])
    out = {
        "expected_result": "created",
        "expected_stage_reason": "",
        "expected_segment": "",
        "expected_annual_value": "",
        "expected_lead_source": lead_source,
        "expected_campaign": campaign(row["utm_campaign"], lead_source),
    }

    # The order is the brief's: no fleet size, then under 20, then free email.
    if not fleet:
        out["expected_lifecycle_stage"] = "New"
        out["expected_owner_queue"] = REVIEW_QUEUE
        return out

    lowest, segment, queue = BANDS[fleet]
    out["expected_segment"] = segment
    if lowest < FLOOR:
        out["expected_lifecycle_stage"] = "Nurture"
        out["expected_stage_reason"] = "Below fleet threshold"
        out["expected_owner_queue"] = queue
        return out

    out["expected_annual_value"] = str(lowest * PRICE_PER_VEHICLE * 12)
    if is_free_email(row["email"]):
        out["expected_lifecycle_stage"] = "New"
        out["expected_stage_reason"] = "Free email needs review"
        out["expected_owner_queue"] = REVIEW_QUEUE
        return out

    out["expected_lifecycle_stage"] = "MQL"
    out["expected_owner_queue"] = queue
    return out


def build(name, seen_emails):
    """Returns (rows, file text) for one answer key."""
    with open(HERE / name, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    done = []
    for row in rows:
        inputs = {column: row[column] for column in INPUT_COLUMNS}
        email = inputs["email"].strip().lower()
        if email in seen_emails:
            expected = dict.fromkeys(EXPECTED_COLUMNS, "")
            expected["expected_result"] = REPEAT_RESULT
        else:
            expected = judge(inputs)
        seen_emails.add(email)
        done.append({**inputs, **expected})

    text = io.StringIO()
    writer = csv.DictWriter(text, fieldnames=INPUT_COLUMNS + EXPECTED_COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(done)
    return done, text.getvalue()


def print_counts(name, rows):
    print(f"\n{name}: {len(rows)} rows")
    for column in ("expected_result", "expected_lifecycle_stage", "expected_owner_queue",
                   "expected_lead_source", "expected_campaign"):
        counts = Counter(row[column] or "(blank)" for row in rows)
        print(f"  {column}")
        for value, count in sorted(counts.items()):
            print(f"    {count:>2}  {value}")


def main(argv):
    check = "--check" in argv
    counts = "--counts" in argv
    seen_emails = set()
    stale = []
    everything = []
    for name in FILES:
        rows, text = build(name, seen_emails)
        everything.extend(rows)
        path = HERE / name
        if path.read_text(encoding="utf-8") != text:
            if check:
                stale.append(name)
            else:
                path.write_text(text, encoding="utf-8", newline="")
                print(f"wrote {name}")
        if counts:
            print_counts(name, rows)
    if counts:
        print_counts("both files", everything)
    if stale:
        print("out of date: " + ", ".join(stale) + ". Run this script without --check.")
        return 1
    if check:
        print("both answer keys match the rules")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
