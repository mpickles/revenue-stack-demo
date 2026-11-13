# Decisions
One line each: chose X over Y because Z, accepting T.

- Consent banner: chose two buttons (Accept all / Reject all) over per-signal toggles because the demo only needs on/off for all four signals, accepting no granular choice.
- Consent cookie: chose a 180-day first-party cookie (rw_consent) over a session cookie so a returning visitor is not asked again, accepting a stale choice for up to six months unless they use Cookie settings.
- Click IDs on a new landing: chose to replace the whole stored set (last touch) over keeping the first set because the most recent ad click is the one Google and Meta will match an offline conversion to, accepting that earlier touches are lost. A landing with no click IDs or UTMs leaves the stored set alone.
- Click IDs before consent: chose to hold them in memory only over sessionStorage because web storage is storage too and needs the same consent, accepting that a full page reload before the visitor accepts loses them.
