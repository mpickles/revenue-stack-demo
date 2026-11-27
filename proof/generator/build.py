"""Builds the proof site: the home page and one write-up page per build.

Each write-up page is made from that build's README, so a write-up is written once.
The tile text for the home page is in builds.json. The diagrams are the SVG files
in diagrams/. The finished pages are plain HTML files and are committed.

    python proof/generator/build.py           writes the pages
    python proof/generator/build.py --check   changes nothing, fails if a page is out of date
"""

import html
import json
import posixpath
import re
import sys
from pathlib import Path
from string import Template

from markdown_it import MarkdownIt

GENERATOR = Path(__file__).resolve().parent
PROOF = GENERATOR.parent
REPO_ROOT = PROOF.parent

# The words a README may use on its "Status:" line, and how each one is shown.
STATUSES = {
    "planned": ("Planned", "is-planned"),
    "in progress": ("In progress", "is-active"),
    "live": ("Live", "is-live"),
}


def load_config():
    return json.loads((GENERATOR / "builds.json").read_text(encoding="utf-8"))


def read_status(readme_text):
    """Returns the status word from the README's 'Status: ...' line."""
    match = re.search(r"^Status:\s*(planned|in progress|live)\b", readme_text, re.MULTILINE | re.IGNORECASE)
    if not match:
        raise ValueError("README has no line starting with 'Status: planned', 'Status: in progress' or 'Status: live'")
    return match.group(1).lower()


def github_url(repo, path):
    """A folder opens as a tree on GitHub and a file as a blob."""
    kind = "tree" if (REPO_ROOT / path).is_dir() else "blob"
    return f"{repo}/{kind}/main/{path}"


def is_relative(href):
    return not re.match(r"^([a-z][a-z0-9+.-]*:|#|/)", href, re.IGNORECASE)


def render_readme(readme_text, readme_path, repo):
    """Turns a README into (title, body HTML).

    Three things change on the way: the first heading becomes the page title,
    mermaid blocks are dropped because the page shows its own diagram, and
    links to other files in the repo are pointed at GitHub.
    """
    md = MarkdownIt("commonmark", {"html": False}).enable("table")
    md.add_render_rule("table_open", lambda *args: '<div class="tw"><table>\n')
    md.add_render_rule("table_close", lambda *args: "</table></div>\n")
    tokens = md.parse(readme_text)

    title = None
    kept = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if title is None and token.type == "heading_open" and token.tag == "h1":
            title = tokens[i + 1].content
            i += 3  # heading_open, inline, heading_close
            continue
        if token.type == "fence" and token.info.strip() == "mermaid":
            i += 1
            continue
        kept.append(token)
        i += 1
    if title is None:
        raise ValueError(f"{readme_path} has no '# ' heading to use as the page title")

    readme_dir = posixpath.dirname(readme_path)
    for token in kept:
        for child in token.children or []:
            if child.type == "link_open":
                href = child.attrGet("href")
                if href and is_relative(href):
                    target = posixpath.normpath(posixpath.join(readme_dir, href))
                    child.attrSet("href", github_url(repo, target))

    return title, md.renderer.render(kept, md.options, {})


def case_cards_html(cases):
    """The client work cards on the home page. Each shows, small, the picture its page opens on."""
    order = sorted(cases, key=lambda c: 0 if c.get("published") else 1 if c.get("pending") else 2)
    out = ['<div class="case-cards" data-stagger>']
    for case in order:
        body = (GENERATOR / "templates" / "cases" / case["file"]).read_text(encoding="utf-8")
        start = body.index("<svg", body.index('<figure class="cs-hero"'))
        svg = body[start:body.index("</svg>", start) + 6]
        svg = re.sub(r' role="img" aria-label="[^"]*"', ' aria-hidden="true"', svg, count=1)
        note = "Published" if case.get("published") else "Coming soon" if case.get("pending") else "Not named"
        out.append(f'  <a class="cover-card case-card" href="{case["file"]}"><span class="cs-hero thumb" data-reveal>{svg}</span>'
                   f'<span class="body"><b>{html.escape(case["card"], quote=False)}</b>'
                   f'<span class="meta"><span>{html.escape(case["kind"])}</span><span>{note}</span></span></span></a>')
    out.append("</div>")
    return "\n".join(out)


