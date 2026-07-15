# Secure Runtime Alpha 439 — Authority Persistence Ownership Review

Phase A, Stage 9. Decides who stores the sealed envelope.

| Option | Verdict |
|---|---|
| A. Desktop Host owns a dedicated sealed-envelope store | Deferred — no existing Host-owned secret store to extend; would require a NEW file-backed store and a NEW default path authority this Arc's own instruction says not to invent ("No default filesystem path in this Arc unless an existing path authority exists" — none does) |
| B. `FedosRuntimeIdentity` owns it | Rejected — this Stage's own instruction states explicitly "Do not overload `FedosRuntimeIdentity`"; inspection confirms that type today carries runtime-mode/session concerns, not secret persistence |
| C. Secure Runtime generic ciphertext storage owns it | Rejected — Alpha 431 §6 found existing ciphertext storage keyed to `AeadAadDomain`/`AeadCiphertextHandle`, a DIFFERENT shape from a Sealed Master Seed Envelope V1 JSON string; forcing it through that path would misuse "treating ordinary Board storage as secret storage"-adjacent machinery for a schema it was not designed for |
| D. Board persistence owns it | **Absolutely prohibited** by this Arc's own invariants (Board never stores secrets) — rejected without further evaluation |
| **E. No Host integration yet; authority/store remain injected boundaries** | **Adopted** |

## Why E, not A

This Arc's own preferred candidate lists "E or A, depending on actual
runtime support." Alpha 431 confirmed no existing dedicated secret-
store path exists to extend, and this Arc's own STOP conditions forbid
"silently depending on an imaginary Electron/Tauri/native host" or
inventing a new default filesystem path without an existing path
authority. `FedosDesktopHost` (inspected directly) owns Board/Outbox
file paths via its own constructor-injected configuration — no
analogous "Master Seed envelope path" concept exists anywhere in that
type today, and adding one is a Host-ownership change, not a Master-
Seed-authority change; it belongs to a future, explicitly-reviewed
Stage that also decides the Host's own default-path policy, not to
this Arc's own narrow mandate.

## What "E" means concretely

- `FedosWasmMasterSeedAuthority` has no `save()`/`load()` method and no
  file-path configuration of any kind.
- A caller (a future Host integration, out of this Arc's scope) is
  responsible for calling `.seal(passphrase)`, persisting the returned
  `FedosSealedMasterSeedEnvelopeV1.json` string wherever it chooses,
  and calling `.restoreSealed(envelope, passphrase)` with it on a fresh
  instance after restart.
- This repository's own restart verification (Alpha 447) therefore
  demonstrates the mechanism (construct → generate → seal → clear →
  construct fresh → restore → sign, all in one test, in-memory) without
  claiming any REAL file/registry/keychain persistence exists yet — an
  honest distinction this doc states explicitly rather than implying a
  Host wiring that was not built.

If a dedicated store is introduced in a future Arc, it MUST contain
only the sealed envelope (a single opaque string), never plaintext,
and MUST NOT reuse Board/Outbox storage machinery for a schema it was
not designed for.
