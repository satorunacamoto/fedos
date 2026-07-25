# Suggested Review Order

Merged from the audit-prep base package's own suggested order (`8e730f25`
§12), its Alpha 8041-8120 delta's additions (`6873d24f`, delta §"Suggested
external audit order"), and the Closed Beta Operations review's ranked
high-risk-path list (`docs/reviews/fedos_closed_beta_operations_audit_readiness_v1/12_audit_risk_paths_threats_protocol_inventory.md`,
`600157b9`) into one consolidated sequence. Numbering reflects suggested
priority, not mandatory order — an auditor with a narrower mandate should
still read step 1 first regardless of scope, since it is this bundle's
single largest open question.

## 1. Secret-hygiene call-site audit (highest priority, no prior review has closed this)

Trace every JS/TS call site that invokes a `SecretHandle`
`expose_bytes_for_internal_*` accessor (27 across ≥2 secret-carrying types)
and confirm the caller re-zeroizes its own local copy afterward. This is
explicitly named by the base audit-prep package as "the single largest
genuinely open cryptographic-hygiene question" and has not been
independently verified by any subsequent review.

## 2. Rust crypto core, end to end

`packages/fedos-core-rust` — Master Seed generation, Argon2id, HKDF domain
separation across Protocol Roots, BIP-340 Schnorr, the AEAD/NIP-44-style
pipeline, and the Double Ratchet primitives (session establishment, DH
ratchet step, chain-key derivation). Cross-reference against the real
`cargo test --release` suite (see [`07_reproduction_guide.md`](07_reproduction_guide.md))
and the two real bugs a prior internal review already found and fixed
pre-ship here (a session-id length overflow, a send_counter misread after
a DH step) — confirm no sibling defect of the same shape exists elsewhere
in the ratchet-header handling.

## 3. SecretHandle / SecretHandleStore exposure surface

The full 27-accessor inventory, both secret-carrying types, and whether any
accessor is reachable from a code path this bundle's architecture map does
not already account for.

## 4. Direct Ratchet establishment + NIP-17 route-binding

Confirm the authenticated route-binding field (added to resolve same-peer
multi-conversation routing as a primary key) is verified, not merely
present, on every inbound decode path — this closed a previously real
misrouting bug (see Known Issues) and is exactly the kind of protocol-level
correctness property worth independent re-verification.

## 5. Device Trust / Pairing / Sync state transitions

Registry bind/revoke transitions, the Pairing create→inspect→approve→complete
flow (now UI-reachable as of Alpha 8201-8280), and Sync's own trust-state
propagation. Cross-reference against the Archive Suppression trust model's
worked adversary reasoning (Threat Model §8) as a template for what
"correct" looks like in this codebase's own idiom.

## 6. Electron preload/main IPC surface — a PRESENT-day attack surface, not deferred

Both bridges: `window.fedosApp` (34 real, UI-driven channels) AND
`window.fedosAcceptance` (12 channels, zero UI consumer, but real, live,
`contextBridge`-exposed into the same isolated-world renderer, and
confirmed structurally permanent by this codebase's own test suite — not a
gap awaiting a future fix). Specific sub-items, ranked by the delta review:
1. Main-process input validation for `fedos-app:*` channels, especially
   object-shaped arguments (`sender`, `expectedAccountRef`) that are
   length-bounded but not shape-narrowed at the preload layer.
2. Renderer-side `window.confirm()` gates on destructive actions (Device
   revoke, Identity-transition accept) — confirm no separate, more-
   privileged IPC path exists that a compromised renderer could reach by
   skipping the confirm dialog.
3. The two `setInterval`-based polls (chat, 2s; relay-status, 3s) —
   single-instance lifecycle guarantees, correct stop-on-lock.
4. Archive file-picker path handling — confirm the only path source
   reaching `shell.archive()` is the native OS dialog's own return value,
   never a renderer-supplied string.
5. Identity-transition accept/reject/defer and Deletion-request
   approve/reject take **zero arguments** — they act on an implicit
   server-side "currently selected" item set by a separate `open()` call.
   Live-test (not just source-read) the open-A / open-B / decide race
   shape this creates; no prior review has done more than identify the
   shape.

## 7. Archive / Retention / Search data-at-rest

Confirm current status of the Envelope-vs-Payload retention-gating parity
(closed at Arc 7481-7560 for the Direct-conversation case — re-verify this
still holds on current `master`), and the Search index's plaintext
in-memory-only status (confirmed, zero `fs`/`readFileSync`/`writeFileSync`
calls in `src/conversation/search/` as of a prior grep — re-grep against
current `master` before citing as still true).

## 8. Installer / release pipeline

Checksum re-derivation (`scripts/generate_wasm_artifact_manifest.mjs` +
`scripts/verify_release_checksums.mjs`), the unsigned-installer fact
(confirm current signing status directly — a prior public-docs audit found
`README.md` once claimed real code-signing while another internal doc
stated every artifact "has been, and remains, completely unsigned"; see
Known Issues item on this exact contradiction), and the NSIS/ZIP build
pipeline's own stated preconditions (clean git tree, pre-built WASM).

## 9. Revealed-plaintext cache lifecycle (new in Alpha 8041-8120, unverified live)

The renderer keeps an already-revealed message's plaintext visible across
a 2-second poll cycle. Its lifecycle relative to `lock()` has not been
independently traced by any prior review — confirm a lock event actually
clears it from the DOM and from any in-memory cache.

## 10. Everything the Closed Beta Operations review already scoped as audit-relevant

Its own docs 10-14 (`docs/reviews/fedos_closed_beta_operations_audit_readiness_v1/`)
cover audit scope/exclusions, the architecture/build package precondition,
a ranked risk-path/threat/protocol inventory, expected deliverables and
remediation/retest/disclosure workflow, and evidence-retention/completion
criteria — read these alongside this bundle's own
[`04_evidence_index.md`](04_evidence_index.md) and
[`06_disclosure_policy.md`](06_disclosure_policy.md) rather than
re-deriving audit process/governance content this bundle already
consolidates.

## Suggested fuzz/property-test targets (carried forward, not yet built)

- `fedos-app:conversation-open` / `fedos-app:messages-list` with malformed
  or oversized `conversationId` strings.
- `fedos-app:identity-transition-open` with a malformed `peerAccountRef`
  object shape.
- `fedos-app:archive` with every combination of `operation` value against
  a malformed `request` object.
- Any NIP-17 inbound-decode fuzz target exercising malformed/truncated
  gift-wrap or route-binding-field content.
