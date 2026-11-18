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
    "live": ("Live", "is-active"),
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


def indent(text, spaces):
    pad = " " * spaces
    return "\n".join(pad + line if line else line for line in text.splitlines())


def template(name):
    return Template((GENERATOR / "templates" / name).read_text(encoding="utf-8"))


def diagram(name):
    return (GENERATOR / "diagrams" / f"{name}.svg").read_text(encoding="utf-8").strip()


def link_url(link, repo):
    return link["url"] if "url" in link else github_url(repo, link["path"])


def row_html(build, status):
    """One line per build in the list on the home page."""
    text, css = STATUSES[status]
    e = html.escape
    return (
        f'<li class="{css}"><b><a href="builds/{build["slug"]}.html">{e(build["tile"])}</a></b>'
        f'<p>{e(build["sentence"])}</p><span class="status {css}">{text}</span></li>'
    )


def project_facts_html(project, statuses):
    """The facts beside the project on the home page. A missing result or recording shows as a marked empty slot."""
    e = html.escape
    status = statuses[0] if len(set(statuses)) == 1 else "in progress"
    text, css = STATUSES[status]
    result = e(project["headline"]) if project.get("headline") else '<span class="slot">To come once graded</span>'
    watch = (
        f'<a href="{e(project["recording"])}">Two-minute walkthrough</a>'
        if project.get("recording")
        else '<span class="slot">Walkthrough to come</span>'
    )
    return "\n".join([
        f'<div><dt>Status</dt><dd><span class="status {css}">{text}</span></dd></div>',
        f"<div><dt>Result</dt><dd>{result}</dd></div>",
        f'<div><dt>Built with</dt><dd>{e(project["built_with"])}</dd></div>',
        f"<div><dt>Watch</dt><dd>{watch}</dd></div>",
    ])


def proof_html(builds):
    """Real results only. The section is left out until at least one build has a headline."""
    items = [f'<li>{html.escape(b["tile"])}: {html.escape(b["headline"])}</li>' for b in builds if b.get("headline")]
    if not items:
        return ""
    return (
        '\n    <section class="sec"><div class="wrap">\n      <h2>Proof, in one line each</h2>\n      <ul class="proof">\n        '
        + "\n        ".join(items) + "\n      </ul>\n    </div></section>\n"
    )


def contact_html(contact):
    """Shown only once an email or a LinkedIn address is set in builds.json."""
    e = html.escape
    if not (contact.get("email") or contact.get("linkedin")):
        return ""
    lines = ['', '    <section class="contact" id="contact"><div class="wrap">', "      <h2>Say hello</h2>"]
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
    status_of = {b["slug"]: r["status"] for b, r in zip(builds, rendered)}
    project = config["project"]
    rows = [row_html(b, status_of[b["slug"]]) for b in builds]
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
        rows=indent("\n".join(rows), 8),
        contact=contact,
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

        recording = '    <div class="recording"><div class="slot-box wide"><span>Two-minute walkthrough to come</span></div></div>'
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

        pages[f'builds/{build["slug"]}.html'] = template("build.html").substitute(
            style=style,
            script=script,
            title=e(page["title"]),
            readme=build["readme"],
            folder_url=github_url(repo, posixpath.dirname(build["readme"])),
            status_class=status_class,
            status_text=status_text,
            headline=headline,
            recording=recording,
            image=image,
            figure=figure,
            body=indent(page["body"].strip(), 6),
            links=indent("\n".join(links), 8),
            pager=indent("\n".join(pager), 6),
        )

    return {path: text.rstrip() + "\n" for path, text in pages.items()}


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