def indent(text, spaces):
    pad = " " * spaces
    return "\n".join(pad + line if line else line for line in text.splitlines())


def template(name):
    return Template((GENERATOR / "templates" / name).read_text(encoding="utf-8"))


def diagram(name):
    return (GENERATOR / "diagrams" / f"{name}.svg").read_text(encoding="utf-8").strip()


def link_url(link, repo):
    return link["url"] if "url" in link else github_url(repo, link["path"])


def cover(name, grows=False):
    """A drawn cover, kept as an SVG file in covers/. With grows, it carries a name the browser uses to
    grow it from a card into the top of the page it opens (same name on both pages)."""
    art = (GENERATOR / "covers" / f"{name}.svg").read_text(encoding="utf-8").strip()
    if grows:
        art = art.replace('<svg class="art"', f'<svg class="art" style="view-transition-name:cover-{name}"', 1)
    return art


def card_html(build, status):
    """One part of the project on the home page: its cover, what it does, where it stands and what it is built with."""
    e = html.escape
    text, css = STATUSES[status]
    off = " off" if status == "planned" else ""
    return (
        f'<a class="cover-card{off}" href="builds/{build["slug"]}.html">{cover(build["slug"], grows=True)}'
        f'<span class="body"><b>{e(build["card_title"])}</b>'
        f'<span class="meta"><span class="status {css}">{text}</span><span>{e(build["tools"])}</span></span></span></a>'
    )


def bullets(items):
    return "".join(f"<li>{html.escape(item)}</li>" for item in items)


def summary_html(summary, tools):
    """The short version at the top of a write-up: what I did, then three bullets each for the problem, the build and the choices."""
    e = html.escape
    strip = (
        '    <dl class="cs-strip">\n'
        f'      <div><dt>What I did</dt><dd>{e(summary["did"])}</dd></div>\n'
        f'      <div><dt>Built with</dt><dd>{e(tools)}</dd></div>\n'
        "    </dl>"
    )
    cols = (
        '    <div class="cs-cols" data-stagger>\n'
        f'      <section><h2>The problem</h2><ul>{bullets(summary["problem"])}</ul></section>\n'
        f'      <section><h2>What I built</h2><ul>{bullets(summary["built"])}</ul></section>\n'
        f'      <section><h2>Three choices</h2><ul>{bullets(summary["choices"])}</ul></section>\n'
        "    </div>"
    )
    return strip, cols


def project_facts_html(project, statuses):
    """The facts beside the project on the home page. A result or a recording gets a row only once it exists."""
    e = html.escape
    status = statuses[0] if len(set(statuses)) == 1 else "in progress"
    text, css = STATUSES[status]
    rows = [f'<div><dt>Status</dt><dd><span class="status {css}">{text}</span></dd></div>']
    if project.get("headline"):
        rows.append(f'<div><dt>Result</dt><dd>{e(project["headline"])}</dd></div>')
    rows.append(f'<div><dt>Built with</dt><dd>{e(project["built_with"])}</dd></div>')
    if project.get("recording"):
        rows.append(f'<div><dt>Watch</dt><dd><a href="{e(project["recording"])}">Two-minute walkthrough</a></dd></div>')
    return "\n".join(rows)


def portrait_html():
    """The photo beside the name. Nothing is drawn until proof/img/portrait.webp exists."""
    if not (PROOF / "img" / "portrait.webp").is_file():
        return ""
    return '        <img class="portrait" src="img/portrait.webp" alt="Max Pickard" width="608" height="760">\n'


