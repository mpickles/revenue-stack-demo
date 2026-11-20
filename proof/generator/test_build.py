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

    def test_a_build_without_a_result_says_so_on_its_write_up(self):
        for item in self.config["builds"]:
            page = self.pages[f'builds/{item["slug"]}.html']
            if not item.get("headline"):
                self.assertIn("Not graded yet", page)
                self.assertIn(html.escape(item["graded_on"]), page)

    def test_a_missing_result_or_recording_shows_as_a_marked_empty_slot(self):
        """Empty slots are allowed, invented results are not: a slot appears exactly when the real thing is missing."""
        home = self.pages["index.html"]
        project = self.config["project"]
        self.assertEqual('<span class="slot">To come once graded</span>' in home, not project.get("headline"))
        self.assertEqual('<span class="slot">Walkthrough to come</span>' in home, not project.get("recording"))
        for item in self.config["builds"]:
            page = self.pages[f'builds/{item["slug"]}.html']
            self.assertEqual("walkthrough to come" in page, not item.get("recording"), item["slug"])

    def test_the_home_page_does_not_explain_how_a_build_works(self):
        home = self.pages["index.html"]
        self.assertNotIn('<section class="scene"', home)
        self.assertNotIn("How it is graded", home)

    def test_every_build_is_listed_on_the_home_page(self):
        home = self.pages["index.html"]
        for item in self.config["builds"]:
            self.assertIn(f'href="builds/{item["slug"]}.html"', home)

    def test_no_proof_section_until_a_build_has_a_result(self):
        home = self.pages["index.html"]
        has_result = any(item.get("headline") for item in self.config["builds"])
        self.assertEqual("Proof, in one line each" in home, has_result)

    def test_gsap_is_loaded_at_one_pinned_version(self):
        for path, text in self.pages.items():
            versions = set(re.findall(r"/ajax/libs/gsap/([0-9.]+)/", text))
            self.assertEqual(versions, {"3.13.0"}, path)

    def test_every_image_on_a_page_exists(self):
        for path, text in self.pages.items():
            folder = Path(path).parent
            for src in re.findall(r'<img src="([^"]+)"', text):
                target = (build.PROOF / folder / src).resolve()
                self.assertTrue(target.is_file(), f"{path} shows {src}")

    def test_every_image_has_alt_text_and_a_size(self):
        for path, text in self.pages.items():
            for tag in re.findall(r"<img [^>]+>", text):
                self.assertRegex(tag, r'alt="[^"]{10,}"', path)
                self.assertRegex(tag, r'width="\d+" height="\d+"', path)

    def test_no_placeholder_text_is_published(self):
        for path, text in self.pages.items():
            self.assertNotIn("placeholder", text.lower(), path)

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

    def test_every_part_has_a_card_with_its_cover_and_tools(self):
        home = self.pages["index.html"]
        self.assertEqual(home.count('class="cover-card'), len(self.config["builds"]))
        for item in self.config["builds"]:
            self.assertTrue((build.GENERATOR / "covers" / f'{item["slug"]}.svg').is_file(), item["slug"])
            self.assertIn(html.escape(item["card_title"]), home)
            self.assertIn(html.escape(item["tools"]), home)

    def test_a_write_up_with_a_summary_leads_with_it_and_keeps_the_full_notes(self):
        for item in self.config["builds"]:
            page = self.pages[f'builds/{item["slug"]}.html']
            if item.get("summary"):
                for key in ("problem", "built", "choices"):
                    self.assertEqual(len(item["summary"][key]), 3, f'{item["slug"]} {key}')
                    for line in item["summary"][key]:
                        self.assertIn(html.escape(line), page)
                self.assertLess(page.index('class="cs-cols"'), page.index('<details class="full">'), item["slug"])
                self.assertIn('<article class="prose">', page[page.index('<details class="full">'):])
            else:
                self.assertNotIn('<details class="full">', page)

    def test_the_page_about_how_the_site_was_made_exists_and_is_linked(self):
        self.assertIn("colophon.html", self.pages)
        self.assertIn('href="colophon.html"', self.pages["index.html"])

    def test_a_note_that_is_not_written_shows_as_an_empty_slot(self):
        home = self.pages["index.html"]
        notes = home[home.index('<ul class="notes-list"'):]
        notes = notes[: notes.index("</ul>")]
        self.assertEqual(notes.count("<li>"), notes.count('<span class="slot">To come</span>'))
        self.assertNotIn("<a ", notes)

    def test_the_project_page_walks_every_part_once_in_the_order_a_lead_meets_them(self):
        page = self.pages["project.html"]
        journey = self.config["project"]["journey"]
        self.assertEqual(sorted(step["slug"] for step in journey), sorted(item["slug"] for item in self.config["builds"]))
        self.assertEqual(page.count('class="stop"'), len(journey))
        marks = [page.index(f'data-step="{index}"') for index in range(len(journey))]
        self.assertEqual(marks, sorted(marks))
        for step in journey:
            self.assertIn(html.escape(step["short"]), page)
        self.assertIn('href="project.html"', self.pages["index.html"])

    def test_the_project_page_works_before_any_script_runs(self):
        page = self.pages["project.html"]
        first = self.config["project"]["journey"][0]
        self.assertIn(f'href="builds/{first["slug"]}.html"', page)
        self.assertIn(html.escape(first["name"]), page)
        self.assertIn(html.escape(first["hands_on"]), page)

    def test_the_project_page_gives_a_reason_for_each_choice(self):
        page = self.pages["project.html"]
        for because, so, detail in self.config["project"]["choices"]:
            for line in (because, so, detail):
                self.assertIn(html.escape(line), page)

    def test_every_write_up_shows_where_the_part_sits_and_links_back_to_the_map(self):
        order = [step["slug"] for step in self.config["project"]["journey"]]
        for item in self.config["builds"]:
            page = self.pages[f'builds/{item["slug"]}.html']
            strip = page[page.index('<section class="sits"'):]
            strip = strip[: strip.index("</section>")]
            self.assertIn(f"Part {order.index(item['slug']) + 1} of {len(order)}", strip)
            self.assertIn('href="../project.html"', strip)
            self.assertEqual(strip.count('aria-current="page"'), 1)
            self.assertIn(f'href="{item["slug"]}.html" aria-current="page"', strip)
            for slug in order:
                self.assertIn(f'href="{slug}.html"', strip)

    def test_the_project_has_its_own_drawing_on_the_home_page_and_it_opens_the_project_page(self):
        home = self.pages["index.html"]
        self.assertTrue((build.GENERATOR / "covers" / "project.svg").is_file())
        card = home[home.index('<a class="proj-cover"'):]
        card = card[: card.index("</a>")]
        self.assertIn('href="project.html"', card)
        self.assertIn("view-transition-name:cover-project", card)
        self.assertIn("view-transition-name:cover-project", self.pages["project.html"])

    def test_a_drawing_grows_from_its_card_into_the_page_it_opens(self):
        for item in self.config["builds"]:
            name = f'view-transition-name:cover-{item["slug"]}'
            self.assertEqual(self.pages["index.html"].count(name), 1, item["slug"])
            self.assertEqual(self.pages["project.html"].count(name), 1, item["slug"])
            page = self.pages[f'builds/{item["slug"]}.html']
            self.assertEqual(page.count("view-transition-name:"), 1, item["slug"])
            self.assertIn(name, page[page.index('<div class="page-cover">'):page.index('<header class="writeup-head">')])

    def test_pages_only_slide_into_each_other_when_motion_is_welcome(self):
        for path, text in self.pages.items():
            self.assertIn("@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}", text, path)
            self.assertEqual(text.count("@view-transition"), 1, path)

    def test_no_em_dashes(self):
        for path, text in self.pages.items():
            self.assertNotIn(chr(0x2014), text, path)


if __name__ == "__main__":
    unittest.main()
