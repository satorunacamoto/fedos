# Threat Model

Consolidated from the repository's one dedicated top-level threat-model
document (`docs/fedos_threat_model.md`, `arc/fedos-security-goals-threat-model`,
465 lines, unmerged — inlined here in full substance), the crypto
activation-gate threat model (`docs/runtime_crypto_threat_model.md`, on
`master`), the Archive Suppression trust model (`docs/secure_runtime_alpha_7721_7800_threat_and_trust_model.md`,
on `master`), the Master-Seed recovery threat model
(`docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`, on
`master`), and two real scenario-test matrices (Alpha 6361-6440, Alpha
6681-6760, both on `master`).

## 1. Honesty classification used throughout

Every claim below is tagged one of:

- **[LIVE]** — implemented, tested, reachable today in the packaged app.
- **[GATED]** — real code exists, wired, but structurally closed in every
  environment this repository actually runs in (a build precondition, an
  env-var gate, or a missing artifact — never a hand-fabricated success).
- **[UNBUILT]** — design or placeholder only, no implementation exists.

This is the repository's own convention (`docs/fedos_threat_model.md` §0)
and is reused here deliberately — do not read a [GATED] item as [LIVE].

## 2. Assets

- Master Seed and all derived Protocol Roots/Account/Device keys (highest
  value — see §5 below).
- Active-session opaque `SecretHandle`s (Ratchet chain keys, session state).
- Plaintext message content, once decrypted for display.
- Device Registry trust state (which Devices are trusted/revoked).
- Relay-visible metadata (who messages whom, when, how often) — explicitly
  **not** protected; see §7.
- Archive export files (may contain plaintext-adjacent metadata even for
  deleted content — see Known Issues).
- Local profile/settings/search-index files on disk.

## 3. Adversary catalog

Each adversary lists what FedOS attempts to defend and what it explicitly
does not (from `docs/fedos_threat_model.md` §2, verbatim structure).

| Adversary | Attempts to defend | Does NOT defend |
|---|---|---|
| **Desktop attacker** (local, non-privileged) | Raw Master Seed/keys never exposed to TS/renderer code [GATED — pipeline currently closed] | Active-session opaque Handles ARE exposed; no app-lock/re-lock-on-background exists |
| **Remote (network) attacker** | Schnorr signatures prevent forgery [LIVE]; AEAD auth prevents forged ciphertext once Track B is live [GATED] | No DDoS-resistance goal of any kind |
| **Relay operator** | Relays trusted only for delivery; multi-relay any-OK=delivered fan-out [LIVE]; rejection reasons discarded [LIVE]; dedup [LIVE] | Full transport metadata visible to the relay; no Tor/onion routing; no server-side recipient filter privacy |
| **Malicious plugin** | N/A — no plugin system exists anywhere (zero grep matches) [UNBUILT, speculative] | Binding constraint for any future design: default-deny every capability, treat as MORE hostile than any adversary here |
| **Compromised Device** (a paired, currently-trusted Device) | 3-state `FedosDeviceRegistryPersistence` binding (bound/unbound/revoked) [LIVE]; revocation terminal and immediately reflected | Revocation is binary/forward-only; no per-Device key material distinct from account keys exists; cannot distinguish "compromised-but-not-yet-revoked" from genuinely trusted (fundamental, disclosed limit) |
| **Compromised Relay** | Same as Relay operator, plus: forged/tampered control payloads rejected at signature-verification import | Same metadata exposure as Relay operator |
| **Memory-dump attacker** | Raw secrets never in Desktop-process memory by construction; `zeroize`-on-drop [GATED] | Does not eliminate a live-derivation-window capture inside the Rust process; panic-time zeroization explicitly untested/unsolved |
| **Swap/pagefile access** | None — relies entirely on OS-level swap encryption | No `mlock`/`VirtualLock`-equivalent anywhere; FedOS has zero control here |
| **Clipboard scraper** | None — intentionally out of scope | No clipboard-clear/restriction anywhere; no future arc has claimed this |
| **Screenshot / screen-capture** | None — intentionally out of scope | No `FLAG_SECURE`-equivalent anywhere |
| **Keylogger** | NIP-07-style delegation (where used) reduces surface | "Genuinely un-defendable" at the application layer — a passphrase-unlock UI fully exposes the passphrase to a keylogger |
| **Kernel-level compromise** | None, by explicit policy | Accepted cost of ordinary user-space operation |
| **Hypervisor-level compromise** | None — and no *detection* attempt either | `docs/anti_analysis_shadow_vault_risks.md` §1 forbids VM/emulator-artifact scanning outright; will never self-destruct/wipe/refuse-to-run on a "looks like a VM" signal even if technically detectable |

## 4. Explicit non-goals (consolidated)

Relay-visible metadata correlation; physical/forensic/backup/remote-peer
deletion; coercion resistance or plausible deniability (forbidden wording
exists specifically to block this claim from ever being made); VM/
debugger/kernel/hypervisor detection or evasion; keylogger-level capture;
panic-time zeroization; DDoS/availability guarantees; cross-Device trust
synchronization; a Relay-deletion mechanism; proof that a peer Device
actually erased anything.

## 5. Master Seed compromise — the single highest-value target

