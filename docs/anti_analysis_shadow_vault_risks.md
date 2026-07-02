# Anti-Analysis & Shadow Vault — Risk Rules (binding)

**Status: this document adds no code.** It fixes, in writing, a set of hard
prohibitions so that *nobody* — now or in a future stage — adds anti-debugging,
anti-VM detection, self-destruct, or fake "shadow data" generation to this
product. These techniques are **not implemented, not scheduled, and not
approved.** This file exists to make that refusal explicit and reviewable before
anyone is tempted to write such code.

If a future change would violate a rule below, the rule wins — do not write the
code, or open a new, explicitly-reviewed Stage to renegotiate the rule in the
open. "It was easy to add" is never a reason.

This is a safety contract, not a marketing claim. Nothing here should be read as
"secure", "audited", "untraceable", or "coercion-proof". It states what the
product does NOT do, and why doing it would harm real users, developers, and
auditors. It complements the deniable-storage research boundary in
[`docs/deniable_storage_research.md`](deniable_storage_research.md) (Stage 40)
and the Vault / Crypto / Identity design in
[`docs/vault_crypto_identity.md`](vault_crypto_identity.md).

---

## 1. Anti-debug / anti-VM detection is NOT implemented

The product must not try to detect whether it is being debugged, traced,
emulated, sandboxed, or run in a virtual machine. Concretely, do **not** add:

- debugger/trace detection (e.g. `sys.gettrace`, `ptrace` checks, `debugger;`
  timing traps, DevTools-open heuristics, breakpoint/step-timing detection),
- VM / emulator artifact scanning (MAC-address prefixes, hypervisor CPUID bits,
  known VM device names, `/proc`/registry probes, sandbox-file fingerprints),
- environment fingerprinting whose *purpose* is to decide "am I being analyzed?"

Detection code adds attack surface, is trivially bypassed by a determined
analyst, and — as §3–§4 explain — mostly hurts the wrong people.

## 2. self-destruct / forced exit / process kill is NOT implemented

The product must not destroy data or terminate itself in response to a perceived
"analysis", "tamper", or "wrong environment" signal. Do **not** add:

- self-destruct or automatic secret-wipe **triggers** (wiping keys/vault because
  something "looks like" a debugger, VM, or forensic tool),
- forced process exit for anti-analysis reasons (`os._exit`, `process.exit`,
  `abort()`, crash-on-detection),
- any "kill switch" that reacts to a detection heuristic rather than to an
  explicit, deliberate user action.

Automatic destruction driven by a heuristic is a footgun: a false positive
destroys a legitimate user's data (see §3), and a real adversary who has a copy
of the storage is unaffected by the app deleting its own live state.

## 3. VM detection has high false positives — it breaks legitimate use

VM / sandbox detection cannot cleanly separate "attacker" from "normal user":

- **Real users run in VMs.** Corporate VDI, cloud desktops, Windows-on-ARM
  translation layers, Android emulators for accessibility, and privacy-focused
  users on VMs are all ordinary, legitimate.
- **Developers and CI run in VMs and containers by default.** Blocking or
  wiping there breaks local development, automated testing, and reproducibility.
- **Auditors and security reviewers run in instrumented environments.** Anti-VM
  behavior actively obstructs the very people making the product safer, and looks
  like something to hide.

A false positive here is not a minor bug — it can delete a real person's data or
lock them out. That risk is unacceptable for a defensive product.

## 4. Debugger detection reads as evasion — it damages trust

Even setting false positives aside, shipping debugger/anti-analysis detection is
a reputational and ethical liability:

- It is widely associated with malware and DRM, and is easily **misread as
  analysis-evasion** — the opposite of a trustworthy, auditable app.
- It is **security theater**: a serious analyst defeats it quickly, so it buys no
  real protection while signaling bad intent.
- It conflicts with this project's stance of open, reviewable boundaries. Hiding
  from inspection contradicts "describe mechanisms and their limits".

## 5. Safe alternatives (the things we DO consider instead)

Where the underlying goal is legitimate — reduce the window in which secrets are
exposed — the answer is explicit, user-visible lifecycle hygiene, not covert
detection. These remain **boundaries/behaviors to design carefully in their own
future stages**, not anti-analysis tricks:

- **App lock on background.** Re-lock the vault when the app is backgrounded or
  suspended, so a walk-away or task-switch does not leave secrets unlocked.
- **Explicit user lock.** A clear, deliberate "Lock now" action the user controls.
- **Session timeout.** Auto-lock after a configurable idle period.
- **Memory-wipe *request* boundary.** A boundary that *requests* clearing
  sensitive buffers on lock — documented as best-effort, since a managed runtime
  (JS/GC) cannot guarantee zeroization (see
  [`deniable_storage_research.md`](deniable_storage_research.md) §5). Never
  presented as a guarantee.
- **Crash-safe state clearing.** On expected shutdown/lock, clear live secret
  state deliberately — driven by user/lifecycle events, never by a
  "tamper detected" heuristic.
