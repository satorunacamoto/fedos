# Secure Runtime Alpha 658 — Policy and Query Review

Stage 8. `FedosBoardRuntime.recentFeed()`/`thread()`/`findPost()`
(Alpha 632) apply no policy filter today. Since only `"public"` mode is
ever constructible (Alpha 652), there is no hidden content that could
leak through an unfiltered query — every post in every Board this
codebase can hold today is, by construction, a `"public"`-mode post.

No fake private filtering is added — adding a filter with nothing to
filter would be dead code asserting a guarantee this Arc cannot back.

## Structural guard for a future private mode

A future private/direct mode MUST NOT reuse
`FedosBoardRuntime.recentFeed()`/`thread()`/`findPost()` unchanged —
those three methods take no policy/mode parameter and perform no
per-post mode check; wiring a private post into the SAME query path
without first adding a policy gate at read time would leak it. This is
recorded here as an explicit blocker future work must resolve BEFORE
any private/direct read path is added — not solved by this Arc, whose
own commands can never produce a non-`"public"` post to leak in the
first place (Alpha 652/667).
