# Private Conversation Search V1 — Runtime Implementation Audit

Audit only. No production source, README, `package.json`, or
`Cargo.toml` change is made anywhere in this review. Every file this
review adds lives under
`docs/reviews/private_conversation_search_runtime_v1/` or
`test/reviews/private_conversation_search_runtime_v1/`. No Alpha number
is assigned to this review or to any Arc it recommends.

## What this review is, and how it differs from the prior one

`review/private-conversation-search-v1` (commit `4721077`) is a
20-document **specification review**, written before any
private-conversation search code existed, evaluating how it should be
built and recommending query-time decrypt-and-scan (Option 1), gated
through `FedosPayloadRetentionAuthority`, as the next implementable
step. Since then, an implementation has landed (staged, uncommitted at
review time): nine files under `src/conversation/search/`, authored as
"Secure Runtime Alpha 2501–2580: Conversation Search Runtime." This
review audits **that implementation** against the prior review's own
20 findings and recommendation — it is a source-code audit, not a
second from-scratch specification exercise.

## Base and worktree

Grounded directly against this worktree's own checked-out source at
tip `c889562`, plus the staged (uncommitted) Conversation Search
Runtime changes under `src/conversation/search/`,
`docs/secure_runtime_alpha_2501_2580_*.md`, and
`test/secure_runtime_alpha_2501_2580_*.test.ts`. Group Runtime and
NIP-17 delivery remain absent from this base exactly as they were on
the prior review's own base (`8c48c95`) — confirmed by direct listing,
not assumed — so Reviews 12-14 here carry forward the prior review's
own cross-branch grounding to commit `5b55ed6` unchanged.

## The one finding every other document in this review is built on

**None of the nine new files under `src/conversation/search/` imports
from, or calls, anything in `src/conversation/retention/`.** The
implementation is a persisted, in-process, plaintext-term inverted
index — the prior review's own "Option 2," the one option that
review explicitly declined to recommend at any point — built with none
of the retention-gating the prior review named, three separate times
(Reviews 11, 17, 18), as a requirement for exactly this kind of module.
This gap is reproducible with this Arc's own existing test fixtures
(Review 18) and is not named as a boundary in either
`docs/secure_runtime_alpha_2501_2580_execution_spec.md` or
`..._completion_declaration.md`, despite both documents otherwise
carefully naming other deliberate exclusions.

## How to navigate the 20 documents

| # | Document | Answers |
|---|---|---|
| 01 | `01_implementation_inventory.md` | What actually landed, file by file, and the one fact (no retention import) every later document traces from |
| 02 | `02_deviation_from_review_20.md` | Which of the prior review's three options was built, and why it is the one that was never recommended |
| 03 | `03_domain_separation_honored.md` | The one thing this implementation gets unambiguously right |
| 04 | `04_keyword_index_is_option_2.md` | Why "no new persistence" does not mean "not Option 2," with source evidence |
| 05 | `05_in_memory_lifetime_extension.md` | Why an in-process index is still a real exposure surface beyond the transient decrypt() lifetime |
| 06 | `06_local_only_placement_preserved.md` | Confirms no network/disk/cross-account query surface exists |
| 07 | `07_placement_guarantee_has_no_guardrail.md` | Why nothing stops a future Host-wiring Arc from breaking this guarantee silently |
| 08 | `08_metadata_leakage_from_stored_index.md` | What each of the seven sub-indexes actually stores, checked against the prior review's own leak taxonomy |
| 09 | `09_metadata_leakage_at_query_time.md` | `searchKeyword()`'s query argument is plaintext, confirmed from source |
| 10 | `10_archive_corpus_compatibility_confirmed.md` | Confirms the prior review's Archive-compatibility prediction, and where this implementation diverges from its hook-point architecture |
| 11 | `11_retention_bypass_risk_realized.md` | **This audit's central finding**: the retention-bypass risk the prior review predicted is now realized in shipped code |
| 12 | `12_sender_key_interaction.md` | Confirms no change to the prior review's Sender-Key-agnosticism finding |
| 13 | `13_mode_index_is_labeling_only.md` | The Mode Index classifies conversations; it does not perform Group pairwise-child aggregation |
| 14 | `14_recipient_asymmetry_unaffected.md` | Confirms sender/recipient read-model asymmetry is preserved, for a structural reason |
| 15 | `15_no_ranking_as_recommended.md` | No ranking was built, as authorized — but result ordering is not recency-consistent |
| 16 | `16_match_quality_signals_available_but_unused.md` | Match-quality scoring is available under this implementation's own Option 2 data model but deliberately unused |
| 17 | `17_deleted_conversations.md` | `removeEnvelope()` is a correct mechanism never wired to any retention-transition policy |
| 18 | `18_restored_conversations.md` | The prior review's predicted post-restore resurfacing gap, confirmed reproducible against this implementation |
| 19 | `19_future_vector_search.md` | Confirmed absent; names this implementation as a cautionary template pending Review 11's fix |
| 20 | `20_findings_summary_and_recommendation.md` | Full findings list ranked by severity, and the two-path recommendation |

## Summary of this review's conclusions

- **No production source change is made by this review** —
  `src/`, `packages/`, `README.md`, and `package.json` are untouched by
  this review's own commit; the prior implementation's own staged
  changes are left exactly as this review found them.
- **Domain separation, local-only placement, and Sender-Key/Group
  agnosticism are all genuinely honored** — this is not a wholesale
  rejection of the implementation's architecture.
- **The implementation is the prior review's Option 2, the one option
  that review explicitly declined to recommend**, and it was built
  without the retention gating that review required three times over.
- **The retention-bypass risk the prior review predicted for Archive
  restore is directly reproducible against this implementation's own
  test fixtures** — this is the single highest-priority finding.
- **Several smaller, low-cost gaps** (dead sub-index removal methods,
  non-recency result ordering, an underdocumented Group-index method)
  are named for cleanup alongside the primary fix.
- **Exactly one recommendation is made**: resolve the retention-gating
  gap — either by retrofitting a gate into this module, or by following
  the prior review's original Option 1 recommendation — before any
  Host-wiring Arc makes this module reachable from live application
  code.
