"""Tests for the proof site builder.

    python -m unittest discover -s proof/generator -p "test_*.py"
"""

import html
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build  # noqa: E402

REPO = "https://github.com/mpickles/revenue-stack-demo"

SAMPLE = """# A sample build

Status: planned. Nothing here yet.

See [the decisions](../../docs/decisions.md), [the site folder](../../site) and [Google](https://google.com).

```mermaid
flowchart LR
  A --> B
```

| Check | Pass bar |
|---|---|
| One | Two |
"""


class RenderReadme(unittest.TestCase):
    def setUp(self):
        self.title, self.body = build.render_readme(SAMPLE, "agents/tracking_qa/README.md", REPO)

    def test_first_heading_becomes_the_title_and_leaves_the_body(self):
        self.assertEqual(self.title, "A sample build")
        self.assertNotIn("<h1", self.body)

    def test_link_to_a_file_points_at_the_file_on_github(self):
        self.assertIn(f'href="{REPO}/blob/main/docs/decisions.md"', self.body)

    def test_link_to_a_folder_points_at_the_folder_on_github(self):
        self.assertIn(f'href="{REPO}/tree/main/site"', self.body)

    def test_outside_link_is_left_alone(self):
        self.assertIn('href="https://google.com"', self.body)

    def test_mermaid_block_is_dropped(self):
        self.assertNotIn("flowchart", self.body)

    def test_table_is_rendered_and_can_scroll_sideways(self):
        self.assertIn('<div class="tw"><table>', self.body)

    def test_readme_without_a_heading_is_an_error(self):
        with self.assertRaises(ValueError):
            build.render_readme("No heading here.", "x/README.md", REPO)


class ReadStatus(unittest.TestCase):
    def test_reads_each_allowed_status(self):
        self.assertEqual(build.read_status("# T\n\nStatus: planned. More."), "planned")
        self.assertEqual(build.read_status("# T\n\nStatus: in progress. More."), "in progress")
        self.assertEqual(build.read_status("# T\n\nStatus: live."), "live")

    def test_missing_status_is_an_error(self):
        with self.assertRaises(ValueError):
            build.read_status("# T\n\nNo status line.")


class CommittedPages(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = build.load_config()
        cls.pages = build.build_pages()

    def test_committed_pages_match_a_fresh_build(self):
        self.assertEqual(build.out_of_date(self.pages), [])

    def test_every_build_has_a_page_a_readme_and_a_diagram(self):
        for item in self.config["builds"]:
            self.assertIn(f'builds/{item["slug"]}.html', self.pages)
            self.assertTrue((build.REPO_ROOT / item["readme"]).is_file(), item["readme"])
            self.assertTrue((build.GENERATOR / "diagrams" / f'{item["slug"]}.svg').is_file(), item["slug"])

    def test_every_repo_link_points_at_something_that_exists(self):
        for item in self.config["builds"]:
            for link in item["links"]:
                if "path" in link:
                    self.assertTrue((build.REPO_ROOT / link["path"]).exists(), link["path"])

    def test_every_link_between_pages_resolves(self):
        for path, text in self.pages.items():
            folder = Path(path).parent
            for href in re.findall(r'href="([^"#]+\.html)"', text):
                if href.startswith("http"):
                    continue
                target = (folder / href).as_posix()
                # Path does not fold "builds/../index.html", so do it by hand.
                while "/../" in target:
                    target = re.sub(r"[^/]+/\.\./", "", target, count=1)
                self.assertIn(target, self.pages, f"{path} links to {href}")

    def test_a_tile_without_a_result_says_how_it_will_be_graded(self):
        home = self.pages["index.html"]
        for item in self.config["builds"]:
            if not item.get("headline"):
                self.assertIn("Graded on: " + html.escape(item["graded_on"]), home)

    def test_no_page_shows_a_recording_that_does_not_exist(self):
        for item in self.config["builds"]:
            if not item.get("recording"):
                self.assertNotIn("<video", self.pages[f'builds/{item["slug"]}.html'])

    def test_contact_shows_what_is_set_and_nothing_else(self):
        home = self.pages["index.html"]
        contact = self.config.get("contact") or {}
        self.assertEqual("mailto:" in home, bool(contact.get("email")))
        self.assertEqual("linkedin.com/in/" in home, bool(contact.get("linkedin")))
        self.assertEqual('href="#contact"' in home, bool(contact.get("email") or contact.get("linkedin")))

    def test_no_em_dashes(self):
        for path, text in self.pages.items():
            self.assertNotIn(chr(0x2014), text, path)


if __name__ == "__main__":
    unittest.main()
