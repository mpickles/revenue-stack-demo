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

    def test_the_platform_has_its_own_drawing_on_the_home_page_and_it_opens_the_platform_page(self):
        home = self.pages["index.html"]
        self.assertIn('href="platform.html"', home)
        self.assertEqual(home.count("view-transition-name:cover-platform"), 1)
        self.assertEqual(self.pages["platform.html"].count("view-transition-name:cover-platform"), 1)

    def test_every_platform_tile_grows_into_the_drawing_on_top_of_its_page(self):
        for part in self.config["platform"]["parts"]:
            name = f'view-transition-name:cover-pf-{part["slug"]}'
            for where in ("index.html", "platform.html"):
                self.assertEqual(self.pages[where].count(name), 1, f'{where} {part["slug"]}')
            page = self.pages[part["file"]]
            self.assertEqual(page.count("view-transition-name:"), 1, part["file"])
            self.assertLess(page.index(name), page.index("<h1"), part["file"])
            self.assertIn('<div class="page-cover">', page[:page.index("<h1")], part["file"])

    def test_every_platform_page_says_what_went_wrong_and_what_i_do_now(self):
        for item in self.config["platform"]["pages"]:
            page = self.pages[item["file"]]
            self.assertEqual(page.count("What went wrong, and what I do now</h2>"), 1, item["file"])
            block = page[page.index("What went wrong, and what I do now</h2>"):]
            block = block[:block.index("</dl>")]
            self.assertGreaterEqual(block.count("<dt>"), 3, item["file"])
            answers = sum(block.count(f"<i>{label}</i>") for label in ("Fix", "Next time", "Still open"))
            self.assertEqual(block.count("<dt>"), answers, item["file"])

    def test_a_part_page_has_three_story_sections_and_no_more(self):
        gone = ("Why it is built the way it is", "What broke, and what I did about it", "What I learned")
        for part in self.config["platform"]["parts"]:
            page = self.pages[part["file"]]
            for heading in gone:
                self.assertNotIn(f'<h2 class="cs-h">{heading}', page, f'{part["file"]} {heading}')
            self.assertLess(page.index("What I chose, and what I turned down</h2>"), page.index("What went wrong, and what I do now</h2>"), part["file"])

    def test_the_platform_page_names_the_three_things_i_learned_and_how_my_process_changed(self):
        page = self.pages["platform.html"]
        self.assertEqual(page.count("What I learned</h2>"), 1)
        block = page[page.index("What I learned</h2>"):page.index("What went wrong, and what I do now</h2>")]
        for theme in ("Moving data cheaply", "Designing for the person using it", "Directing an AI, strictly"):
            self.assertEqual(block.count(f"<h3>{theme}</h3>"), 1, theme)
        steps = block[block.index('<ol class="how five">'):block.index("</ol>")]
        self.assertEqual(steps.count("<li>"), 5)

    def test_every_part_page_says_what_i_chose_and_what_i_turned_down(self):
        for part in self.config["platform"]["parts"]:
            page = self.pages[part["file"]]
            self.assertEqual(page.count("What I chose, and what I turned down</h2>"), 1, part["file"])
            block = page[page.index('<div class="chose">'):page.index("What went wrong, and what I do now</h2>")]
            self.assertGreaterEqual(block.count("<small>Chose</small>"), 3, part["file"])
            self.assertEqual(block.count("<small>Chose</small>"), block.count("<small>Turned down</small>"), part["file"])
            self.assertEqual(block.count("<small>Chose</small>"), block.count("<small>Why, and what it cost</small>"), part["file"])

    def test_a_claim_that_something_was_done_says_how(self):
        for file, label in (
            ("platform-data-in.html", "How I cut each one"),
            ("platform-data-in.html", "How the capture works"),
            ("platform-web-app.html", "How the database decides"),
            ("platform-reports.html", "How the number check works"),
            ("platform-audit.html", "How a sweep runs"),
            ("platform-spend.html", "How each one decides"),
        ):
            page = self.pages[file]
            self.assertIn(label, page, file)
            steps = page[page.index(label):]
            steps = steps[steps.index('<ol class="how'):steps.index("</ol>")]
            self.assertGreaterEqual(steps.count("<li>"), 3, f"{file} {label}")

    def test_every_platform_link_lands_on_a_page_that_exists(self):
        for item in self.config["platform"]["pages"]:
            page = self.pages[item["file"]]
            for href in re.findall(r'href="([^"#:]+\.html)(?:#[^"]*)?"', page):
                self.assertIn(href, self.pages, f'{item["file"]} links to {href}')

    def test_a_platform_demo_says_its_clients_and_numbers_are_made_up(self):
        for item in self.config["platform"]["pages"]:
            page = self.pages[item["file"]]
            if 'class="pick"' in page or 'id="app"' in page:
                self.assertRegex(page, r"made[- ]up", item["file"])

    def test_the_platform_map_comes_before_the_reasons_and_the_failures(self):
        page = self.pages["platform.html"]
        self.assertLess(page.index('id="hub"'), page.index("Why it is built the way it is"))
        self.assertLess(page.index('id="hub"'), page.index("What went wrong, and what I do now"))

    def test_the_platform_map_its_tiles_and_its_pages_are_the_same_six_things_in_the_same_order(self):
        parts = self.config["platform"]["parts"]
        page = self.pages["platform.html"]
        boxes = re.findall(r'<a class="rg" href="([^"]+)" aria-label="(\d)\. ([^"]+)"', page)
        self.assertEqual([(href, name) for href, _, name in boxes], [(part["file"], html.escape(part["name"])) for part in parts])
        self.assertEqual([number for _, number, _ in boxes], [str(i + 1) for i in range(len(parts))])
        for where in ("index.html", "platform.html"):
            tiles = re.findall(r'<a class="wf-card cover-card" href="([^"]+)">.*?<b><i>(\d)</i>([^<]+)</b>', self.pages[where], re.S)
            self.assertEqual(tiles, [(part["file"], str(i + 1), html.escape(part["name"])) for i, part in enumerate(parts)], where)
        for part in parts:
            self.assertIn(part["file"], self.pages)
            self.assertTrue((build.GENERATOR / "covers" / f'pf-{part["slug"]}.svg').is_file(), part["slug"])

    def test_every_platform_part_page_lists_all_the_parts_and_links_back_to_the_map(self):
        files = [part["file"] for part in self.config["platform"]["parts"]]
        for index, file in enumerate(files):
            page = self.pages[file]
            strip = page[page.index('<section class="sits"'):]
            strip = strip[: strip.index("</section>")]
            self.assertIn(f"Part {index + 1} of {len(files)}", strip)
            self.assertIn('href="platform.html#hub"', strip)
            self.assertEqual(strip.count('aria-current="page"'), 1, file)
            self.assertIn(f'href="{file}" aria-current="page"', strip)
            for other in files:
                self.assertIn(f'href="{other}"', strip, file)

    def test_no_page_is_left_over_from_an_earlier_layout(self):
        on_disk = {
            str(path.relative_to(build.PROOF)).replace("\\", "/")
            for path in build.PROOF.rglob("*.html")
            if "generator" not in path.relative_to(build.PROOF).parts
        }
        self.assertEqual(on_disk, set(self.pages))

    def test_the_clickable_replica_is_only_on_the_platform_page_and_comes_last(self):
        page = self.pages["platform.html"]
        self.assertIn('id="app" data-start="pacing" data-only=""', page)
        for screen in ("clients", "pacing", "review", "audit"):
            self.assertIn(f'data-screen="{screen}"', page)
        self.assertGreater(page.index('id="app"'), page.index("What this shows I can do"))
        self.assertLess(page.index('id="shots"'), page.index("Why it is built the way it is"))
        for part in self.config["platform"]["parts"]:
            self.assertNotIn('id="app"', self.pages[part["file"]], part["file"])
            self.assertIn('class="rshot-frame"', self.pages[part["file"]]) if part["slug"] in ("web-app", "reports", "audit", "spend") else None
        for item in self.config["platform"]["pages"]:
            for token in ("$$APP", "$$TILES", "$$COVER", "$$START", "$$ONLY"):
                self.assertFalse(token in self.pages[item["file"]], f'{token} left in {item["file"]}')

    def test_every_project_and_platform_page_opens_with_problem_built_result(self):
        files = ["project.html"] + [item["file"] for item in self.config["platform"]["pages"]]
        for file in files:
            page = self.pages[file]
            top = page[page.index("<h1"):page.index('<p class="own">')]
            for label in ("<dt>Problem</dt>", "<dt>What I built</dt>", "<dt>Result</dt>"):
                self.assertEqual(top.count(label), 1, f"{file} {label}")

    def test_the_report_page_states_the_real_rule(self):
        page = self.pages["platform-reports.html"]
        self.assertIn("It does not block.", page)
        self.assertNotIn("build anyway", page.lower())

    def test_the_platform_shows_real_screenshots_in_light_and_dark(self):
        page = self.pages["platform.html"]
        shots = re.findall(r'<img src="(img/platform/[^"]+)-light\.webp" class="l"', page)
        self.assertEqual(len(shots), 6)
        for shot in shots:
            self.assertIn(f'<img src="{shot}-dark.webp" class="d"', page)
            self.assertTrue((build.PROOF / f"{shot}-dark.webp").is_file(), shot)
        self.assertIn("made-up", page[page.index('id="shots"'):page.index('id="app"')])
        for file in ("platform-spend.html", "platform-web-app.html", "platform-reports.html", "platform-audit.html"):
            self.assertIn('class="rshot-frame"', self.pages[file], file)

    def test_a_recording_on_a_page_is_a_file_that_exists(self):
        for path, text in self.pages.items():
            for src in re.findall(r'<source src="([^"]+)"', text):
                self.assertTrue((build.PROOF / Path(path).parent / src).resolve().is_file(), f"{path} plays {src}")

    def test_no_em_dashes(self):
        for path, text in self.pages.items():
            self.assertNotIn(chr(0x2014), text, path)


if __name__ == "__main__":
    unittest.main()
