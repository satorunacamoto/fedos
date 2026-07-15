# Secure Runtime Alpha 433 — Sealing-Key Authority Decision

Phase A, Stage 3. A sealed Master Seed (Alpha 432, Option E) requires a
wrapping key. Six options were named in this Stage's own instruction.

| Option | Who owns the key | TypeScript sees it | Backup/migration | Current runtime support | Verdict |
|---|---|---|---|---|---|
| A. OS-bound (DPAPI) | Windows OS | No | No (device-locked) | Desktop-Windows only (Alpha 431 §4/§5) | Deferred — see below |
| B. User passphrase-derived | User's memory | No (bytes never leave Rust) | Yes (passphrase travels, envelope travels) | Universal | **Adopted** |
| C. Separate random wrapping key, OS-secure-stored | OS/Host secure store | No | Only if the store itself migrates | No OS-secure store exists for a random 32-byte blob today | Rejected this Arc |
| D. Hardcoded application key | The source code (== the attacker) | N/A | N/A | N/A | **Rejected — absolute prohibition** |
| E. Key derived from public device metadata | Nobody real — reconstructible by anyone with the metadata | N/A | N/A | N/A | **Rejected — absolute prohibition** |
| F. No sealed persistence, ephemeral only | N/A | N/A | None | Universal | Rejected — defeats this Arc's own restart-survival requirement |

D and E are rejected per this Arc's own binding instruction, without
further evaluation: a hardcoded key gives every reader of the source
code (and everyone who ever obtains the compiled artifact) the wrapping
key; device metadata (hostname, MAC address, OS build) is observable by
anything running on the same device and often over a LAN, providing no
real secrecy.

## Adopted: Option B — user passphrase, Argon2id

- **Who owns the wrapping key**: nobody persists it — it is derived
  fresh, inside Rust, from a caller-supplied passphrase every time
  `seal()`/`restore_sealed()` runs, via Argon2id
  (`argon2::Argon2::hash_password_into_with_memory`), the SAME already-
  adopted `argon2` dependency (Stage 84) whose RFC 9106 vectors this
  crate already verifies — no new dependency.
- **How it is restored**: the caller supplies the SAME passphrase again;
  a fresh random salt is drawn on every `seal()` call (stored, non-secret,
  inside the envelope) so re-sealing the same seed under the same
  passphrase never produces the same ciphertext twice.
- **Whether TypeScript sees it**: the passphrase crosses the WASM
  boundary as a `Uint8Array` argument to `seal()`/`restore_sealed()` and
  is never returned, logged, or retained by Rust beyond the single
  Argon2id call — TypeScript already had the passphrase (the user typed
  it), so this is not a NEW exposure; TypeScript never sees the
  DERIVED wrapping key or the raw Master Seed.
- **Backup/migration**: both the envelope (non-secret once sealed) and
  the passphrase (in the user's memory) can travel to a new device —
  this Arc does not build that UI, but the underlying mechanism does
  not block it.
- **Reused AEAD/KDF**: sealing itself uses the SAME
  `crypto::aead_internal::seal_internal`/`open_internal` ChaCha20-
  Poly1305 primitive `fedos_encrypt`/`fedos_decrypt` already use,
  under a NEW, dedicated `AeadAadDomain::MasterSeedSealing` domain
  (never reusing `RootKey`/`Storage` — domain separation exists
  precisely so each distinct secret class gets its own label).

Option A (DPAPI) is not rejected outright — it remains a strong future
per-Host wrapping-key choice once a real Desktop Host integration point
exists for it — but is not adopted as THIS Arc's mechanism, to avoid
two divergent seal/restore code paths (Alpha 432's own reasoning) and
because "claiming DPAPI support without a real local native caller
invoking it" is explicitly forbidden by this Arc's own STOP conditions;
no such caller is wired in this Arc.
