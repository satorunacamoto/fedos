# Secure Runtime Alpha 6281–6360 — Secret Ownership and Lifetime

**FedOS Secure Memory Secret Buffer and Zeroization Foundation Arc**

This document states, precisely, who owns a secret byte at every point in
its life after this Arc, and updates `docs/runtime_secure_memory.md`'s own
architecture (§2–§9) with the one genuinely new piece this Arc adds: an
opaque, ID-addressed ownership registry alongside the Secret Buffer itself.
It does not renegotiate that document's own normative decisions — see its
own §2–§9 for the underlying rules this document restates the practical
consequences of.

## 1. Two ownership shapes, not one

Before this Arc, exactly one ownership shape existed: a `SecretHandle`
value held directly as a Rust struct field (e.g.
`DirectRatchetSessionState.root_key: SecretHandle`). Ownership followed
ordinary Rust rules — one field, one owner, scope-based drop.

This Arc adds a SECOND, optional shape: a `SecretHandle` value moved INTO a
`SecretHandleStore`, reachable only via an opaque `SecretHandleId` (an
index + generation counter, never a byte). The Store becomes the owner;
the caller holds only a non-secret reference token.

**Neither shape is "better" in the abstract — they answer different
questions.** The field shape answers "does this struct's own lifetime
bound the secret's lifetime?" (yes, always, by construction). The Store
shape answers "can a caller be handed a reference to a secret, use it
later, and have that reference reliably fail if the secret was destroyed
or replaced in the meantime, even across an intervening operation?" — a
question the field shape cannot answer at all, because in the field shape
there IS no separate reference; the field itself is the only handle,
enforced entirely by the borrow checker at compile time.

## 2. Lifetime phases, restated for the Store shape

`docs/runtime_secure_memory.md` §3 names four phases: Provisioning,
Holding, Use, Retirement. For a Store-owned secret:

| Phase | Store-specific detail |
|---|---|
| Provisioning | Unchanged — a `SecretHandle` is constructed exactly as before, outside the Store. |
| Holding | The Store OWNS the `SecretHandle` value (moved in via `insert()`); the caller holds only a `SecretHandleId`. |
| Use | `use_handle(id, expected_kind, closure)` — the closure receives `&SecretHandle` for its own duration only, exactly matching §5's "a borrow never outlives the function call that received it," now enforced by the Store's own API shape rather than left to caller discipline. |
| Retirement | `destroy(id)` — zeroizes via the handle's own `clear()`, frees the slot, and (new) bumps a generation counter so the SAME id can never again resolve to ANY secret, including a future, unrelated one that reuses the same slot. |

## 3. What a `SecretHandleId` is, and is not

A `SecretHandleId` is `{ index: u32, generation: u32 }` — two plain
integers, `Copy`, safe to log, compare, or hold in a caller's own
long-lived state. It is NOT a pointer, NOT derived from secret content,
and NOT sufficient on its own to retrieve anything: every use also
requires the CORRECT `SecretHandleStore` instance (there is no global
registry) and the CORRECT `SecretHandleKind`.

This mirrors `docs/runtime_secure_memory.md` §14's own `SecretView`
vocabulary — a non-owning, non-sensitive descriptor, safe above the
Rust boundary in spirit — but a `SecretHandleId` is NOT itself a
`SecretView` and this Arc does not claim it is: `SecretView` (per §14)
is a display-oriented STATE descriptor (state label + kind label);
`SecretHandleId` is a REFERENCE token for Rust-internal use, not
designed or intended for UI display. This Arc keeps the Store
`pub(crate)`-only (never crosses the WASM boundary) precisely so this
distinction does not need to be adjudicated for a real UI-facing case yet.

## 4. Ownership transfer rules, unchanged

`docs/runtime_secure_memory.md` §4's "ownership transfers by move, never
by sharing" applies identically to `insert()` (the caller's own
`SecretHandle` binding becomes invalid — Rust's compiler enforces this)
and to `destroy()` (the Store's own internal binding is consumed and
zeroized; nothing is returned). No `Rc`/`Arc`-wrapped `SecretHandleStore`
is introduced or implied by this Arc — a Store, like a `SecretHandle`
itself, has exactly one owner (whichever function/struct field currently
holds it).

## 5. What this Arc does NOT change

- `SecretHandle`'s own internal fields, constructors, or accessors are
  unchanged (two new accessor SIBLINGS were added — `insert`/`destroy`/etc.
  never touch `SecretHandle`'s private fields directly, only its existing
  `pub(crate)` API: `kind()`, `clear()`, and construction).
- No existing consumer of `SecretHandle` (Master Seed, Identity/Application/
  Protocol Root, Direct Ratchet, NIP-44 conversation keys) was migrated to
  the Store shape — the Store is additive, not a replacement, and this
  Arc's own real vertical slice proves the Store against a freshly
  constructed handle, not by rewiring `FedosMasterSeedAuthority`'s own
  internals (see the reconciliation report §8 and the execution spec's
  own Phase L for why).
