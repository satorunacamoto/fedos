# Secure Runtime Alpha 400 — Desktop Host Write Coordination Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
391–400 Desktop Host Durable Write Coordination Arc.**

## 1. Why now

Alpha 391 inventoried the exact write-responsibility gap. Alpha 392
decided the Host coordinates writes directly (Option A). Alpha 393
fixed the transaction order — `Validate → Persistence → Repository →
Query visibility → Success`, Persistence strictly before Repository.
Alpha 394 named every failure shape's own expected behavior. Alpha
395 implemented `FedosBoardService.previewRegistration()` and
`FedosDesktopHost.submitPost()`. Alpha 396–399 verified visibility,
protocol neutrality, atomicity, and full write-restart-hydrate-query
integration, each by real execution. This Stage freezes every finding.

## 2. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.**

- **Host is the single owner of Canonical Board write coordination** —
  `submitPost()` (Alpha 395) is the one new write boundary, adopted
  directly on `FedosDesktopHost` (Option A, Alpha 392), coordinating
  `FedosBoardPersistence` and `FedosBoardService`'s own Repository in
  one call.
- **Transaction order fixed and justified** — Alpha 393: Persistence
  strictly before Repository, because Persistence has no delete method
  and only THAT ordering keeps every reachable failure recoverable by
  a future restart rather than a silent, permanent loss.
- **Fail Closed, no silent repair, no invented recovery** — Alpha 394:
  every named failure shape (duplicate, conflict, exception,
  Persistence failure) is either structurally eliminated by the
  adopted order or handled as an established, honest, returned token;
  the one theoretical invariant-violation case throws rather than
  repairing anything.
- **Immediate Query visibility, no rebuild/reload/restart** — Alpha
  396, confirmed a direct structural consequence of `FedosBoardQuery`
  and the write path sharing one live `FedosBoardService` instance,
  verified by direct synchronous execution.
- **Protocol neutrality preserved for writes** — Alpha 397, real
  fixtures from all four Board Adapters (Nostr, ActivityPub, AT
  Protocol, Session) submit through the exact same `submitPost()` call,
  zero protocol-specific branch anywhere in the Host or Service.
- **Atomicity verified by real execution** — Alpha 398: duplicate,
  conflict, a thrown Persistence exception, and a real Persistence I/O
  failure all leave Persistence and Repository/Query in agreement, with
  no partial success in any reachable case.
- **Full write-restart-hydrate-query integration verified** — Alpha
  399, against a REAL `AppendOnlyFedosBoardPersistence`: a post
  written via `submitPost()` by one Host instance is fully preserved
  and visible via a SECOND, independently-constructed Host instance
  after a genuine restart — the exact round trip that was IMPOSSIBLE
  before this Arc.

## 3. Still out of scope (verbatim from this Arc's own instruction, confirmed by direct inspection)

- Relay Publish, Nostr/ActivityPub/AT Protocol/Session outbound, Relay
  Pool, GUI, Worker integration, Ontology Engine, P2P, storage redesign
  — no reference anywhere in this Arc's own code; `p2p/` remains
  completely untouched, confirmed by `git status`, not merely by
  absence of import.
- The residual `board()` bypass (Alpha 392 §5, Alpha 394 §8): a caller
  that calls `host.board()!.registerPost()` directly, instead of
  `submitPost()`, still reproduces the ORIGINAL memory-only-write gap
  (Alpha 367/389/390) exactly as before — `board()` is unchanged, not
  removed, deprecated, or gated, per this Arc's own scope.
- `fsync`, compaction, crash-mid-write recovery — unchanged from Alpha
  357/364's own disclosed, unresolved gaps; this Arc coordinates two
  existing components, it does not redesign either one's own internal
  durability guarantees.

## 4. Durable Write Warning — RESOLVED

```
host.board()?.registerPost(post)          host.submitPost(post)
    ↓                                          ↓
in-memory Repository updated              FedosBoardPersistence updated (durable)
    ↓                                          ↓
FedosBoardPersistence unchanged            FedosBoardService Repository updated
(Alpha 367/389/390's own                       ↓
 confirmed gap -- UNCHANGED,               host.query() observes it immediately
 still reachable via board())                  ↓
                                            SURVIVES A RESTART (Alpha 399)
```

