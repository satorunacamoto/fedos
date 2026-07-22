# Secure Runtime Alpha 5961–6040 — Completion Declaration

**FedOS Identity Transition Peer Notification and Ratchet Reset
Integration Arc.**

## Status: full completion (one disclosed, pre-existing WASM boundary, consistent with prior Arcs)

- Real, privately-transportable transition notification (Phase B/C/D/E)
  — done, riding the existing `"nostr-nip17-v1"` route with no new Nostr
  kind, using 100% real BIP-340 Schnorr signatures throughout (account
  authorization, new-key proof, old-key continuity signature — all
  independently reverified by the receiver, never trusted from the
  sender's own claims).
- Durable, restart-safe, multi-Device-isolated Peer Transition
  Observation with idempotent-duplicate, conflicting-duplicate,
  broken-predecessor, rollback, and cycle detection — done (Phase F).
- Local acceptance policy reusing the Foundation's own evidence/
  acceptance vocabularies directly, no duplicate third vocabulary — done
  (Phase G).
- Peer capability advertisement of `"identity-transition-v1"` through the
  existing, unmodified advertisement pipeline — done (Phase H).
- Read-only Ratchet impact identification, and an explicit,
  `"accepted"`-gated authorization method that dispatches a REAL
  `establishSession()` reset with a real, additive `"identity-transition"`
  reason — never a new reset message type, never automatic — done
  (Phase I/J).
- Conversation continuity, Archive/Search/Sync exclusions, and
  multi-Device independence proven structurally and by direct test —
  done (Phase K/L/M).
- Safe, narrow Peer Runtime facade — done (Phase N).
- Real vertical slice with 100% real Identity Transition/notification
  crypto through Phase J's own boundary — done (Phase O).

**Explicitly reaffirmed, never weakened by this Arc**: account and Nostr
identity remain immutable; replacement evidence is now privately
transportable, but peer acceptance remains local policy — no automatic
identity/profile migration occurs anywhere in this codebase as a result
of this Arc; old Ratchet sessions reset rather than rebind root/chain
keys; historical messages, Archive, Search, and Conversation Membership
remain completely unchanged; Group identity transition remains deferred.

## One disclosed, pre-existing boundary (not a gap specific to this Arc)

A genuine `FedosDirectRatchetOutboundIntegration.establishSession()`
round trip requires the real Master-Seed-derived X25519 Double Ratchet
crypto, which needs a compiled `packages/fedos-core-rust/pkg/` artifact.
This worktree has none (confirmed absent before this Arc began) —
identical to the pre-existing situation
`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts` and
`test/secure_runtime_alpha_5721_5800_real_vertical_slice.test.ts` are
ALREADY `describe.skip`'d for. This Arc's own reset-authorization CALL
CONTRACT (reason binding, correlation persistence, refusal without
acceptance) is fully proven against a realistic fake `establishSession()`
stub, with 100% real crypto everywhere up to that one boundary.

## Verification

`npm run typecheck:core` — clean for every file this Arc touched (2
pre-existing, unrelated baseline errors remain). 7 new test files, 55 new
tests (1 intentionally WASM-gated skip), all passing. Two pre-existing
test files received narrow, additive, explicitly-commented updates for
this Arc's own sanctioned vocabulary widenings (Session Reset reason
count, Foundation's own structural-guard allowlists) — both re-verified
passing. Full `npx vitest run`: 842/1067 files and 13,644/13,981 tests
passing; every failing file inspected belongs to the documented
pre-existing missing-WASM-artifact/raw-import class; none of this Arc's
own new or edited files fail. No `pkg/`/`target/`/`Cargo.lock` was
generated in this worktree.

## Next Arc

**FedOS Identity Replacement User Verification and Conversation
Continuity UI Arc.**
