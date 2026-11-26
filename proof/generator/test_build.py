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

    def test_a_result_or_recording_is_shown_only_once_it_exists(self):
        """Invented results are not allowed. On the home page a row appears exactly when the real thing exists; write-ups still say Not graded yet."""
        home = self.pages["index.html"]
        project = self.config["project"]
        facts = home[home.index('<a class="proj-cover" href="project.html"'):]
        facts = facts[facts.index('<dl class="facts">'):]
        facts = facts[: facts.index("</dl>")]
        self.assertEqual("<dt>Result</dt>" in facts, bool(project.get("headline")))
        self.assertEqual("<dt>Watch</dt>" in facts, bool(project.get("recording")))
        self.assertNotIn('class="slot"', facts)
        for item in self.config["builds"]:
            page = self.pages[f'builds/{item["slug"]}.html']
            self.assertNotIn("walkthrough to come", page, item["slug"])
            self.assertEqual('class="recording"' in page, bool(item.get("recording")), item["slug"])

    def test_the_home_page_does_not_explain_how_a_build_works(self):
        home = self.pages["index.html"]
        self.assertNotIn('<section class="scene"', home)
        self.assertNotIn("How it is graded", home)

    def test_every_build_is_one_click_from_the_project_page_the_home_page_links_to(self):
        self.assertIn('href="project.html"', self.pages["index.html"])
        project = self.pages["project.html"]
        for item in self.config["builds"]:
            self.assertIn(f'href="builds/{item["slug"]}.html"', project)

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

    def test_every_page_ends_with_a_way_to_reach_me(self):
        contact = self.config.get("contact") or {}
        wanted = bool(contact.get("email") or contact.get("linkedin"))
        for path, page in self.pages.items():
            if not path.endswith(".html"):
                continue
            self.assertEqual(page.count('id="contact"'), int(wanted), path)
            self.assertEqual('href="#contact"' in page, wanted, path)
            if wanted:  # nothing but scripts comes after it
                after = page[page.index('id="contact"'):]
                after = after[after.index("</section>"):]
                for tag in ("<h2", "<article", "<nav"):
                    self.assertNotIn(tag, after, path)

    def test_the_home_page_shows_two_projects_and_sends_the_reader_to_each_map_for_the_parts(self):
        home = self.pages["index.html"]
        self.assertEqual(home.count('class="cover-card'), 0, "part tiles live on the project pages, not the home page")
        self.assertEqual(home.count("See the six on the map"), 2)
        self.assertIn('href="platform.html#hub"', home)
        self.assertIn('href="project.html#map"', home)
        self.assertIn('id="hub"', self.pages["platform.html"])
        self.assertIn('id="map"', self.pages["project.html"])
        self.assertIn(f'{len(self.config["builds"])} parts.', home)
        for item in self.config["builds"]:
            self.assertTrue((build.GENERATOR / "covers" / f'{item["slug"]}.svg').is_file(), item["slug"])

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

    def test_the_home_page_lists_only_notes_that_are_written(self):
        home = self.pages["index.html"]
        written = [n for n in self.config.get("notes", []) if n.get("href")]
        self.assertEqual('id="notes"' in home, bool(written))
        self.assertEqual('href="#notes"' in home, bool(written))
        for note in self.config.get("notes", []):
            self.assertEqual(html.escape(note["title"]) in home, bool(note.get("href")), note["title"])

    def test_the_photo_is_shown_only_once_there_is_one(self):
        home = self.pages["index.html"]
        self.assertNotIn("Photo to come", home)
        self.assertEqual('class="portrait"' in home, (build.PROOF / "img" / "portrait.webp").is_file())

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

    def test_the_project_page_promises_a_result_once_and_shows_no_empty_section(self):
        page = self.pages["project.html"]
        self.assertLessEqual(page.count('class="slot"'), 1)
        self.assertEqual(page.count("<dt>Result</dt>"), 2 if self.config["project"].get("headline") else 1)
        self.assertNotIn("What broke, and what I did about it", page)

    def test_no_page_tells_the_reader_what_the_work_shows(self):
        for path, page in self.pages.items():
            self.assertNotIn("What this shows I can do", page, path)

    def test_a_wrong_address_gets_a_page_that_leads_back_to_the_work(self):
        page = self.pages["404.html"]
        self.assertIn('<base href="/">', page)
        for href in ("index.html", "platform.html", "index.html#work"):
            self.assertIn(f'href="{href}"', page)
        self.assertIn("noindex", page)

    def test_every_page_prints_without_the_site_chrome(self):
        for path, page in self.pages.items():
            if not path.endswith(".html"):
                continue
            self.assertEqual(page.count("@media print{"), 1, path)
            rule = page[page.index("@media print{"):]
            for hidden in (".nav", ".progress", ".cursor", ".contact", ".pager"):
                self.assertIn(hidden, rule[:rule.index("display:none")], path)

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

    def test_every_write_up_opens_with_a_breadcrumb_back_to_the_map(self):
        order = [step["slug"] for step in self.config["project"]["journey"]]
        for item in self.config["builds"]:
            page = self.pages[f'builds/{item["slug"]}.html']
            self.assertEqual(page.count('<nav class="crumb"'), 1, item["slug"])
            crumb = page[page.index('<nav class="crumb"'):]
            crumb = crumb[: crumb.index("</nav>")]
            self.assertIn(f"Part {order.index(item['slug']) + 1} of {len(order)}", crumb)
            self.assertIn('href="../project.html"', crumb)
            self.assertLess(page.index('<nav class="crumb"'), page.index("<h1"), item["slug"])
            self.assertNotIn('<section class="sits"', page)

    def test_the_project_has_its_own_drawing_on_the_home_page_and_it_opens_the_project_page(self):
        home = self.pages["index.html"]
        self.assertTrue((build.GENERATOR / "covers" / "project.svg").is_file())
        self.assertEqual(home.count('<a class="proj-cover" href="project.html"'), 1)
        card = home[home.index('<a class="proj-cover" href="project.html"'):]
        card = card[: card.index("</a>")]
        self.assertIn("view-transition-name:cover-project", card)
        self.assertIn("view-transition-name:cover-project", self.pages["project.html"])

    def test_the_first_screen_has_one_button_into_the_platform(self):
        home = self.pages["index.html"]
        hero = home[home.index('<header class="hero'):home.index("</header>")]
        self.assertEqual(hero.count('<a class="see" href="platform.html">See the platform</a>'), 1)

    def test_every_page_has_a_link_preview_and_a_tab_icon(self):
        self.assertTrue((build.PROOF / "favicon.svg").is_file())
        self.assertTrue((build.PROOF / "img" / "og.png").is_file())
        site = self.config["site"]
        seen = set()
        for path, page in self.pages.items():
            head = page[: page.index("</head>")]
            for tag in ('<meta name="description" content="', '<meta property="og:title" content="', '<meta property="og:description" content="'):
                self.assertEqual(head.count(tag), 1, f"{path} {tag}")
            self.assertIn(f'<meta property="og:image" content="{site}/img/og.png">', head, path)
            self.assertIn('<link rel="icon" href="/favicon.svg"', head, path)
            line = head[head.index('<meta name="description" content="') + 34:]
            line = line[: line.index('"')]
            self.assertTrue(20 <= len(html.unescape(line)) <= 200, f"{path}: {len(line)}")
            seen.add(line)
        self.assertGreater(len(seen), len(self.pages) // 2, "pages should not all share one description")

    def test_the_first_screen_is_about_me_and_the_platform_numbers_sit_on_the_platform_card(self):
        home = self.pages["index.html"]
        hero = home[home.index('<header class="hero'):home.index("</header>")]
        self.assertIn('aria-label="Max Pickard"', hero[hero.index("<h1"):hero.index("</h1>")])
        self.assertIn('<p class="role-line">Marketing operations', hero)
        self.assertLess(hero.index("</h1>"), hero.index('<p class="role-line">'))
        self.assertIn("<dt>Learning now</dt>", hero)
        self.assertNotIn('class="stats"', hero)
        for number in ("15 clients", "9:50 am", "$0 a month"):
            self.assertNotIn(number, hero, number)
        card = home[home.index('<a class="proj-cover shot" href="platform.html"'):home.index('<a class="proj-cover" href="project.html"')]
        for number in ("15 clients", "9:50 am", "$0 a month"):
            self.assertEqual(card.count(number), 1, number)

    def test_the_platform_card_and_its_page_banner_are_the_same_real_screen(self):
        home = self.pages["index.html"]
        card = home[home.index('<a class="proj-cover shot" href="platform.html"'):]
        card = card[: card.index("</a>")]
        page = self.pages["platform.html"]
        banner = page[page.index('<div class="page-cover">'):page.index("<h1")]
        for where, block in (("home card", card), ("platform banner", banner)):
            self.assertEqual(block.count("view-transition-name:cover-platform"), 1, where)
            self.assertIn("img/platform/04-client-overview-light.webp", block, where)
            self.assertIn("img/platform/04-client-overview-dark.webp", block, where)
        self.assertIn("Made-up clients and numbers", card)
        self.assertEqual(home.count("view-transition-name:cover-platform"), 1)
        self.assertEqual(page.count("view-transition-name:cover-platform"), 1)

    def test_a_client_case_study_names_no_client_and_follows_the_page_shape(self):
        home = self.pages["index.html"]
        for case in self.config["cases"]:
            page = self.pages[case["file"]]
            self.assertIn(f'href="{case["file"]}"', home)
            self.assertIn("Client not named", page)
            for label in ("<dt>Problem</dt>", "<dt>What I did</dt>", "<dt>Result</dt>"):
                self.assertEqual(page.count(label), 1, f'{case["file"]} {label}')
            self.assertLess(page.index('<nav class="crumb"'), page.index("<h1"))
            self.assertIn("What I chose, and what I turned down</h2>", page)
            self.assertIn("What went wrong, and what I do now</h2>", page)
            self.assertNotIn("<img", page[page.index("<main"):page.index("</main>")], "no real screenshots on a client page")
            self.assertNotRegex(page[page.index("<main"):page.index("</main>")], r"\$\d", "no raw client money figures")

    def test_the_first_screen_shows_the_work_as_links(self):
        home = self.pages["index.html"]
        hero = home[home.index('<header class="hero'):home.index("</header>")]
        work = hero[hero.index('<div class="hero-work"'):]
        self.assertEqual(work.count('<a class="hw big" href="platform.html"'), 1)
        self.assertEqual(work.count('<a class="hw" href="project.html"'), 1)
        self.assertLess(work.index('href="platform.html"'), work.index('href="project.html"'), "the live platform is the large card")
        for case in self.config["cases"]:
            self.assertIn(f'href="{case["file"]}"', work)
        # A card on the first screen and the card in Projects open the same page. Only one may carry the
        # shared name in the HTML; the script hands it to whichever is clicked.
        self.assertEqual(home.count("view-transition-name:cover-platform"), 1)
        self.assertEqual(home.count("view-transition-name:cover-project"), 1)
        self.assertEqual(work.count('data-vt-name="cover-platform"'), 1)
        self.assertEqual(work.count('data-vt-name="cover-project"'), 1)
        self.assertIn("data-vt-name", home[home.index("<script"):])

    def test_a_first_screen_card_hands_its_picture_and_its_title_to_the_page_it_opens(self):
        home = self.pages["index.html"]
        hero = home[home.index('<header class="hero'):home.index("</header>")]
        for name, page in (("platform", "platform.html"), ("project", "project.html")):
            self.assertEqual(hero.count(f'data-vt-name="cover-{name}"'), 1, name)
            self.assertEqual(hero.count(f'data-vt-name="title-{name}"'), 1, name)
            target = self.pages[page]
            title = target[target.index("<h1"):target.index("</h1>")]
            self.assertIn(f"view-transition-name:title-{name}", title, page)
            self.assertEqual(target.count(f"view-transition-name:title-{name}"), 1, page)
            # On the home page the title's name is only ever given by the click, never written into the HTML.
            self.assertNotIn(f"view-transition-name:title-{name}", home[: home.index("<script")])

    def test_motion_speaks_one_language_and_the_first_screen_has_no_loader(self):
        home = self.pages["index.html"]
        script = home[home.rindex("<script"):]
        self.assertIn('var EASE = "power3.out", FAST = 0.2, MED = 0.35, SLOW = 0.5;', script)
        self.assertIn("--t-fast:.2s;--t-med:.35s;--t-slow:.5s", home)
        for word in ("preloader", "loader", "splash"):
            self.assertNotIn(f'class="{word}', home)
        # The cards are grey only where there is a pointer to bring the colour, and never when motion is unwelcome.
        self.assertIn("@media (hover:hover) and (pointer:fine){", home)
        self.assertIn(".hw:hover .hw-pic > *,.hw:focus-visible .hw-pic > *{filter:none;opacity:1}", home)

    def test_a_status_has_its_own_colour_and_never_the_accent(self):
        for path, page in self.pages.items():
            self.assertNotRegex(page, r'class="status is-active">\s*Live', f"{path}: Live must be green, not the in-progress colour")
        style = self.pages["index.html"]
        self.assertIn(".status.is-live,.rows .status.is-live{color:var(--ok)}", style)
        self.assertIn(".status.is-active,.rows .status.is-active{color:var(--warn)}", style)
        self.assertIn('<span class="status is-live">Live at work</span>', self.pages["index.html"])
        self.assertIn('class="status is-live">Live at Upgrow', self.pages["platform.html"])

    def test_projects_is_the_one_dark_band_and_the_two_projects_alternate(self):
        home = self.pages["index.html"]
        self.assertEqual(home.count('<section class="sec band"'), 1)
        self.assertIn('<section class="sec band" id="work">', home)
        band = home[home.index('<section class="sec band" id="work">'):]
        band = band[: band.index("</section>")]
        self.assertEqual(band.count('<article class="sys'), 2)
        self.assertIn(".band .sys.second .proj-cover{order:2}", home)
        platform = band[: band.index('<article class="sys second')]
        self.assertEqual(platform.count("<dt>"), 3, "three facts, not a table")

    def test_skills_are_plain_lines_and_about_leads_with_the_line_people_remember(self):
        home = self.pages["index.html"]
        skills = home[home.index('id="skills"'):home.index('id="about"')]
        self.assertNotIn("<table", skills)
        self.assertEqual(skills.count("<dt>"), 4)
        about = home[home.index('id="about"'):]
        about = about[: about.index("</section>")]
        self.assertIn('<p class="big">Before any of this I worked on an alpaca ranch and cooked for a sorority house.</p>', about)
        self.assertIn("applied mathematics", about)

    def test_the_home_page_leads_with_the_live_platform(self):
        home = self.pages["index.html"]
        self.assertLess(home.index('<a class="proj-cover shot" href="platform.html"'), home.index('<a class="proj-cover" href="project.html"'))

    def test_a_drawing_grows_from_its_card_into_the_page_it_opens(self):
        for item in self.config["builds"]:
            name = f'view-transition-name:cover-{item["slug"]}'
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
            self.assertEqual(self.pages["platform.html"].count(name), 1, part["slug"])
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
        steps = block[block.index('<ol class="flow n5 dated">'):block.index("</ol>")]
        self.assertEqual(steps.count("<li>"), 5)
        self.assertEqual(steps.count("<svg "), 5)

    def test_every_part_page_says_what_i_chose_and_what_i_turned_down(self):
        for part in self.config["platform"]["parts"]:
            page = self.pages[part["file"]]
            self.assertEqual(page.count("What I chose, and what I turned down</h2>"), 1, part["file"])
            block = page[page.index('<div class="chose">'):page.index("What went wrong, and what I do now</h2>")]
            self.assertGreaterEqual(block.count("<small>Chose</small>"), 3, part["file"])
            self.assertEqual(block.count("<small>Chose</small>"), block.count("<small>Turned down</small>"), part["file"])
            self.assertEqual(block.count("<small>Chose</small>"), block.count("<small>Why</small>"), part["file"])

    def test_a_claim_that_something_was_done_says_how_as_drawn_steps(self):
        for file, label in (
            ("platform-data-in.html", "How I cut each one"),
            ("platform-data-in.html", "How the capture works"),
            ("platform-web-app.html", "How the database decides"),
            ("platform-reports.html", "How one report gets made"),
            ("platform-audit.html", "How a sweep runs"),
            ("platform-spend.html", "How each one decides"),
        ):
            page = self.pages[file]
            self.assertIn(label, page, file)
            steps = page[page.index(label):]
            steps = steps[steps.index('<ol class="flow'):steps.index("</ol>")]
            self.assertGreaterEqual(steps.count("<li>"), 3, f"{file} {label}")
            self.assertEqual(steps.count("<li>"), steps.count("<svg "), f"{file} {label}: every step has a drawing")
            self.assertEqual(steps.count("<li>"), steps.count("<b>"), f"{file} {label}: every step has a short name")

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
        for where in ("platform.html",):
            tiles = re.findall(r'<a class="wf-card cover-card" href="([^"]+)">.*?<b><i>(\d)</i>([^<]+)</b>', self.pages[where], re.S)
            self.assertEqual(tiles, [(part["file"], str(i + 1), html.escape(part["name"])) for i, part in enumerate(parts)], where)
        for part in parts:
            self.assertIn(part["file"], self.pages)
            self.assertTrue((build.GENERATOR / "covers" / f'pf-{part["slug"]}.svg').is_file(), part["slug"])

    def test_every_platform_part_page_has_a_breadcrumb_on_top_and_its_neighbours_at_the_bottom(self):
        parts = self.config["platform"]["parts"]
        for index, part in enumerate(parts):
            page = self.pages[part["file"]]
            self.assertEqual(page.count('<nav class="crumb"'), 1, part["file"])
            crumb = page[page.index('<nav class="crumb"'):]
            crumb = crumb[: crumb.index("</nav>")]
            self.assertIn(f"Part {index + 1} of {len(parts)}", crumb)
            self.assertIn('href="platform.html#hub"', crumb)
            self.assertLess(page.index('<nav class="crumb"'), page.index("<h1"), part["file"])
            self.assertNotIn('<section class="sits"', page)
            pager = page[page.index('<nav class="pager"'):]
            pager = pager[: pager.index("</nav>")]
            self.assertGreater(page.index('<nav class="pager"'), page.index("What went wrong, and what I do now"))
            self.assertIn('href="platform.html#hub"', pager)
            self.assertEqual('class="prev"' in pager, index > 0, part["file"])
            self.assertEqual('class="next"' in pager, index < len(parts) - 1, part["file"])
            if index > 0:
                self.assertIn(f'class="prev" href="{parts[index - 1]["file"]}"', pager)
            if index < len(parts) - 1:
                self.assertIn(f'class="next" href="{parts[index + 1]["file"]}"', pager)

    def test_no_page_is_left_over_from_an_earlier_layout(self):
        on_disk = {
            str(path.relative_to(build.PROOF)).replace("\\", "/")
            for path in build.PROOF.rglob("*.html")
            if "generator" not in path.relative_to(build.PROOF).parts
        }
        self.assertEqual(on_disk, set(self.pages))

    def test_real_screenshots_carry_the_platform_and_no_page_has_a_rebuilt_replica(self):
        page = self.pages["platform.html"]
        self.assertLess(page.index('id="shots"'), page.index("Why it is built the way it is"))
        self.assertIn("data-shot", page)
        self.assertIn('getElementById("shots")', page)
        self.assertNotIn('id="app"', page)
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
            top = page[page.index("<h1"):]
            top = top[: top.index("</dl>")]
            for label in ("<dt>Problem</dt>", "<dt>What I built</dt>", "<dt>Result</dt>"):
                self.assertEqual(top.count(label), 1, f"{file} {label}")

    def test_the_report_page_states_the_real_rule(self):
        page = self.pages["platform-reports.html"]
        self.assertIn("It does not block.", page)
        self.assertNotIn("build anyway", page.lower())

    def test_the_platform_screenshots_sit_in_the_dark_band(self):
        page = self.pages["platform.html"]
        block = page[:page.index('id="shots"')]
        self.assertTrue(block.rstrip().endswith('<div class="rshot"'))
        self.assertIn('<div class="cs-block band bleed">', block[block.rindex('<div class="cs-block'):])

    def test_the_platform_shows_real_screenshots_in_light_and_dark(self):
        page = self.pages["platform.html"]
        shots = re.findall(r'<img src="(img/platform/[^"]+)-light\.webp" class="l"', page)
        self.assertEqual(len(shots), 6)
        for shot in shots:
            self.assertIn(f'<img src="{shot}-dark.webp" class="d"', page)
            self.assertTrue((build.PROOF / f"{shot}-dark.webp").is_file(), shot)
        self.assertIn("made-up", page[page.index('id="shots"'):page.index("Why it is built the way it is")])
        for file in ("platform-spend.html", "platform-web-app.html", "platform-reports.html", "platform-audit.html"):
            self.assertIn('class="rshot-frame"', self.pages[file], file)

    def test_the_platform_shows_the_team_screens_and_the_detailed_diagram(self):
        page = self.pages["platform.html"]
        block = page[page.index('id="shots2"'):page.index('id="shots"')]
        shots = re.findall(r'<img src="(img/platform/[^"]+\.webp)" alt="[^"]+"', block)
        self.assertEqual(len(shots), 4)
        self.assertEqual(block.count("data-shot="), 4)
        self.assertEqual(block.count("(demo data)"), 4)
        self.assertIn("made up", block)
        diagram = "img/platform/00-architecture.webp"
        self.assertEqual(page.count(f'<img src="{diagram}"'), 1)
        self.assertLess(page.index(diagram), page.index('id="shots2"'))
        for shot in shots + [diagram]:
            self.assertTrue((build.PROOF / shot).is_file(), shot)
        self.assertIn('getElementById("shots2")', page)

    def test_the_job_history_matches_the_dates_on_my_profile(self):
        home = self.pages["index.html"]
        jobs = home[home.index('id="experience"'):home.index('id="skills"')]
        rows = re.findall(r'<span class="when">([^<]+)</span>\s*<div><b>([^<]+)</b>', jobs)
        self.assertEqual(rows[:4], [
            ("Jul 2026 to now", "Marketing Operations Specialist"),
            ("Nov 2024 to Jun 2026", "PPC and SEO Specialist"),
            ("May 2024 to Oct 2024", "SEO Intern"),
            ("Jun 2023 to May 2024", "Webmaster"),
        ])
        about = home[home.index('id="about"'):]
        self.assertIn("data science, optimization and machine learning", about)

    def test_a_recording_on_a_page_is_a_file_that_exists(self):
        for path, text in self.pages.items():
            for src in re.findall(r'<source src="([^"]+)"', text):
                self.assertTrue((build.PROOF / Path(path).parent / src).resolve().is_file(), f"{path} plays {src}")

    def test_no_em_dashes(self):
        for path, text in self.pages.items():
            self.assertNotIn(chr(0x2014), text, path)


if __name__ == "__main__":
    unittest.main()
