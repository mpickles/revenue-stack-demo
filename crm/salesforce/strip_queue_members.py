"""Remove queue members from the pulled queue files.

A pull writes each queue's members into its file as Salesforce usernames.
This repo is public, and a username only exists in one Salesforce account,
so members stay out of the files. Run this after every pull:

    python strip_queue_members.py          remove the members
    python strip_queue_members.py --check  change nothing, exit 1 if any file has members
"""
import pathlib
import re
import sys

QUEUES = pathlib.Path(__file__).parent / "force-app" / "main" / "default" / "queues"
MEMBERS = re.compile(r"[ \t]*<queueMembers>.*?</queueMembers>\r?\n?", re.S)


def strip(text):
    """Return the queue file's text with the queueMembers block taken out."""
    return MEMBERS.sub("", text)


def main(argv):
    check = "--check" in argv
    found = []
    for path in sorted(QUEUES.glob("*.queue-meta.xml")):
        before = path.read_bytes().decode("utf-8")
        after = strip(before)
        if after != before:
            found.append(path.name)
            if not check:
                path.write_bytes(after.encode("utf-8"))
    if not found:
        print("No queue file has members. Nothing to do.")
        return 0
    verb = "has members" if check else "members removed"
    for name in found:
        print(f"{name}: {verb}")
    return 1 if check else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
