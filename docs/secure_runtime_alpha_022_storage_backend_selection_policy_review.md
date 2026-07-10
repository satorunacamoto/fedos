# FedOS Secure Runtime Alpha 022 — Storage Backend Selection Policy Review

**Status: REVIEW ONLY. No code change of any kind — the Storage
Backend Interface (`fedos_runtime_storage_backend.ts`), the Storage
Resolver (`fedos_runtime_storage_resolver.ts`), the Runtime Storage
Service (`fedos_runtime_ciphertext_storage.ts`), `types.ts`,
`create_runtime.ts`, Worker, Rust, `Cargo.toml`, and `package.json` are
all byte-for-byte unchanged. This document compares five Storage
Backend candidates, decides WHERE a future backend-selection condition
should live, confirms the Storage Backend Resolver must never become a
second Runtime Mode Authority, and recommends exactly ONE backend for
Alpha 023 to implement. No DPAPI/Keychain/Secret Service/Browser/
filesystem/SQLite/IndexedDB implementation is added by this Stage.**

## 1. Why now

Alpha 021 ("Storage Backend Abstraction Layer") extracted
`RuntimeStorageBackend`/`MemoryStorageBackend` and added
`resolveRuntimeStorageBackend()` as the ONE seam a future backend
switch would live behind — but deliberately left that seam hardcoded,
naming the decision of "which condition selects which backend" as
explicitly out of scope. This document is that deferred decision: a
comparison, not an implementation, so that whichever Stage eventually
writes the first real OS-backed backend does so against an
already-reviewed plan rather than an ad hoc one.

## 2. Candidates compared

Five backend candidates, per the mandate: Memory (current),
Windows DPAPI, macOS Keychain, Linux Secret Service, Browser Secure
Storage. A sixth, "Test Backend," is addressed separately in §3 since
it turns out to already be effectively covered by existing design.