- **No secret in logs.** Never write keys, seeds, plaintext, ciphertext,
  passphrases, or tokens to logs, crash reports, analytics, or error messages.

The distinction that matters: these react to the **user and OS lifecycle**, not
to a guess about "am I being watched?".

## 6. Shadow data generator is NOT implemented

The product must not generate fake, decoy, or "shadow" content to populate a
hidden/alternate dataset. Do **not** add a generator that fabricates posts,
messages, activity, accounts, or history to make a decoy volume look "lived-in".
No fake-activity engine, no synthetic timeline, no manufactured plausibility.

## 7. Branch-selected shadow vaults are a clear anti-pattern

A hidden dataset chosen by a trivially-enumerable branch — e.g. `finger_id == 5`
reveals the real vault while other inputs show a decoy, or any magic index /
secret gesture / alternate PIN that toggles which dataset is shown — is
**forbidden**, exactly as in
[`deniable_storage_research.md`](deniable_storage_research.md) §2. Such a branch
is discoverable in code/behavior, self-defeating (its mere existence destroys
deniability), and coercion-fragile. Do not implement decoy/real toggles.

## 8. Fake activity generation carries large legal, UX, and safety risk

Even if it were technically easy, fabricating activity is dangerous:

- **Legal risk.** Manufacturing false records/claims can constitute fabrication
  of evidence or fraud depending on jurisdiction and use; the product must not
  build tooling whose purpose is to deceive an investigator or court.
- **User-safety risk.** A decoy that is *inconsistent* is worse than none — it
  invites the "why is some of this fake?" question and can escalate a coercion
  situation rather than defuse it.
- **UX / trust risk.** Fake data corrupts the user's own view of their real
  history, breaks search/backup/sync, and erodes trust in what the app shows.

## 9. Deniable storage stays a Stage 40 research boundary

Anything in the deniable/hidden/shadow-storage space remains **research only**,
scoped to [`docs/deniable_storage_research.md`](deniable_storage_research.md)
(Stage 40) and §5 of [`vault_crypto_identity.md`](vault_crypto_identity.md). It
is not designed to completion, not scheduled, and not folded into the current
core, the Vault seam, the Crypto seam, or any storage adapter. This document adds
no new mechanism to it — it only fixes the "no anti-analysis, no fake generator"
prohibitions around it.

## 10. If a legitimate hardened container is EVER pursued (not now)

If, after research, a real hardened/deniable container were ever built, it would
be a separate, audited, opt-in, explicitly-experimental package requiring **all**
of the following — and still **without** any anti-analysis or fake-generation
code from §1–§8. Absence of any one is a blocker:

- **Audited Rust core.** Cryptography lives in the reviewed Rust Crypto Core, not
  in TS/JS render/worker code (see [`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md)).
- **Fixed-size container.** Fixed-size with disciplined padding so a hidden region
  is not inferable from size/free-space deltas.
- **AEAD.** Only standard, reviewed authenticated encryption — no home-grown
  ciphers, no XOR, no bespoke "obfuscation".
- **Padding discipline.** Deliberate padding so boundaries between regions are not
  statistically visible.
- **Metadata-leak analysis.** An explicit, written analysis of size/timestamp/
  access-pattern/backup/sync/OS-lifecycle leaks (per
  [`deniable_storage_research.md`](deniable_storage_research.md) §4) with limits
  stated, not wished away.
- **No hardcoded branch.** No enumerable selector, magic index, or decoy/real
  toggle (§7).
- **No generated fake claims.** No synthetic activity, decoy content, or
  fabricated history (§6, §8).

## 11. Forbidden wording

The product and its docs must **never** claim:

- "完全に隠せる" / "completely hidden"
- "捜査に耐える" / "withstands forensic investigation"
- "痕跡ゼロ" / "zero-trace" / "leaves no trace"
- "絶対バレない" / "absolutely undetectable" / "impossible to detect"

(and any variant: "coercion-proof", "subpoena-proof", "unbreakable",
"military-grade", "plausible deniability guaranteed"). These over-promise
properties that provably do not hold and can put users in real danger. Describe
mechanisms and their **limits** only, and label anything experimental as
experimental — consistent with
[`deniable_storage_research.md`](deniable_storage_research.md) §8.

## 12. Current conclusion

- **Docs only.** This stage adds no code and changes nothing under `src/`,
  `packages/`, the Runtime, the Worker, the Vault seam, or the Crypto seam.
- **No anti-analysis.** No anti-debug, no anti-VM, no debugger detection, no
  self-destruct, no forced exit, no automatic wipe trigger.
- **No shadow generator.** No fake-activity/decoy-content generator and no
  branch-selected shadow vault.
- **Prohibitions are binding.** Any future work in this space is a separate,
  reviewed, explicitly-experimental Stage that still honors §1–§11 — never grown
  silently into the current core.
