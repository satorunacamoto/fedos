# `src/os/messenger/onion/` — RESERVED, empty seam

No Tor/onion-routing implementation exists anywhere in this repository
today. A repo-wide search for onion-routing code turns up only design-notes
documentation (prior arc's own finding: "onion corpus is 6,050 lines of
zero code" — docs only, no implementation). This directory is a
deliberately empty, reserved seam for a future arc that actually builds
onion-routing transport support for the messenger capability — it exists so
that arc has an obvious, pre-agreed place to land without a naming
discussion, not because anything is scheduled to fill it.

Do not invent code here to make the directory non-empty. An empty reserved
directory that accurately says "nothing exists yet" is more useful than a
stub that implies partial support.

RESERVED — no source maps here; see
`docs/architecture/MESSENGER-ARCHITECTURE.md` for how this seam fits the
rest of the messenger boundary.