From `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md` §5,
stated plainly rather than hidden: **if the Master Seed leaks, every
derived Identity is affected — every Protocol Root, every Account, every
Device, across every protocol and any future protocol, all at once, with
no containment possible at any level below the seed itself.** This is the
accepted cost of a single-Master-Seed hierarchy (weighed explicitly against
an independent-per-protocol-seed alternative and rejected for that
alternative's materially worse recovery/backup burden). By contrast, a
single leaked Protocol Root or Account Key is contained — HKDF's one-way,
domain-separated construction (RFC 5869) prevents deriving the Master Seed
or any sibling Root/Key from it (§6). **How a Master Seed backup is
stored is explicitly out of scope of this decision, deferred to a future
Storage Review** — an external auditor should treat this as an open
dependency, not an assumed-safe default.

## 6. Fail-closed as a load-bearing, repeatedly-cited convention

The activation-gate document (`docs/runtime_crypto_threat_model.md`)
demonstrates this concretely: setting `FEDOS_CRYPTO_PROVIDER=fedos` alone
does nothing (checked and rejected before the provider name is even
inspected); setting BOTH that and `FEDOS_CRYPTO_ENABLED=explicit-dev-only`
(a deliberately unusual, unguessable exact string — common truthy spellings
like `true`/`1`/`yes`/`on` are explicitly rejected) still resolves
`"ProviderUnavailable"`, because `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` is a
hand-fixed `false` constant with no override anywhere. Multiple
independent layers must all fail open simultaneously — across separately
reviewed future changes — for this gate to ever produce live crypto by
accident. The same convention recurs at 8 other cited points across the
codebase (WASM loader gate, encrypt/decrypt wrappers, the DPAPI storage
backend, retention-state transitions, Search retention gating, Private
Transport wiring, direct-conversation identity routing) — `docs/fedos_threat_model.md` §5's
binding rule: "a new gate defaults to denied/closed/inert... A feature
proposal that cannot describe its own fail-closed default is not ready to
be built."

## 7. Traffic-analysis / metadata (explicitly the largest gap vs. original ambition)

`SECURITY.md` states this plainly: a Relay operator, or anyone observing a
Relay's traffic, can see who is sending to whom and when, and can correlate
that pattern over time. NIP-17's gift-wrap does not by itself defeat this;
no onion-style routing or mixing exists in this codebase to hide it. Treat
this as public information to any Relay you connect through. This
disclosure was added specifically because a parallel review (the Original
Vision/Expected-Behavior V2 review) found it was the largest gap between
the project's original privacy ambition and current reality, and it was
folded into `SECURITY.md` directly (Alpha 8201-8280).

## 8. Same-account Device-trust model for Archive Suppression facts (Alpha 7721-7800)

A worked example of the repo's precise trust-boundary reasoning, reusable
as a template for auditing similar same-account propagation mechanisms.
Trusted-sender gates (ALL required): same `accountRef`; `sourceDeviceId`
resolves to a `trusted` binding in the receiver's own local Device
Registry, checked live, never cached; a since-revoked Device's facts are
rejected outright, even if trusted at send time; an unknown `sourceDeviceId`
fails closed as `"unknown-device"`, never an implicit account-level grant;
a different account's Devices can never pass gate 1 at all. Explicit,
disclosed edge cases (not solved, not silently assumed away): a malicious-
but-still-trusted Device is bounded to over-suppressing only its own
already-known subjects, never touching unrelated data or exfiltrating
anything; a compromised-but-not-yet-revoked Device is indistinguishable
from genuinely trusted until the account owner revokes it; a Device paired
after a suppression fact was already broadcast never receives that
specific fact via original fan-out (a disclosed pairing-race limitation);
Identity Transition does not migrate Device Bindings' `accountRef`, so a
suppression fact created under an old identity is not automatically
recognized under a new one.

## 9. Real scenario-test evidence (not fabricated, matrices exist as tests)

**Alpha 6361-6440 Threat Scenario Matrix** (`test/secure_runtime_alpha_6361_6440_threat_scenarios.test.ts`)
— 16 scenarios, **all PASS**: stolen/revoked device denial, forged-payload
rejection, replay/downgrade/rollback rejection across Identity Transition
and Signed Deletion, retention-bypass denial, wrong-passphrase/locked-
profile fail-closed behavior, and confirmed-intentional crash-fail-closed
behavior on a truncated append-only log (scenario 16 — a genuine
availability trade-off, not a defect).

**Alpha 6681-6760 Threat-Scenario Acceptance Report** — 24 scenarios against
a real packaged Electron build: **18 PASS, 0 FAIL, 6 BLOCKED**. Every
BLOCKED item names its exact boundary honestly rather than rounding up to
PASS: live Double-Ratchet establishment/reset (scenarios 8, 19) is
call-contract-verified but requires the compiled WASM artifact, absent at
the time of that report's own final verification pass; five-cycle
lock/unlock and five-cycle Runtime-restart depth (21, 22) were not
constructed as new tests that session (two-cycle evidence exists, not
five); installer-execution continuity (24) was not run because it requires
interactive elevation this environment's tooling did not exercise. **This
discipline — naming a BLOCKED boundary rather than fabricating a PASS — is
itself a positive signal for an external auditor about this repository's
own verification culture**, and is the standard this bundle asks auditors
to apply back: a claim in this bundle that turns out to require an
artifact/environment you don't have should be re-labeled BLOCKED in your
own findings, not silently assumed still true.

## 10. Recommended next threat-modeling arc (unfinished business, named honestly)

`docs/fedos_threat_model.md` §7 names forward secrecy / key rotation for
Group Messaging as a known, unaddressed gap requiring its own dedicated
design-decision arc (Sender-Key vs. double-ratchet vs. periodic re-keying
vs. explicit permanent deferral) before any future arc activates real
group encryption — not because a gap is silently accepted, but because
locking messages under a single static key with no retroactive
forward-secrecy path would be worse than the current, disclosed
non-implementation. An informal, unmerged prototype already exists (Alpha
2121-2200 Sender-Key lineage) with a disclosed CSPRNG flaw (`Math.random()`,
not a CSPRNG) — see [`05_known_issues.md`](05_known_issues.md).