| Criterion | ① Memory (current) | ② Windows DPAPI | ③ macOS Keychain | ④ Linux Secret Service | ⑤ Browser Secure Storage |
|---|---|---|---|---|---|
| **Security** | Low — plaintext in process memory, no OS protection, vulnerable to a process memory dump; acceptable ONLY because it is Development-only | High — OS-level encryption bound to the user/machine account; app never handles raw key material | High — OS-level, can be hardware-backed on modern devices, supports access-control lists and biometric/passcode gating | Depends entirely on which keyring daemon (if any) is actually running; a minimal/headless install may have none at all | Reasonable within one browser origin's own boundary (non-extractable `CryptoKey` objects are strong when used correctly), but this is explicitly NOT an OS-keystore threat model — anything reachable from a compromised origin/XSS is not protected |
| **Portability** | Perfect — pure JS, runs anywhere (Node, browser, any OS) | Windows-only | macOS-only (iOS out of scope here) | Worst of the OS backends — fragmented across distros/desktop environments; many server/container Linux hosts have no D-Bus session at all | Cross-OS wherever a modern browser runs, but NOT available in this repo's own Node-based Runtime test harness without a real browser context; behavior varies by vendor (Safari's IndexedDB/private-mode quirks are a known real-world hazard) |
| **Runtime依存 (runtime dependency)** | None — no OS API, no native binding | Requires a native bridge or a shell-out to an OS-provided tool; no pure-JS path | Requires a native bridge or a shell-out to the macOS `security` CLI; no pure-JS path | Requires a D-Bus client binding; no OS-provided CLI is guaranteed present on every distro | Requires browser-only globals (`window`, `indexedDB`, `crypto.subtle`) absent in this repo's current Node-based Runtime |
| **Worker対応** | Structurally simple but NOT automatically shared — a separate execution context's own memory would not see the same `Map` without explicit message passing | Usable from a background thread, but needs the SAME native/shell-out bridge available there too | Same as DPAPI — needs the bridge available in that context too | Same class of problem, plus D-Bus session/connection lifecycle complexity across contexts | Actually the BEST-positioned candidate for a future BROWSER Worker (IndexedDB/Web Crypto are available inside real Web Workers, unlike Node worker threads) — though this repo's current `src/worker.ts` is Node-side, not a browser Worker |
| **Desktop対応** | Trivially available (it is just JS) but provides no desktop-specific value | Native desktop-only; the canonical Windows answer | Native desktop-only; the canonical macOS answer | Desktop-only, and only when a desktop environment with a Secret Service provider is actually running — least reliable of the three | Runs inside a desktop browser tab, but that is NOT the same as Electron-style desktop storage — Electron apps typically prefer an OS keystore over this |
| **Fail Closed** | Already established (Alpha 019/021): Development only; Production/Unknown resolve `null` | Same Development-only gate PLUS its own "OS call failed/unavailable" path — narrow, single failure mode | Same Development-only gate PLUS "keychain locked/access denied/unavailable" — a few more failure modes than DPAPI, still bounded | Widest additional Fail-Closed surface of any candidate: "no D-Bus session," "no provider," "provider present but locked" are all distinct and must all collapse to the SAME `null` | Must additionally gate on secure-context availability, private-browsing storage eviction, and per-origin quota eviction — a distinct surface from any OS backend |
| **Backup** | None — process-lifetime only, unrecoverable on restart | Weak — DPAPI blobs are tied to the Windows user profile; they do not survive a profile reset/migration to a new machine without re-encryption, and Windows does not back them up automatically | Better than DPAPI — Keychain items CAN sync via iCloud Keychain (opt-in, user-controlled) and are included in encrypted device backups, but remain tied to the user's Apple ID/device trust | No standard story — entirely dependent on which keyring backend the user's distro ships and whether it backs up its own store | None reliable — browser storage is explicitly EVICTABLE by the browser itself under storage pressure or private-mode, unlike any OS keystore |
| **Exportability** | None built-in (a caller could copy the wire string out manually) | Poor — a DPAPI blob is meaningless outside the originating Windows user account; cannot move to another device | Poor BY DESIGN — Keychain deliberately resists bulk export (a security feature, not a gap) | Varies by provider; no guaranteed interface | Depends entirely on whether the implementation chose extractable vs. non-extractable keys; IndexedDB blobs are trivially exportable by same-origin script (a trade-off, not a feature) |
| **User Experience** | Invisible — no OS prompt, no user awareness of storage at all | Excellent — silent, no user-facing prompt, "just works" | Can prompt for Touch ID/password on sensitive access — more transparent than DPAPI, at the cost of possible friction | Inconsistent across desktop environments — some prompt, some don't, some distros have no GUI keyring at all | Invisible, like Memory (the Credential Management API is a distinct, heavier, partial exception not considered part of this candidate) |
| **Implementation Complexity** | Trivial — already implemented (Alpha 019/021) | Moderate — a single OS call family, one platform to handle, narrow Fail-Closed surface | Moderate — a single OS call family, one platform to handle, slightly wider Fail-Closed surface than DPAPI | Highest of the four real-backend candidates — most fragmentation, most Fail-Closed edge cases | Medium — no native binding needed, but this repo's CURRENT Runtime is Node-oriented, so safely feature-detecting and wiring browser-only APIs is a genuinely different design problem from every other candidate here |

## 3. "Test Backend" — a sixth candidate already effectively covered

The mandate's future-candidate list also names a "Test Backend."
Reviewing it against the existing design: `storeCiphertext()`/
`loadCiphertext()`/`deleteCiphertext()` already accept an optional
`storage: RuntimeStorageBackend` parameter (Alpha 019, preserved
byte-for-byte through Alpha 021) specifically so tests can inject a
custom backend — including a throwing one, or a pre-seeded one —
without touching the Resolver at all. A dedicated "Test Backend" class
would duplicate that already-injectable seam rather than add new
capability. **Conclusion: no dedicated Test Backend is recommended; the
existing injectable-`storage`-parameter pattern already serves this
need.**

## 4. Resolver design — where should the switch condition live?

Four candidate locations were compared for WHERE a future
backend-selection condition should be evaluated:

| # | Location | Assessment |
|---|---|---|
| A | Inside the Runtime Storage Service (`fedos_runtime_ciphertext_storage.ts`) | REJECTED. This is exactly the coupling Alpha 021 extracted the Resolver to remove — Alpha 021's own guardrail states "the Runtime Storage Service never constructs a backend itself." Moving selection logic back into the Service would undo that abstraction and re-couple every `storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` caller to backend-selection details it should never need to know about. |
| B | Inside the Storage Resolver (`fedos_runtime_storage_resolver.ts`) | **RECOMMENDED.** This is precisely the seam Alpha 021 built for this purpose — its own doc comment already states "a future Stage may add a real selection condition here... without changing this function's own signature, its caller, or any Public Runtime API." Selection logic lives in exactly one place, and every caller (the Service, and transitively `AppRuntime`) is unaffected by any future change to it. |
| C | Inside `src/worker.ts` | REJECTED outright. Worker remains fully unconnected per every prior Stage's own Hard Guardrail (Alpha 019 through Alpha 021 all explicitly confirm zero Worker reference). Deciding a storage backend for an execution context that does not yet exist in this Runtime is premature, and would introduce a Worker dependency this arc has consistently avoided building ahead of need. |
| D | A platform/OS-detection read performed directly by each backend's own constructor (self-detecting availability), rather than the Resolver switching between pre-built candidates | NOT ADOPTED as the primary mechanism, though not fully rejected either: a real future backend MAY reasonably self-report "unavailable" (e.g., DPAPI call fails, no D-Bus session) as part of ITS OWN Fail-Closed behavior. But the INITIAL choice of "which backend class to even try" is still cleaner as a Resolver-level decision (Option B) — a backend that does not match the current platform should ideally never be constructed at all, not be constructed and immediately fail. |

**Decision: the switch condition belongs in the Resolver (Option B),
exactly where Alpha 021 already seeded it.** No other location is
consistent with this arc's own separation-of-concerns precedent
(Runtime Storage Service = Fail-Closed gate + shape guard only; Worker
= intentionally unconnected; backend classes = storage mechanics only,
not selection policy).

### 4.1 What the Resolver's future selection logic should read