def notes_html(notes):
    """The Notes section lists only notes that are written (they have an href). With none, there is no section."""
    e = html.escape
    written = [n for n in notes if n.get("href")]
    if not written:
        return ""
    items = "\n".join(f'        <li><a href="{e(n["href"])}"><b>{e(n["title"])}</b></a></li>' for n in written)
    return (
        '    <section class="sec" id="notes"><div class="wrap">\n      <h2>Notes</h2>\n'
        '      <p class="sub">Short write-ups of things I worked out while building.</p>\n'
        f'      <ul class="notes-list" data-stagger>\n{items}\n      </ul>\n    </div></section>\n\n'
    )


def journey_html(project, builds, status_of):
    """The lead's path on the project page: one stop per part, in the order a lead meets them."""
    e = html.escape
    stops, data = [], []
    last = len(project["journey"]) - 1
    for index, step in enumerate(project["journey"]):
        text, css = STATUSES[status_of[step["slug"]]]
        stops.append(
            f'<button type="button" class="stop" data-step="{index}">{cover(step["slug"], grows=True)}'
            f'<span class="stop-cap"><b><i>{index + 1}</i>{e(step["short"])}</b></span></button>'
            + ('<div class="link"><i class="ln"></i></div>' if index < last else "")
        )
        data.append({
            "slug": step["slug"], "name": step["name"], "why": step["why"], "gets": step["gets"],
            "out": step["hands_on"], "status": text, "css": css,
        })
    # "</" must not appear inside a script element, even as data.
    return "\n".join(stops), json.dumps(data).replace("</", "<\\/")


def crumb_html(home, parent_href, parent, here, total):
    """Where this page sits, said once at the very top: the way home, the project it belongs to, and which part it is."""
    e = html.escape
    return (
        '<nav class="crumb" aria-label="Breadcrumb">'
        f'<a href="{home}">Work</a><span aria-hidden="true">/</span>'
        f'<a href="{parent_href}">{e(parent)}</a><span aria-hidden="true">/</span>'
        f'<span aria-current="page">Part {here} of {total}</span></nav>'
    )


def sits_html(project, slug):
    """The breadcrumb on a part's write-up: the project it belongs to and which part it is."""
    order = [step["slug"] for step in project["journey"]]
    return "    " + crumb_html("../index.html#work", "../project.html", "Revenue stack", order.index(slug) + 1, len(order))


def platform_tiles_html(platform):
    """One tile per part of the platform: same number, name and order as the boxes on its map."""
    e = html.escape
    return "\n".join(
        f'<a class="wf-card cover-card" href="{e(part["file"])}">{cover("pf-" + part["slug"], grows=True)}'
        f'<span class="body"><b><i>{index + 1}</i>{e(part["name"])}</b><span class="line">{e(part["line"])}</span>'
        f'<span class="meta"><span class="status is-live">Live</span><span>{e(part["tools"])}</span></span></span></a>'
        for index, part in enumerate(platform["parts"])
    )


def proof_html(builds):
    """Real results only. The section is left out until at least one build has a headline."""
    items = [f'<li>{html.escape(b["tile"])}: {html.escape(b["headline"])}</li>' for b in builds if b.get("headline")]
    if not items:
        return ""
    return (
        '\n    <section class="sec"><div class="wrap">\n      <h2>Proof, in one line each</h2>\n      <ul class="proof">\n        '
        + "\n        ".join(items) + "\n      </ul>\n    </div></section>\n"
    )


