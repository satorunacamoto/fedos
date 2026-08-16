# Direct Ratchet Identity-Space Unification — Decision Matrix

**Status**: Coordinator synthesis of Agents A/B/C/D's independent Phase A investigations (`02`-`05` in this
directory). Written against `arc/fedos-installed-startup-root-cause` @ `83dca4ee`.

Scored 1 (worst) to 5 (best) per the mandate's own 15 criteria. Option C is not scored independently — every
agent independently confirmed it is not a fourth path; it inherits whichever of A/B performs the actual
unification, plus its own narrow additional risk (cross-domain signature reuse if a shared keypair's signing
preimages aren't kept domain-separated) and one open question neither A nor B has (a shared public key
legitimately appearing under two different legacy `deviceId`s post-unification). C is therefore excluded from the
scoring table and is not a candidate for adoption on its own.

| # | Criterion | Option A | Option B | Basis |
|---|---|---|---|---|
| 1 | Authority simplicity | 5 | 3 | A: one canonical space, one authority. B: two spaces + a link table forever. |
| 2 | Cryptographic binding clarity | 5 | 4 | A: session-id/sealing derive from one real space. B: unaffected structurally, but bindings persist in Space A while the wire carries Space B — one more indirection to reason about. |
| 3 | Wrong-device resistance | 4 | 3 | Threat model (05): A=SAFE-WITH-EXPLICIT-CHECK, B=VULNERABLE-IF-CARELESS (attack 2). |
| 4 | Wrong-account resistance | 5 | 5 | Both SAFE-BY-CONSTRUCTION (attack 1) — account auth is a layer above device-space resolution either way. |
| 5 | Replay safety | 5 | 4 | Both SAFE-BY-CONSTRUCTION on rollback (attack 6); B needs a named translate-before-lookup ordering discipline A doesn't need. |
| 6 | Multi-device correctness | 5 | 3 | Design doc 02 §9: Space B is already the per-device-file model every future multi-device arc would need; B keeps the single-value-per-Runtime Space A assumption alive as a parallel concept. |
| 7 | Identity-transition correctness | 4 | 4 | Both SAFE-WITH-EXPLICIT-CHECK (attack 7) — same underlying check (`06_PROTOCOL_CONTRACT_FREEZE.md` §8), neither option changes it. |
| 8 | Persistence simplicity | 5 | 3 | A: zero new persistence types. B: one new durable link-table type, forever-maintained. |
| 9 | Migration risk | 3 | 5 | A has a real, named risk (no retroactive path for already-provisioned installs — see §3 below); B has none (link is created fresh, once, locally). This is Option A's single weakest score. |
| 10 | Rollback/recovery | 4 | 4 | Neither option changes the session-reset authority's own generation-integrity logic. |
| 11 | Wire compatibility | 5 | 5 | Both confirmed zero wire-schema change (design docs 02 §2, 03). |
| 12 | Already-persisted session compatibility | 5 | 5 | A: old sessions become orphaned dead data, safely unreachable (02 §4.3). B: bindings stay in Space A, zero migration. Both safe; scored equal. |
| 13 | Security-UI truthfulness | 5 | 3 | A makes Axis 3/Axis 4 device selection coherent by construction (02 §5, threat model attack 12 = SAFE-BY-CONSTRUCTION). B requires a named single-accessor discipline to avoid future drift (attack 12 = SAFE-WITH-EXPLICIT-CHECK). |
| 14 | Implementation complexity | 4 | 4 | A: composition-root swap + one additive self-registration write, 9 ratchet-internal files untouched (02 §7). B: two call-site translation adapter + new persistence type + new invariant discipline (03). Comparable effort, different shape. |
| 15 | Future extensibility | 5 | 3 | A: one space to extend. B: any future peer-side linking extension inherits the standing link-table risk permanently (05 attack 10). |

**Totals**: Option A = 69/75. Option B = 58/75.

---

## Why Option A wins despite its lower migration-risk score

Criterion 9 is Option A's only real weakness, and it is the ONE place the threat model (05, attacks 13/14)
requires explicit engineering discipline rather than getting safety for free. But per design doc 02 §4.3 and the
recon doc's own §5 (independently re-confirmed by three separate investigations now: the original recon, Agent A,
and Agent D), **there is currently no real cross-account Direct Ratchet session in production data anywhere** —
the only sessions that have ever reached `"active"` are same-account Device Pairing scenarios, which are entirely
unaffected by this change. This means:

- The sealed-secret "re-seal migration" the threat model worried about (attacks 13/14) turns out not to be needed
  at all: because `sessionId` itself is derived from `localDeviceRef`/`remoteDeviceRef`, changing which value
  populates `localDeviceRef` produces a **new namespace automatically** — old Space-A-keyed rows simply become
  unreachable dead data, never re-interpreted, never corrupted (02 §4.3). This eliminates the harder half of
  Option A's migration risk entirely; it was a risk against a migration that does not need to run.
- The remaining real risk is narrower than the threat model's worst case: the **self-binding registration** for
  a NEW PDD identity is idempotent-by-construction (a single event-sourced `registerDevice()` call, INV-12), and
  the **no-retroactive-path for already-provisioned installs** (02 §10 item 2) is a real, disclosed limitation —
  not a data-destruction risk. A profile that already has a PDD identity file today (private key already
  discarded, per the codebase's own "never durably store a Device private key" invariant) simply cannot gain
  Direct Ratchet capability without being re-provisioned. Given this software has no public distribution yet
  (`AUTHENTICODE: UNSIGNED`, `PUBLIC PUSH: NO`, no closed-pilot users on record), this affects zero real users
  today, and is philosophically the same shape as the Beta's own already-disclosed limitations ("a forgotten
  passphrase is unrecoverable," "no automatic update") — a known, named, honest constraint, not a silent
  destructive migration.

By contrast, Option B's structurally larger weakness (criteria 1, 6, 8, 13, 15, and threat-model attacks 2/10) is
a **permanent** property of the system going forward, not a one-time event: every future engineer touching
Direct Ratchet or the Security State Controller must remember the link-table discipline forever. Option A
converts a standing structural risk into a one-time, fully engineering-controlled, currently-zero-blast-radius
event.

## Decision

**OPTION A — unify Direct Ratchet's own `localDeviceRef` to Peer Device Discovery's `deviceId` (Space B).**

See `07_FINAL_ARCHITECTURE_DECISION.md` for the formal decision record, `08_IMPLEMENTATION_PLAN.md` for the
ordered file-by-file plan (adapted from design doc `02`'s own §7), and `09_TEST_MATRIX.md` for the consolidated
test plan (design doc `02`'s §8 plus the Option-A-relevant rows of threat model `05`'s negative-test matrix).
