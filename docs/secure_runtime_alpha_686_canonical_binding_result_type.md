# Secure Runtime Alpha 686 — Canonical Nostr Author Binding Type

Stage 6 of Phase A. Defines `FedosNostrAuthorBindingResult`
(`src/board/runtime/identity/fedos_nostr_author_binding_types.ts`) as a
closed, coarse vocabulary:

- `"bound"` — carries `accountIndex`/`publicKeyHex`, the ONLY outcome that
  ever unlocks Nostr Outbound Eligibility.
- `"author-not-nostr"` — the resolved author's protocol is not `"nostr"`.
- `"signing-authority-unavailable"` — no Signing Authority configured, or
  no Master Seed currently held.
- `"public-key-mismatch"` — a real derived key exists but does not equal
  the author's own `publicIdentifier`.
- `"invalid-author-identifier"` — the author's `publicIdentifier` is not a
  well-formed 64-character lowercase hex Nostr public key.

No `Error`, no provider/signer object, no raw key, no arbitrary metadata —
matching `FedosPublicAuthorResolution`/`FedosOutboundEligibilityResult`'s
own established coarse-vocabulary discipline.