The LEFT path (`board().registerPost()`) is UNCHANGED — it still never
reaches Persistence, exactly as Alpha 367 first found. The RIGHT path
(`submitPost()`, this Arc) is the NEW, correct, durable write boundary.
Both paths coexist; this Arc adds the correct one rather than removing
the old one, per its own scope (Alpha 392 §5).

## 5. Verification results

`npm run typecheck` — GREEN. `npm test` — GREEN except pre-existing,
unrelated Rust-structural test failures (`fedos_core_rust_public_crypto_api.test.ts`,
`fedos_core_rust_public_opaque_crypto_api.test.ts`,
`fedos_core_rust_secret_handle_real_bytes.test.ts`,
`secure_runtime_alpha_018_ciphertext_wire_export_import_api.test.ts`,
`secure_runtime_alpha_147_identity_root_derivation.test.ts`,
`secure_runtime_alpha_151_protocol_root_handle.test.ts`,
`secure_runtime_alpha_154_protocol_separation_verification.test.ts`,
`secure_runtime_alpha_155_integration_completion.test.ts`,
`secure_runtime_alpha_156_nostr_root_handle.test.ts`,
`secure_runtime_alpha_158_nostr_root_verification.test.ts`) — confirmed
present, byte-for-byte identical, on the pre-Arc baseline (reproduced
via `git stash` immediately before this Arc's own changes were
applied), entirely unrelated to Board/Host/Persistence and to this
Arc's own file set. `cargo check` and `cargo test` were run per this
Arc's own required verification.

## 6. Ripple scope

Exactly one pre-existing test file required an update:
`test/secure_runtime_alpha_386_host_query_delegation_review.test.ts`
§2 (a public-method-count assertion that predates `submitPost()`'s own
existence) — updated to include `submitPost` with an explicit comment
distinguishing it from the Query-delegation methods that Stage
declined to add. No other pre-existing file required modification.
`package.json`'s own `dependencies` count stays fixed at 2 — zero new
Cargo/npm dependency of any kind, confirmed by this Arc's own
`FedosBoardPersistence`/`FedosBoardService` reuse throughout.

## 7. Next Arc recommendation

**Secure Runtime Alpha 401–410: Outbound Publish Pipeline Foundation
Arc.**

Reason: this Arc's own required recommendation, matching its own
instruction verbatim. The Host can now durably coordinate every
Canonical Board WRITE — `submitPost()` closes the gap Alpha 390 named
as this Arc's own reason for existing. The next architectural
requirement named by this Arc's own instruction is the FOUNDATION for
actually publishing a submitted post OUTBOUND to its origin protocol
(Nostr Relay Publish, ActivityPub, AT Protocol, Session) — explicitly
NOT the Relay Pool itself, NOT Ontology, and NOT P2P, each of which
this Arc's own Absolute Prohibitions, and the required recommendation
itself, name as the wrong next step.

## 8. Conclusion

Every item this Arc's own Objective named is complete, verified by
real execution: the Host is now the single, durable, fail-closed owner
of Canonical Board write coordination, protocol-neutral, immediately
query-visible, and proven to survive a genuine restart. The residual
`board()` bypass is named honestly, not solved, exactly as this Arc's
own scope requires, with a precisely scoped recommendation for the Arc
that must build on this one next.

## 9. See also

- `docs/secure_runtime_alpha_399_write_restart_integration_verification.md`
- `docs/secure_runtime_alpha_398_write_atomicity_verification.md`
- `docs/secure_runtime_alpha_397_write_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_396_immediate_query_visibility.md`
- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`
- `docs/secure_runtime_alpha_394_write_failure_policy.md`
- `docs/secure_runtime_alpha_393_write_transaction_order.md`
- `docs/secure_runtime_alpha_392_write_coordination_ownership_decision.md`
- `docs/secure_runtime_alpha_391_desktop_host_write_coordination_inventory.md`
- `docs/secure_runtime_alpha_390_host_query_integration_completion.md`
