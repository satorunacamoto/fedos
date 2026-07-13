# Secure Runtime Alpha 291 — Existing Session Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 291–300 Session
Canonical Board Gateway Adapter Arc. It inspects the actual repository
before any implementation, exactly as Alpha 251/261/271/281 did for
each prior Board-layer Arc.

## 1. Why now

Alpha 290 closed the AT Protocol Canonical Board Adapter Arc and
recommended exactly this Arc next: Session should be integrated LAST,
through an explicit opt-in Gateway boundary, "because it is a
private-messaging system, not a public-post protocol." This Stage
inspects the repository before that fourth, final adapter is built.

## 2. Inventory method

Direct inspection of `src/`, `docs/`, and `package.json` — no code
executed, no file modified. Searched for `Session`, `Oxen`, `onion`, and
every directory/file name containing `session` or `oxen`.

## 3. Findings

### 3.1 A critical naming collision, found and resolved first

**`src/identity/session_boundary.ts` exists — but it is NOT the Session
messenger.** It is a generic, protocol-neutral WEB/APP SESSION
lifecycle boundary (`start_placeholder`/`end_placeholder`/
`refresh_placeholder` — login/logout/token-refresh events), Stage 129,
entirely unrelated to the Session messaging application (Session/Oxen).
Its own doc comment confirms this scope: "a session-lifecycle EVENT was
requested," mirroring `../community/moderation.ts`'s policy-review
pattern. **This file is NOT reused by this Arc in any way** — reusing it
would conflate two entirely different meanings of the English word
"session" that happen to collide in this repository. No import, no
reference, no naming borrowed from it appears anywhere in this Arc's own
code.

### 3.2 No Session-messenger TypeScript code exists

`src/session/` does not exist. No file anywhere in `src/` matches
`*session*` other than the unrelated `session_boundary.ts` (§3.1) and
generic web-session vocabulary in `src/federation/types.ts`/
`capability_matrix.ts` (comments about "no real socket/HTTP/OAuth
session exists" — the SAME unrelated "web session" sense, confirmed by
direct inspection, not a Session-messenger reference). No Oxen network
client, no onion-routing transport, and no Session protocol message
model of any kind exists anywhere in `src/`.

`docs/fedos_onion_like_routing.md` is a design-review-only document
about a Nostr-NIP-59-based relay envelope proposal — it does not
mention Session or Oxen and is unrelated to this Arc.

### 3.3 A Rust-side key-derivation domain exists — a different layer,
not reusable

`packages/fedos-core-rust/src/lib.rs` already reserves a domain-separated
key-DERIVATION root named `"Session"` (alongside sibling `Nostr`/
`ATProto`/`Wallet` roots — Secure Runtime Alpha 153, see
`docs/secure_runtime_alpha_153_session_atproto_wallet_root.md`). This is
CRYPTOGRAPHIC KEY MATERIAL scoping for a not-yet-built future Session
identity, entirely at the Rust/key-derivation layer — it contains no
message model, no gateway concept, and no board-post concept of any
kind. This Arc's own Absolute Prohibitions forbid "Session通信実装"
("Session communication implementation"), "Oxen接続" ("Oxen
connection"), "秘密鍵" ("private keys"), "暗号化"/"復号"
("encryption"/"decryption") regardless — confirmed not touched, not
imported, not referenced by anything this Stage or any later Stage of
this Arc adds.

### 3.4 `FedosBoardSourceProtocol` already reserves `"session"` — and
already documents the Gateway framing this Arc adopts

`src/board/fedos_board_source.ts` (Alpha 253, Canonical Board Model
Foundation Arc) already includes `"session"` as one of its five closed
protocol values, with its own documented convention: **"`session`: a
gateway-assigned reference to a published board message."** This
pre-existing documentation already anticipated the EXACT Gateway framing
this Arc's own instruction requires — no redesign is needed, only
implementation against a decision already on record.

### 3.5 A test-only fixture already demonstrated the shape fits — not
reused as code

Alpha 259 (Canonical Board Model Foundation Arc, prior-prior Arc) built
a fixture INSIDE A TEST FILE ONLY (never production code) modeling a
gateway-published Session message: `gatewayMessageId`, `sessionId`,
`text`, `publishedAtUnixSeconds`. This confirms the shape was already
judged plausible three Arcs ago; it is not imported or reused as code —
Alpha 292 fixes the real, frozen field list independently.

### 3.6 Which code is reusable

- **The two-step Adapter pattern** (`map<Protocol>PostToBoardPostInput`
  + `validate<Protocol>BoardPost`) established by
  `fedos_board_nostr_adapter.ts` (Alpha 266) and confirmed to generalize
  by both `fedos_activitypub_board_adapter.ts` (Alpha 277) and
  `fedos_atproto_board_adapter.ts` (Alpha 287) — reused as the
  STRUCTURAL PATTERN, not as code, for a FOURTH time.
- **`validateFedosBoardPost`** (`src/board/fedos_board_post_validator.ts`,
  Alpha 257) — reused DIRECTLY, unmodified, exactly as all three
  existing adapters already do.
- **`FedosBoardSourceProtocol`'s own `"session"` value** (§3.4) —
  already reserved, needs no change.
- **The Descriptor/validated-value construction discipline** — reused as
  a NAMING pattern for `FedosValidatedSessionPost` (Alpha 292):
  "validated upstream by convention and module placement," matching
  `FedosValidatedNostrEvent`, `FedosValidatedActivityPubPost`, and
  `FedosValidatedAtprotoPost`.

### 3.7 Which code must NOT be reused

- **`src/identity/session_boundary.ts`** (§3.1) — a different concept
  entirely (web-app session lifecycle), reusing it would be a category
  error, not merely unhelpful.
- **The Rust-side `"Session"` key-derivation root** (§3.3) — a different
  layer (cryptographic key material, not board-post modeling), and this
  Arc's own instruction forbids Rust/Cargo changes regardless.

## 4. Conclusion

No existing honest abstraction is duplicated by this Arc — there is
nothing Session-messenger-post-shaped to duplicate anywhere in `src/`,
and the one same-named neighbor (`session_boundary.ts`) is confirmed to
be about a different concept and is not touched. The three existing
Board Adapters (Alpha 261–290) supply the STRUCTURAL pattern this Arc
mirrors for a fourth and final time; the Canonical Board Model (Alpha
251–260) supplies the fixed target shape; neither is redesigned. New
files are placed under `src/board/session/` (this Arc's own required
directory), never under `src/session/` — Canonical Board semantics must
not live under a transport-named directory, the identical rule Alpha
271/281 already applied to ActivityPub/AT Protocol.

This Arc's own scope is drawn even narrower than its three predecessors:
it owns ONLY the boundary from an already-Gateway-verified,
already-normalized `FedosValidatedSessionPost` into a `FedosBoardPost`
— it has no responsibility before the Gateway (no Session network, no
Oxen connection, no key material, no encryption/decryption, no DM
fetch, no storage sync) and no responsibility after the Board (no
persistence, no feed, no repository).

## 5. See also

- `docs/secure_runtime_alpha_290_atproto_board_adapter_completion.md`
- `docs/secure_runtime_alpha_287_atproto_board_adapter.md`
- `docs/secure_runtime_alpha_281_existing_atproto_inventory.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_153_session_atproto_wallet_root.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