If a future Stage implements Option B for real, the input it reads
should be **platform/OS identity** (e.g. Node's `process.platform`), a
narrow, single-purpose, Fail-Closed-to-"Unknown" read — structurally
the SAME shape Alpha 020's Runtime Mode Authority already established
for `NODE_ENV` (pure, synchronous, try/catch, one classification
question, never an authorization decision) — but it must be its OWN,
separately-named classifier, never a reuse or extension of
`determineFedosRuntimeMode()`. See §5.

## 5. Relationship to the Runtime Mode Authority — confirmed separation

Alpha 020 established `determineFedosRuntimeMode()`
(`fedos_runtime_mode_authority.ts`) as the single shared classifier for
ONE question: does `NODE_ENV` read `development`, `production`, or
neither? This Stage confirms the Storage Backend Resolver answers a
**completely orthogonal** question — which OS/platform is this running
on — and must never be collapsed into, or reuse, the Runtime Mode
Authority.

| | Runtime Mode Authority (Alpha 020) | Storage Backend Resolver (Alpha 021/future) |
|---|---|---|
| **Question answered** | "Is this Development, Production, or Unknown?" | "Which platform/OS am I on, and which backend does that imply?" |
| **Input** | `process.env.NODE_ENV` | (future) `process.platform` or equivalent — a DIFFERENT variable entirely |
| **Consumer today** | `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`, `runtimeCapabilities()`, the Runtime Storage Service's own `isDevelopmentRuntimeForCiphertextStorage()` gate | `fedos_runtime_ciphertext_storage.ts`'s three exported functions, as each one's default `storage` parameter |
| **Orthogonality proof** | A Production deployment on Windows and a Production deployment on macOS give the SAME `"Production"` answer here — this classifier cannot, and must not, distinguish them | A Windows machine and a macOS machine give DIFFERENT answers here regardless of whether `NODE_ENV` is `"development"` or `"production"` — this classifier cannot, and must not, depend on that |
| **Correct relationship** | Two independent axes (WHAT environment × WHICH platform). Both may need to be consulted before a real backend is used one day, but as TWO separate reads, never one collapsed into the other. | |

**Hard confirmation for this Stage**: `fedos_runtime_storage_resolver.ts`
does not import, reference, or depend on `fedos_runtime_mode_authority.ts`
or `determineFedosRuntimeMode()` in any way (verified in §8's test
suite by direct source inspection). The Development-only Fail-Closed
gate remains entirely the Runtime Storage Service's own responsibility,
exactly as Alpha 019/021 left it — the Resolver is never asked "is
storage allowed," only "which backend, if this code path is even
reached." A future backend-selection condition inside the Resolver
must read platform identity through its OWN, separately-named
classifier — never by importing or extending `determineFedosRuntimeMode()`,
and never by defining a second `isProductionAllowed()`-shaped
authorization function (the SAME forbidden-API-shape principle Alpha
020 §4 already established for the Runtime Mode Authority applies here
too: a platform classifier answers "which platform," never "is this
platform trusted/allowed").

## 6. Recommendation for Alpha 023 — implement exactly one backend

**Recommended: Windows DPAPI.**

Reasoning, ranked:

1. **Zero new dependency, given this repo's own constraints.** Every
   real OS-backed candidate requires bridging outside pure TypeScript
   — but DPAPI is reachable via Node's built-in `child_process` calling
   a short PowerShell script that wraps `ConvertTo-SecureString`/
   `ConvertFrom-SecureString` (which use DPAPI internally when no
   explicit key is supplied), or `System.Security.Cryptography.ProtectedData`
   directly. This needs no new npm package and no new Rust crate —
   `package.json`/`Cargo.toml` stay untouched, consistent with every
   constraint this arc has held since Alpha 001.
2. **Narrowest Fail-Closed surface of the three OS backends.** Per §2,
   DPAPI has exactly one additional failure mode ("the OS call itself
   failed/unavailable") versus Keychain's several (locked/denied/
   unavailable) and Secret Service's many (no session/no provider/
   provider locked). A narrower Fail-Closed surface is a materially
   safer FIRST real backend to implement and review.
3. **Matches this repository's own primary development and test
   environment.** This repo's own tooling context is Windows-based —
   implementing and verifying the first OS-backed backend on the
   platform actually available for direct testing avoids blocking
   Alpha 023's own verification on cross-OS CI infrastructure that may
   not yet exist.
4. **Strong Security/User Experience combination.** OS-level encryption
   bound to the user/machine account, with a silent (no-prompt) user
   experience — a favorable combination for a first real backend, where
   correctness review benefits from the fewest moving parts (no
   biometric/passcode UI flow to reason about, unlike Keychain).

**Explicitly deprioritized for Alpha 023**: macOS Keychain (a strong
second choice — same zero-new-dependency shell-out path via the
built-in `security` CLI, but a wider Fail-Closed surface and requires
macOS-specific test infrastructure this repo does not yet have
confirmed); Linux Secret Service (worst fragmentation and widest
Fail-Closed surface of any candidate — should be LAST among the OS
backends regardless of which is first); Browser Secure Storage
(requires a non-Node runtime to test meaningfully, orthogonal to this
repo's current Node-based Runtime architecture — worth revisiting once
a browser-side Runtime/Worker actually exists, not before).

This recommendation is **advisory only** — Alpha 023 itself remains a
separate, explicitly-reviewed Stage; nothing here authorizes beginning
DPAPI implementation.

## 7. What this Stage does NOT do

- Does **not** implement Windows DPAPI, macOS Keychain, Linux Secret
  Service, or Browser Secure Storage.
- Does **not** implement a filesystem, SQLite, or IndexedDB backend.
- Does **not** add a backend-selection condition to
  `resolveRuntimeStorageBackend()` — it remains hardcoded to
  `MemoryStorageBackend` only, byte-for-byte unchanged from Alpha 021.
- Does **not** add a new Crypto API.
- Does **not** add Identity or Network capability of any kind.
- Does **not** connect a Worker.
- Does **not** connect Production.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change any Public Runtime API signature —
  `storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` are
  byte-for-byte unchanged.
- Does **not** modify `fedos_runtime_storage_backend.ts`,
  `fedos_runtime_storage_resolver.ts`,
  `fedos_runtime_ciphertext_storage.ts`, `types.ts`, or
  `create_runtime.ts` in any way — this is a documentation-only Stage.

## 8. See also

- `docs/secure_runtime_alpha_019_secure_storage_foundation.md` (Secure
  Runtime Alpha 019) — defined the Storage Interface/Memory backend
  this Stage's comparison table's ① row describes.
- `docs/secure_runtime_alpha_020_runtime_mode_authority_consolidation.md`
  (Secure Runtime Alpha 020) — the Runtime Mode Authority this Stage's
  §5 confirms the Storage Backend Resolver stays separate from, and the
  classifier-not-authorizer principle this Stage's §5 extends to a
  future platform classifier.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md`
  (Secure Runtime Alpha 021) — built the Backend Interface/Resolver
  seam this Stage's §4 decides how to use, and explicitly deferred the
  question this Stage answers.
- `docs/secure_runtime_alpha_006_mode_authority_review.md` (Secure
  Runtime Alpha 006) — the review-only precedent this Stage's own
  format (comparison table, ranked options, explicit non-goals list)
  follows.