def contact_html(contact, slim=False):
    """Shown only once an email or a LinkedIn address is set in builds.json. Inner pages get the slim one."""
    e = html.escape
    if not (contact.get("email") or contact.get("linkedin")):
        return ""
    lines = ['', f'    <section class="contact{" slim" if slim else ""}" id="contact"><div class="wrap">', "      <h2>Say hello</h2>"]
    if contact.get("email"):
        lines.append(f'      <a class="mail" href="mailto:{e(contact["email"])}">{e(contact["email"])}</a>')
        lines.append(f'      <small><button type="button" class="copy" data-copy="{e(contact["email"])}">Copy the address</button> <span id="copied" aria-live="polite"></span></small>')
    foot = []
    if contact.get("linkedin"):
        foot.append(f'<a href="{e(contact["linkedin"])}">LinkedIn</a>')
    foot.append("<span>Chicago</span>")
    lines.append('      <div class="foot">' + "".join(foot) + "</div>")
    lines.append("    </div></section>")
    return "\n".join(lines)


def contact_links_html(contact):
    """The short links under the name."""
    e = html.escape
    parts = []
    if contact.get("email"):
        parts.append(f'<button type="button" class="copy" data-copy="{e(contact["email"])}">Copy email</button>')
    if contact.get("linkedin"):
        parts.append(f'<a href="{e(contact["linkedin"])}">LinkedIn</a>')
    return "".join(parts)


# The platform's banner is the same real screen as its card on the home page, so the card grows into it.
PLATFORM_SHOT = (
    '<span class="shot-frame" style="view-transition-name:cover-platform">'
    '<img class="l" src="img/platform/04-client-overview-light.webp" alt="The platform\'s client overview screen, shown with made-up clients" width="1600" height="1000">'
    '<img class="d" src="img/platform/04-client-overview-dark.webp" alt="The platform\'s client overview screen in dark mode, shown with made-up clients" width="1600" height="1000">'
    "</span>"
)


