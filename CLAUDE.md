# Revenue stack demo: a measurement stack for a fictional B2B SaaS company
Everything in this repo is public. The company and all data are made up.

## Rules that always apply
- Never read, print or commit .env or any token. Use the names in .env.example.
- Never add real people, real companies, or anything from my employer.
  Five exceptions:
  - The portfolio home page (proof/generator/templates/home.html) may name me, my employer and my job history. The only work numbers allowed there are the platform's own headline numbers, the same ones the platform page states.
  - The platform pages (proof/generator/templates/platform/) may describe the operations platform I built at my employer: what it does, how it is built, what broke, and its own numbers.
  - Client case studies (proof/generator/templates/cases/) may describe work I did on a client account. The client is described by type only. Figures are percentages or ranges, never raw client numbers. No real screenshots.
  - Published case studies: where my employer has published a case study that names the client, the home page and that client's case page may name the client, link to the published page, and quote the figures it publishes. Nothing beyond what is published: no other numbers, no screenshots, no account data.
  - Named ahead of publication: Revver. My employer's case study is written and not yet live. Its page and the home page may name the client and give results as ratios or percentages. No link until the case study is live, no screenshots, no account data, and nothing that ties it to the unnamed form story.
  Outside those last two exceptions, no client names, colleague names or client data anywhere, on any page. Demos on the platform pages use made-up clients and say so.
- Small diffs. One change per commit. Tell me what changed and how to test it.
- Tests come from the spec. Never weaken or delete a test to make it pass.
- New dependency: say why, pin the version, and stop for my OK.
- If a spec in docs/ is unclear, ask. Do not guess.

## Layout
site/ tagging/ pipelines/ warehouse/ agents/ crm/ outbound/ docs/ proof/

## Commands
- site: npm run dev, npm test, npm run build
- pipelines: pytest
- warehouse: dbt build
- proof: python proof/generator/build.py, python -m unittest discover -s proof/generator -p "test_*.py"

## Done means
- The spec's acceptance checks pass and I have run them myself.
- docs/decisions.md has a line for any real choice.
