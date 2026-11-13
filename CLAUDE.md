# Revenue stack demo: a measurement stack for a fictional B2B SaaS company
Everything in this repo is public. The company and all data are made up.

## Rules that always apply
- Never read, print or commit .env or any token. Use the names in .env.example.
- Never add real people, real companies, or anything from my employer.
- Small diffs. One change per commit. Tell me what changed and how to test it.
- Tests come from the spec. Never weaken or delete a test to make it pass.
- New dependency: say why, pin the version, and stop for my OK.
- If a spec in docs/ is unclear, ask. Do not guess.

## Layout
site/ tagging/ pipelines/ warehouse/ agents/ docs/ proof/

## Commands
- site: npm run dev, npm test, npm run build
- pipelines: pytest
- warehouse: dbt build

## Done means
- The spec's acceptance checks pass and I have run them myself.
- docs/decisions.md has a line for any real choice.