def with_preview(path, text, config):
    """What a link to this page shows when it is pasted somewhere: a line of description, a picture and a tab icon."""
    e = html.escape
    title = re.search(r"<title>(.*?)</title>", text, re.S).group(1)
    parts = {p["file"]: p for p in config["platform"]["parts"]}
    builds = {f'builds/{b["slug"]}.html': b for b in config["builds"]}
    if path in parts:
        line = f'{parts[path]["name"]}. {parts[path]["line"]}. Part of the operations platform I built at work.'
    elif path == "platform.html":
        line = config["platform"]["description"]
    elif path == "project.html":
        line = config["project"]["sentence"].split(". ")[0].rstrip(".") + "."  # the first sentence fits a preview
    elif path in builds:
        line = builds[path].get("card_title") or builds[path]["tile"]
    elif path == "colophon.html":
        line = "How this site was made: the type, the colour, the drawings and the build."
    elif path in {c["file"]: c for c in config.get("cases", [])}:
        line = next(c["description"] for c in config["cases"] if c["file"] == path)
    else:
        line = config["description"]
    site = config["site"].rstrip("/")
    url = site + "/" + ("" if path == "index.html" else path)
    tags = "\n".join([
        f'  <meta name="description" content="{e(line)}">',
        f'  <meta property="og:title" content="{title}">',
        f'  <meta property="og:description" content="{e(line)}">',
        '  <meta property="og:type" content="website">',
        f'  <meta property="og:url" content="{e(url)}">',
        f'  <meta property="og:image" content="{site}/img/og.png">',
        '  <meta property="og:image:width" content="1200">',
        '  <meta property="og:image:height" content="630">',
        '  <meta name="twitter:card" content="summary_large_image">',
        '  <link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    ])
    head, sep, rest = text.partition("</title>\n")
    assert sep, path
    return head + sep + tags + "\n" + rest


def build_pages():
    """Returns every page as {path inside proof/: HTML text}. Writes nothing."""
    config = load_config()
    repo = config["repo"]
    builds = config["builds"]
    style = indent((GENERATOR / "templates" / "style.css").read_text(encoding="utf-8").strip(), 4)
    script = indent((GENERATOR / "templates" / "script.js").read_text(encoding="utf-8").strip(), 4)
    e = html.escape

    rendered = []
    for build in builds:
        readme_text = (REPO_ROOT / build["readme"]).read_text(encoding="utf-8")
        title, body = render_readme(readme_text, build["readme"], repo)
        rendered.append({"title": title, "body": body, "status": read_status(readme_text)})

    pages = {}
    contact_config = config.get("contact") or {}
    contact = contact_html(contact_config)
    inner_contact = contact_html(contact_config, slim=True)
    inner_nav = '<a href="#contact">Contact</a>' if inner_contact else ""
    status_of = {b["slug"]: r["status"] for b, r in zip(builds, rendered)}
    project = config["project"]
    cards = [card_html(b, status_of[b["slug"]]) for b in builds]
    started = sum(1 for r in rendered if r["status"] != "planned")
    pages["index.html"] = template("home.html").substitute(
        style=style,
        script=script,
        repo=repo,
        demo=config["demo"],
        proof=proof_html(builds),
        project_title=e(project["title"]),
        project_sentence=e(project["sentence"]),
        project_facts=indent(project_facts_html(project, [r["status"] for r in rendered]), 10),
        parts=str(len(builds)),
        started=str(started),
        covers=indent("\n".join(cards), 8),
        platform_cover=cover("platform", grows=True),
        platform_tiles=indent(platform_tiles_html(config["platform"]), 8),
        platform_count=str(len(config["platform"]["parts"])),
        case_cards=indent(case_cards_html(config.get("cases", [])), 6),
        project_cover=cover("project", grows=True),
        project_cover_plain=cover("project"),
        project_hidden=" hidden" if project.get("hidden") else "",
        contact=contact,
        portrait=portrait_html(),
        notes=notes_html(config.get("notes", [])),
        notes_nav='<a href="#notes">Notes</a>' if notes_html(config.get("notes", [])) else "",
        contact_nav='<a href="#contact">Contact</a>' if contact else "",
        contact_links=contact_links_html(contact_config),
    )

    for index, (build, page) in enumerate(zip(builds, rendered)):
        status_text, status_class = STATUSES[page["status"]]

        if build.get("headline"):
            label, value = "Result", build["headline"]
        else:
            label, value = "Not graded yet. It will be graded on", build["graded_on"]
        headline = (
            f'    <div class="headline">\n      <p class="headline-label">{e(label)}</p>\n'
            f'      <p class="headline-value">{e(value)}</p>\n    </div>'
        )

        recording = ""  # nothing is shown until a recording exists
        if build.get("recording"):
            recording = (
                f'    <div class="recording">\n      <video controls preload="metadata" src="{e(build["recording"])}"></video>\n    </div>'
            )

        # A build can swap its static diagram for a scroll-drawn scene kept in templates/.
        if build.get("scene"):
            figure = indent((GENERATOR / "templates" / build["scene"]).read_text(encoding="utf-8").strip(), 4)
        else:
            figure = '    <div class="figure">\n' + indent(diagram(build["slug"]), 6) + "\n    </div>"

        image = ""
        if build.get("image"):
            shot = build["image"]
            image = (
                f'    <figure class="frame">\n      <img src="../{e(shot["src"])}" width="{shot["width"]}" height="{shot["height"]}" loading="lazy" alt="{e(shot["alt"])}">\n'
                f'      <figcaption>{e(shot["caption"])}</figcaption>\n    </figure>'
            )

        links = [f'<li><a href="{e(link_url(link, repo))}">{e(link["label"])}</a></li>' for link in build["links"]]

        pager = []
        if index > 0:
            before = builds[index - 1]
            pager.append(f'<a class="prev" href="{before["slug"]}.html"><span>Before</span>{e(before["tile"])}</a>')
        if index < len(builds) - 1:
            after = builds[index + 1]
            pager.append(f'<a class="next" href="{after["slug"]}.html"><span>Next</span>{e(after["tile"])}</a>')

        article = (
            '    <article class="prose">\n' + indent(page["body"].strip(), 6) + '\n      <h2>In the repo</h2>\n'
            '      <ul class="repo-links">\n' + indent("\n".join(links), 8) + "\n      </ul>\n    </article>"
        )
        title = page["title"]
        if build.get("summary"):
            # Short version first. The README is still there, folded under "Full notes".
            strip, cols = summary_html(build["summary"], build["tools"])
            title = build["card_title"]
            notes = '    <details class="full">\n      <summary>Full notes from the repo</summary>\n' + article + "\n    </details>"
            sections = [strip, headline, image, cols, figure, recording, notes]
        else:
            sections = [headline, recording, figure, image, article]
        banner = sits_html(project, build["slug"]) + f'\n    <div class="page-cover">{cover(build["slug"], grows=True)}</div>'

        pages[f'builds/{build["slug"]}.html'] = template("build.html").substitute(
            style=style,
            script=script,
            title=e(title),
            readme=build["readme"],
            folder_url=github_url(repo, posixpath.dirname(build["readme"])),
            status_class=status_class,
            status_text=status_text,
            banner=banner,
            sections="\n".join(s for s in sections if s),
            pager=indent("\n".join(pager), 6),
            contact=inner_contact,
            contact_nav=inner_nav,
        )

    # The platform pages are written by hand in templates/platform/ and wrapped in the shared shell.
    platform_style = indent((GENERATOR / "templates" / "platform.css").read_text(encoding="utf-8").strip(), 4)
    app_demo = (GENERATOR / "templates" / "platform" / "_app.html").read_text(encoding="utf-8").rstrip()
    app_script = indent((GENERATOR / "templates" / "platform-app.js").read_text(encoding="utf-8").strip(), 4)
    for item in config["platform"]["pages"]:
        body = (GENERATOR / "templates" / "platform" / item["file"]).read_text(encoding="utf-8").rstrip()
        body = body.replace("$$COVER$$", PLATFORM_SHOT)
        part = next((p for p in config["platform"]["parts"] if p["file"] == item["file"]), None)
        if part:  # a part page opens with its own drawing, the one its tile grows into
            head = '<main class="writeup"><div class="wrap">\n'
            assert body.startswith(head), item["file"]
            parts = config["platform"]["parts"]
            at = parts.index(part)
            crumb = crumb_html("index.html#work", "platform.html#hub", "Upgrow operations platform", at + 1, len(parts))
            body = head + crumb + f'\n<div class="page-cover">{cover("pf-" + part["slug"], grows=True)}</div>\n' + body[len(head):]
            links = []
            if at > 0:
                links.append(f'<a class="prev" href="{e(parts[at - 1]["file"])}"><span>Previous</span>{at}. {e(parts[at - 1]["name"])}</a>')
            links.append('<a class="all" href="platform.html#hub"><span>Map</span>All six parts</a>')
            if at < len(parts) - 1:
                links.append(f'<a class="next" href="{e(parts[at + 1]["file"])}"><span>Next</span>{at + 2}. {e(parts[at + 1]["name"])}</a>')
            tail = "</div></main>"
            assert body.count(tail) == 1, item["file"]
            body = body.replace(tail, '<nav class="pager" aria-label="Other parts">' + "".join(links) + "</nav>\n" + tail)
        body = body.replace("$$TILES$$", indent(platform_tiles_html(config["platform"]), 10))
        body = re.sub(
            r"\$\$APP(?::(\w+))?\$\$",
            lambda m: app_demo.replace("$$START$$", m.group(1) or "pacing").replace("$$ONLY$$", m.group(1) or ""),
            body,
        )
        pages[item["file"]] = template("platform-shell.html").substitute(
            style=style, platform_style=platform_style, script=script, title=e(item["title"]), file=item["file"], body=body, contact=inner_contact, contact_nav=inner_nav,
            app_script=app_script if 'id="app"' in body or 'id="shots"' in body else "",
        )

    for case in config.get("cases", []):  # client work, with no client named
        body = (GENERATOR / "templates" / "cases" / case["file"]).read_text(encoding="utf-8")
        pages[case["file"]] = template("platform-shell.html").substitute(
            style=style, platform_style=platform_style, script=script, title=e(case["title"]), file="cases/" + case["file"], body=body, app_script="", contact=inner_contact, contact_nav=inner_nav,
        )

    stops, journey = journey_html(project, builds, status_of)
    part_links = "\n".join(
        f'        <li><a href="builds/{e(step["slug"])}.html"><i>{n}</i>{e(step["short"])}</a><span class="status {STATUSES[status_of[step["slug"]]][1]}">{STATUSES[status_of[step["slug"]]][0]}</span></li>'
        for n, step in enumerate(project["journey"], 1)
    )
    first = project["journey"][0]
    first_text, first_class = STATUSES[status_of[first["slug"]]]
    pages["project.html"] = template("project.html").substitute(
        part_links=part_links,
        contact=inner_contact,
        contact_nav=inner_nav,
        style=style,
        script=script,
        repo=repo,
        title=e(project["title"]),
        banner=cover("project", grows=True),
        parts=str(len(builds)),
        started=str(started),
        own=e(project["own"]),
        tldr_problem=e(project["tldr"][0]),
        tldr_built=e(project["tldr"][1]),
        tldr_result=e(project["tldr"][2]) if project["tldr"][2] else '<span class="slot">To come once graded</span>',
        facts=indent("\n".join([
            f'<div><dt>Built with</dt><dd>{e(project["built_with"])}</dd></div>',
            "<div><dt>Team</dt><dd>One. Me</dd></div>",
            *([f'<div><dt>Result</dt><dd>{e(project["headline"])}</dd></div>'] if project.get("headline") else []),
        ]), 6),
        stops=indent(stops, 8),
        journey=journey,
        first_class=first_class,
        first_status=first_text,
        first_name=e(first["name"]),
        first_why=e(first["why"]),
        first_slug=first["slug"],
        first_tile=e(builds[0]["tile"]),
        first_gets=e(first["gets"]),
        first_out=e(first["hands_on"]),
        choices=indent("\n".join(
            f'<article><div class="c"><small>Because</small><b>{e(c)}</b></div><div class="d"><small>So</small><b>{e(d)}</b><p>{e(t)}</p></div></article>'
            for c, d, t in project["choices"]
        ), 8),
    )

    pages["colophon.html"] = template("colophon.html").substitute(style=style, script=script, contact=inner_contact, contact_nav=inner_nav)

    # Vercel serves 404.html for any address that does not exist. It can be reached at any depth, so its links start from the root.
    missing = template("platform-shell.html").substitute(
        style=style, platform_style=platform_style, script=script, title="Page not found", file="notfound.html",
        body=(GENERATOR / "templates" / "notfound.html").read_text(encoding="utf-8").rstrip(),
        app_script="", contact=inner_contact, contact_nav=inner_nav,
    )
    pages["404.html"] = missing.replace("<head>", '<head>\n  <base href="/">', 1)

    return {path: with_preview(path, text, config).rstrip() + "\n" for path, text in pages.items()}


def out_of_date(pages):
    """Lists pages whose committed copy differs from a fresh build, plus stray pages."""
    problems = []
    for path, text in pages.items():
        file = PROOF / path
        if not file.exists():
            problems.append(f"missing: proof/{path}")
        elif file.read_text(encoding="utf-8") != text:
            problems.append(f"out of date: proof/{path}")
    for file in sorted((PROOF / "builds").glob("*.html")):
        if f"builds/{file.name}" not in pages:
            problems.append(f"not in builds.json: proof/builds/{file.name}")
    return problems


def main(argv):
    pages = build_pages()
    if "--check" in argv:
        problems = out_of_date(pages)
        for problem in problems:
            print(problem)
        if problems:
            print("Run: python proof/generator/build.py")
            return 1
        print(f"{len(pages)} pages are up to date")
        return 0
    for path, text in pages.items():
        file = PROOF / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote proof/{path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
