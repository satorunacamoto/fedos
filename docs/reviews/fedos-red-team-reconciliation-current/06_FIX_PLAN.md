# Fix Plan

Per fix policy: fix ONLY CURRENT_CONFIRMED findings and high-value CURRENT_PARTIAL findings.
Do not touch STALE_FIXED/STALE_SUPERSEDED/FALSE_POSITIVE findings. Do not attempt
architectural work already deliberately deferred by a prior arc's own decision record.

## In scope for this fix pass

| Finding | Fix | Owner | Files (disjoint) |
|---|---|---|---|
| P0-B (false Sent) | Renderer's `onChatSend()` must branch on `result.value.delivery`, not just `result.outcome` | Agent B | `fedos_electron_beta_renderer.ts` |
| P1-5 (backup notice dropped) | Forward `recoveryNotice` through `readyResult()`; render it in the ready-state UI | Agent B | `fedos_electron_beta_main.cts`, `fedos_electron_beta_renderer.ts`, `fedos_electron_beta_page.html` |
| P0-A/P1 (old-key silent auto-accept) | Require an explicit local decision before an old-key-continuity observation reaches `"accepted"`, instead of falling through the default policy | Agent A | `fedos_identity_transition_acceptance_state.ts` (and/or `fedos_identity_transition_evidence_evaluation.ts`, whichever is the minimal correct seam) |
| P1-7 (device revocation doesn't quarantine ratchet sessions) | Call `applyDeviceRevocationToSessions()` from `revokeDevice()` | Agent A | `fedos_device_pairing_facade.ts` and/or `fedos_device_binding_registration_authority.ts` |
| P1-1 (inbound validator unwired) | Wire `combined_inbound_event_validator` (or its real current equivalent) into the actual Direct Conversation inbound path; add negative tests (bad id, bad sig, oversize, duplicate) | Agent C | `fedos_conversation_inbound_subscription.ts` + new/extended test file |

## Explicitly deferred (not fixed this pass — documented, not silently dropped)

- **Own-Device Sync transport never wired** — a prior arc (`da693504`/`8712add7`) already
  investigated this and deliberately chose "Option B" (truthful failure reporting) over
  "Option A" (wiring the real transport) due to a genuine data-shape incompatibility
  between the Scheduler's sequence-ranged attempt function and the relay coordinator's
  whole-snapshot shape. Re-litigating that architecture decision is out of scope for a
  red-team fix pass; it is correctly disclosed as a known P1 gap, not silently re-fixed
  under a different implementation.
- **Default send route lacking forward secrecy (P1-6)** — architectural, requires
  cross-account peer-Device discovery that doesn't exist yet; explicitly named as
  Migration Plan Phase 2 in the route module's own header. Out of scope for a fix pass;
  remains a disclosed, known limitation.
- **Inbound WebSocket message-size cap** — no existing max-event-size primitive/
  documented limit was found to reuse; per instruction not to invent an undocumented
  magic number, this is left as a documented P2 recommendation rather than implemented
  with an arbitrary value.
- **CI thinness (P1-4)** — architectural (would need a new CI job building Rust/WASM/
  packaging); out of scope for a source fix pass. Local release pipeline already
  mitigates this.
- **WASM glue-file integrity gap** — fixing this correctly requires extending the
  manifest schema, the generator script, and the activation authority together, which
  touches the same trust-root machinery the WASM `.wasm` hash relies on; given the risk
  of a mistake here undermining the one integrity check that does work, this is flagged
  as a recommended follow-up rather than rushed in this pass.
- **Install/upgrade/uninstall never tested (P1-2)** — requires a live interactive
  Windows install; attempted separately in the release-gates phase where feasible, not
  as a "source fix."
- Various P2/INFO items (safety-number label, identity-replacement broadcast unreachable,
  `ws://` no warning, NIP-42 AUTH absent, rotation-vs-replacement terminology, stale Tor
  doc claims) — left as documented findings for a future pass; none meet the "high-value"
  bar for this focused P0/P1 closure arc.

## Parallel fix execution

Agent A and Agent B and Agent C touch fully disjoint file sets (see table). Coordinator
(this session) reviews all diffs before running release gates, and owns any file that
would otherwise be touched by more than one agent (none identified — the plan above was
constructed specifically to avoid overlap, e.g. all `fedos_electron_beta_renderer.ts`
changes are owned by a single agent (B) rather than split).
