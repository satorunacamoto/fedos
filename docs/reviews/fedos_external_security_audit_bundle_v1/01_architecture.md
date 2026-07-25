# Architecture

Consolidated from the audit-prep base package (`8e730f25` §2-§7), its Alpha
8041-8120 delta (`6873d24f`), and the Architecture Conformance Review
(`review/architecture-conformance-secure-runtime`, base `3eb9eadd` — the
oldest source cited in this bundle; its layer-shape findings are still
accurate, its "present on master or not" framing is not and has been
corrected below against current `master` at `81305b37`).

## 1. Process/trust-boundary diagram

```
┌─────────────────────────────── Electron Main Process ───────────────────────────────┐
│  fedos_electron_beta_main.cts  (the ONE canonical, packaged entry point)             │
│                                                                                        │
│  secureRuntimeBundleConfig() ──> FedosDesktopRuntime                                  │
│    ├─ Profile layer      (create / unlock / lock / recovery state machine)           │
│    ├─ Device layer       (Registry, Pairing, Sync, trust state)                      │
│    ├─ Conversation layer (Direct Ratchet, NIP-17 transport + route-binding,           │
│    │                      Outbox/Scheduler, Search, Archive)                          │
│    ├─ Identity layer     (Identity Transition / Replacement, evidence proofs)         │
│    └─ Delivery layer     (Observation Repository, Suppression propagation)            │
│                                                                                        │
│  contextBridge.exposeInMainWorld — THREE bridges into the SAME isolated-world window: │
│    1. fedosProfile      — create/unlock/lock, USED by real UI                         │
│    2. fedosBeta         — status/diagnostics, USED by real UI                         │
│    3. fedosApp          — 34 fedos-app:* channels (Alpha 8041-8120+), USED by real UI  │
│    4. fedosAcceptance   — 12 fedos-acceptance:* channels, ZERO UI consumer,            │
│                            gated behind FEDOS_ELECTRON_BETA_AUTOTEST=acceptance,       │
│                            structurally permanent by design (not a bug to "fix away")  │
└──────────────────────────────────┬────────────────────────────────────────────────────┘
                                   │  IPC (ipcMain.handle / ipcRenderer.invoke, no .on() leaks)
┌──────────────────────────────────▼────────────────────────────────────────────────────┐
│  Renderer  (isolated world, contextIsolation on, nodeIntegration off)                  │
│    fedos_electron_beta_renderer.ts  (~1,600+ lines)                                    │
│    Nav shell: Conversations / Chat / Search / Archive / Devices / Safety Center /      │
│               Settings  (Identity Replacement + Signed Deletion nested in Safety Ctr)  │
│    DOM writes: textContent / createTextNode ONLY — zero innerHTML with real content,   │
│               zero eval/document.write/insertAdjacentHTML, zero dynamic .href/.src     │
└──────────────────────────────────┬────────────────────────────────────────────────────┘
                                   │  Rust FFI boundary (WASM in dev, native in prod path)
┌──────────────────────────────────▼────────────────────────────────────────────────────┐
│  packages/fedos-core-rust  — the ONE place raw secret bytes are ever allowed to exist  │
│    SecretHandle / SecretHandleStore  (27 narrow `expose_bytes_for_internal_*`          │
│                                       accessors across ≥2 secret-carrying types)       │
│    Master Seed → HKDF → Protocol Roots (Nostr/Session/ATProto/Storage) → Account/      │
│                  Device-indexed keys — one-way, domain-separated (RFC 5869)            │
│    BIP-340 Schnorr signatures; NIP-44-style AEAD; Double Ratchet primitives             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Two independent crypto-activation chains — a real, load-bearing architectural fact

Two structurally separate tracks exist and must never be conflated by a
reader (from `docs/fedos_threat_model.md`, §0, `arc/fedos-security-goals-threat-model`):

- **Track A** — the original `RuntimeCryptoProvider` registry chain
  (`Runtime → initializeCrypto() → Facade → Backend Abstraction → Backend
  Interface`). Permanently closed via `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`,
  a hand-fixed `false` constant with no env/override path anywhere in the
  repository. Confirmed dead code, not wired to any production call site
  (Architecture Conformance Review §10; Validation Program V1's "final
  architecture scorecard" independently confirms `AppRuntime`/
  `initializeCrypto()` as dead code, not deleted, and explicitly recommends
  against deleting it — a naming/discoverability issue, not a live risk).
- **Track B** — the WASM/Rust AEAD pipeline actually wired into
  `FedosWasmConversationEncryptionAuthority`, closed today only because (a)
  the compiled `pkg/` artifact is not committed to this repository and (b)
  no code path sets `NODE_ENV==="development"` in a real deployment. This
  gate is **not** hand-fixed-false the way Track A's is — it is a
  configuration/build-state gate, a materially different risk shape.
  Auditors should confirm which track any given production code path
  actually uses before assessing its risk; assuming Track A's dead-code
  status applies to Track B (or vice versa) is a real category error prior
  reviews have flagged.

The full activation-gate reasoning (why a single misconfigured env var, or
even both `FEDOS_CRYPTO_PROVIDER`+`FEDOS_CRYPTO_ENABLED` set together,
still cannot turn on live crypto) is documented in
`docs/runtime_crypto_threat_model.md` (on `master`) — a fail-closed,
multi-independent-layer design, not a single toggle.

## 3. Dual dev/production discovery

The Architecture Conformance Review (base `3eb9eadd`, historical) found a
**second, genuinely live, dev-only chain** operating in parallel with the
inert Track A: `attemptDevOnlyRuntimeRustIntegration() → FedosWasmLoader.planLoad()`,
which does make a real WASM `version()` call — bypassing the proposed
Facade/Abstraction/Interface seam entirely. This was flagged as an
unreconciled architectural regression risk at the time. **Re-verify current
status against `master` at `81305b37`** before treating this as still open
— this review's base commit is roughly 4,700 commits behind current
`master` and most of the subsystems it found "absent from master entirely"
(Ratchet, NIP-17, Identity Transition, Signed Deletion, Peer Capability,
Device Trust, the Electron layer, Safety Center) are very likely merged
today via the documented 5401-7320 → 7961-8040 master-landing chain (see
Evidence Index).

## 4. Secret-flow map

Passphrase → Argon2id → Master Seed (held as a `SecretHandle`, never as a
raw JS value) → HKDF → per-Protocol Root (Nostr / Session / ATProto /
Storage) → Account-index-separated → Device-index-separated key material.
Every derivation step is one-way and domain-separated (RFC 5869); a leaked
Protocol Root or Account Key cannot be used to derive the Master Seed or
any sibling Root/Key (Alpha 144 Recovery & Threat Model Decision, §6). A
Master Seed leak, by contrast, compromises everything derived from it, with
**no containment possible at any level below the seed itself** — stated
plainly, not hidden, in that same decision document §5.

Active-session opaque `SecretHandle`s ARE exposed to the Desktop/Electron
process for the duration of a session; raw Master Seed / Root bytes are
structurally never exposed to Desktop code. The single largest open
cryptographic-hygiene question named by the audit-prep package (`8e730f25`
§4) is whether every JS-side call site that calls an
`expose_bytes_for_internal_*` accessor re-zeroizes its own local copy
afterward — this has **not** been independently call-site-verified by any
prior review and is the top item in the Review Order (see
[`03_review_order.md`](03_review_order.md)).

No `mlock`/`VirtualLock` (or OS-equivalent memory-pinning) exists anywhere
in this codebase — secrets in process memory may be paged to disk under
memory pressure like any ordinary unprivileged process. `zeroize`-on-drop
narrows, but does not eliminate, a transient-capture window during a live
Rust-side derivation (documented, not oversold, per `docs/vault_crypto_identity.md`
§4's own stated discipline).

## 5. Persistent-data inventory (summary)

All durable state is append-only NDJSON logs, one log family per domain
(Profile, Device Registry, Conversation Draft/Outbox/Delivery Observation,
Archive, Identity Transition, Deletion Request/Pending-Review, Safety
Center). None currently hold a write-time or read-time in-memory index
except `AppendOnlyFedosDeliveryObservationPersistence` (fixed at Arc
7881-7960); every other append-only backend (~52 of 53 repo-wide) does a
full `readFileSync` + parse + rebuild on every read AND write by explicit,
documented design choice — see [`05_known_issues.md`](05_known_issues.md)
for the performance consequence. A crash mid-append leaves a truncated
final NDJSON line; every reader in this codebase fails closed (throws)
rather than silently dropping the truncated tail — a disclosed,
intentional characteristic, re-confirmed as PASS-by-design in the Alpha
6361-6440 threat-scenario matrix (scenario 16).

## 6. Protocol extension inventory

Transport is standard NIP-17 (Nostr gift-wrapped direct messages) plus
project-proprietary additive extensions layered inside the encrypted Rumor
content: real-time invitation delivery, and an authenticated route-binding
field used to resolve same-peer multi-conversation routing as a primary
key rather than a peer-only guess (closed a previously-disclosed
misrouting bug — see Known Issues). A generic NIP-17 client will not
understand these extensions; this application does not claim Nostr-client
interoperability beyond standard NIP-17 delivery itself (`SECURITY.md`).

## 7. What does NOT exist (confirm before assuming otherwise)

- **No plugin system anywhere** — zero grep matches repo-wide. Purely
  speculative for threat-modeling purposes; the binding design constraint
  for any future plugin work is default-deny every capability, treat as
  more hostile than any other named adversary (`docs/fedos_threat_model.md` §2.4).
- **No onion-routing / traffic-analysis mitigation** — design-only,
  self-disclaimed as unimplemented (`docs/fedos_onion_like_routing.md`).
  A Relay operator can see who messages whom, when, and how often; NIP-17
  gift-wrap does not defeat this on its own (`SECURITY.md`).
- **No `SecretHandleStore`-named construct ever existed** under any close
  variant name, despite appearing in some early proposals — Architecture
  Conformance Review, `03_missing_features_matrix.md`.
- **No cross-Device Registry synchronization of trust state** — each
  Device's own view of "trusted"/"revoked" is a local fact, not a
  cross-Device guarantee (`SECURITY.md`).
