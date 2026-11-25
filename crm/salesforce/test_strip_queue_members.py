import unittest

from strip_queue_members import strip

WITH_MEMBERS = """<?xml version="1.0" encoding="UTF-8"?>
<Queue xmlns="http://soap.sforce.com/2006/04/metadata">
    <doesIncludeBosses>false</doesIncludeBosses>
    <doesSendEmailToMembers>false</doesSendEmailToMembers>
    <name>Enterprise Queue</name>
    <queueMembers>
        <users>
            <user>someone@example.com</user>
        </users>
    </queueMembers>
    <queueSobject>
        <sobjectType>Lead</sobjectType>
    </queueSobject>
</Queue>
"""

WITHOUT_MEMBERS = """<?xml version="1.0" encoding="UTF-8"?>
<Queue xmlns="http://soap.sforce.com/2006/04/metadata">
    <doesIncludeBosses>false</doesIncludeBosses>
    <doesSendEmailToMembers>false</doesSendEmailToMembers>
    <name>Enterprise Queue</name>
    <queueSobject>
        <sobjectType>Lead</sobjectType>
    </queueSobject>
</Queue>
"""


class StripQueueMembers(unittest.TestCase):
    def test_members_block_is_removed(self):
        self.assertEqual(strip(WITH_MEMBERS), WITHOUT_MEMBERS)

    def test_file_without_members_is_unchanged(self):
        self.assertEqual(strip(WITHOUT_MEMBERS), WITHOUT_MEMBERS)

    def test_windows_line_endings_are_kept(self):
        crlf = WITH_MEMBERS.replace("\n", "\r\n")
        self.assertEqual(strip(crlf), WITHOUT_MEMBERS.replace("\n", "\r\n"))

    def test_running_twice_changes_nothing_more(self):
        self.assertEqual(strip(strip(WITH_MEMBERS)), WITHOUT_MEMBERS)


if __name__ == "__main__":
    unittest.main()
