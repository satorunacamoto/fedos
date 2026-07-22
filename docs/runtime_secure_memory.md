# FedOS Secure Memory Runtime Architecture (Secure Runtime Alpha 5321–5400)

> **Reconciliation note (Secure Runtime Alpha 6281–6360, FedOS Secure
> Memory Secret Buffer and Zeroization Foundation Arc).** This document
> was written on an older lineage (commit `406c1440`, branched directly
> off an earlier `master` tip) that never merged with the Direct Ratchet /
> NIP-17 Rust crypto lineage (`b8e9e062`) this repository's later Secure
> Memory work is built on. Its factual claim below — *"No Runtime,
> Worker, IPC, or UI code anywhere in this repository currently
> constructs, holds, transmits, or references a `SecretHandle`... there
> is no live secret anywhere above the Rust crate boundary to protect
> yet"* — was accurate for its OWN lineage at the time it was written and
> is **no longer accurate** on the lineage this repository's Secure Memory
> work actually continued from: `SecretHandle` there is a mature,
> production type, already load-bearing for the Master Seed, the
> Identity/Application/Protocol Root hierarchy, Nostr signing, NIP-44
> conversation keys, and the entire Direct Ratchet Cryptographic Core. See
> `docs/secure_runtime_alpha_6281_6360_reconciliation_report.md` §3 for
> the full record of this discrepancy and why it was found before, not
> after, writing production code. Every NORMATIVE decision in §1–§21
> below (the ownership/borrowing/move/zeroization/layering RULES) remains
> unchanged and binding — only the ABOVE factual snapshot of "what already
> exists today" is stale, and is corrected by this note rather than
> silently rewritten in place.

**Status: this document adds no code.** It is a **specification only** —
the UI → IPC → Runtime → Rust secret-memory architecture this codebase's
eventual real-secret path must satisfy. Nothing under `src/`, `packages/`,
`Cargo.toml`, or `test/` is changed by this document. No new type, field,
method, or dependency exists as a result of this Arc.

This complements, and does not renegotiate, the existing binding record:
`docs/secret_lifecycle_implementation_plan.md` (the `secrecy`/`zeroize`
policy `SecretHandle` real bytes already implements),
`docs/secret_handle_api_shape.md` (`SecretHandle`'s shipped type/method
shape, Stage 144–146),
`docs/secret_memory_test_strategy.md` (the test gates that shipped
implementation already passes),
`docs/fedos_core_rust_safety.md` §6 (memory safety),
`docs/vault_crypto_identity.md` §4 ("why Rust, not a managed runtime, for
the secret path"), `docs/crypto_capability_matrix.md` (the
`SecretHandle` capability label), `docs/runtime_crypto_threat_model.md`
(the activation-gate fail-closed guarantee), and `src/crypto/types.ts`
(the shipped TS-side opaque-handle boundary — Stage 34). Where this
document and any of those disagree, the earlier binding docs win — this
is an architecture map layered on top of decisions already made, not a
new rule source that supersedes them.

**What already exists today, unchanged by this document:**
`SecretHandle` (`packages/fedos-core-rust/src/lib.rs`) holds real 32-byte
secret material behind `secrecy::SecretBox`, zeroizes on `clear()` and on
drop, forbids `Clone`/`Debug`-over-bytes/`Serialize`/raw-secret
`Eq`/`PartialEq`/public `AsRef<[u8]>`, and is `pub(crate)`-at-most. No
Runtime, Worker, IPC, or UI code anywhere in this repository currently
constructs, holds, transmits, or references a `SecretHandle` — the
Runtime/Worker crypto activation gate (`docs/runtime_crypto_threat_model.md`)
is fail-closed and unconditionally denies real cryptography today, so
there is no live secret anywhere above the Rust crate boundary to protect
yet. This document specifies the architecture that must be in place
**before** that gate is ever opened.

---

## 1. Purpose and scope

- **Fix the vocabulary and layering for secret memory BEFORE any real
  secret crosses out of `packages/fedos-core-rust`.** Once the
  Runtime/Worker crypto activation gate is eventually opened (a separate,
  future, explicitly-reviewed decision — see
  `docs/runtime_crypto_threat_model.md` §3's "not a claim... will never be
  connected... only that connecting them is a deliberate, separate,
  future, reviewed act"), a live secret byte will, for the first time,
  need to be reasoned about across four layers: UI, IPC, Runtime, Rust.
  This document is that reasoning, written down first.
- **Not an implementation.** No file under `src/`, `packages/fedos-core-rust`,
  or `test/` changes. No new dependency (`libsodium`, `region`,
  `memsec`, or any OS page-locking crate) is adopted by this document —
  adopting one is its own future, separate, explicitly-reviewed stage,
  per this repository's standing "adopt per feature, per stage" rule
  (`docs/fedos_core_rust_safety.md` §5).
- **Binding on whichever future stage builds the cross-boundary secret
  path.** Every section below is a precondition that stage must satisfy,
  not a suggestion it may revisit informally.

## 2. Secret Buffer

A **Secret Buffer** is the one physical location in memory where a
secret's raw bytes live. This Arc fixes exactly one rule: **a Secret
Buffer exists in exactly one place in the whole UI → IPC → Runtime →
Rust stack — inside `packages/fedos-core-rust`, wrapped in a
`SecretHandle` (or its future generalization, `Secret<T>`, §14).** No
other layer ever allocates, receives, deserializes into, or reconstructs
a byte-for-byte copy of that buffer.

- The buffer's size is fixed at construction (today: `[u8; 32]`, per
  `docs/secret_handle_api_shape.md` §5) — never a growable allocation.
- The buffer is allocated and freed by Rust's ordinary stack/heap
  discipline plus the OS-level protections in §10; it is never a
  `Vec<u8>` (§5, §13's forbidden-container rule already fixed this).
- A Secret Buffer's existence is never observable from outside Rust
  except through the non-sensitive status/kind labels
  `SecretHandleStatus`/`SecretHandleKind` already expose
  (`docs/secret_handle_api_shape.md` §4) — a UI or IPC message can know
  THAT a secret is currently held and roughly WHAT KIND it is, never see
  or derive its bytes.

## 3. Secret Lifetime

A secret's **lifetime** is the interval between the Secret Buffer's
construction and the moment its bytes are guaranteed overwritten (§8).
This Arc names four lifetime phases, each with a single owning layer:

| Phase | What happens | Owning layer |
|---|---|---|
| **Provisioning** | Raw bytes are drawn (CSPRNG, a KDF, or user input already reduced to key material) and handed to a `SecretHandle` constructor. | Rust only — never Runtime, never UI. |
| **Holding** | The buffer exists, wrapped, inert, referenced only by handle/label from outside. | Rust only. |
| **Use** | The buffer's raw bytes are exposed, only via the narrow `pub(crate)` internal accessor (`docs/secret_handle_api_shape.md` §6/§10's `expose_bytes_for_internal_derivation`-style method), for the duration of one AEAD/HKDF call. | Rust only, and only for the call's duration — the exposed reference is never stored in a second variable (§7 already fixed this). |
| **Retirement** | `clear()` is called explicitly, or the handle's Rust-language scope ends and `Drop` runs. | Rust only; Runtime/UI may REQUEST retirement (§11) but never perform it. |

**A secret's lifetime never extends past the Rust process/module
boundary.** Runtime, IPC, and UI code may hold a *reference to* a
lifetime (a `SecretView`, §14) — never a phase transition they perform
themselves.

## 4. Ownership

- **Exactly one owner per Secret Buffer, at all times.** The owner is
  whichever `SecretHandle` value currently wraps the buffer — never a
  raw pointer, never a second variable, never a field on two different
  structs simultaneously.
- **Ownership transfers by move, never by sharing.** If a future HKDF/AEAD
  stage needs to consume a `SecretHandle` to derive a new one
  (`docs/secret_lifecycle_implementation_plan.md` §9's already-specified
  shape), the derivation function takes the input by shared reference
  (read-only borrow, §5) and returns a NEW, independently-owned
  `SecretHandle` — ownership of the INPUT never transfers to the output;
  they are two separate buffers with two separate lifetimes.
- **No shared ownership type** (`Rc<SecretHandle>`, `Arc<SecretHandle>`,
  or equivalent) is ever introduced for a real Secret Buffer. Shared
  ownership defers the drop-time zeroization guarantee (§8/§9) to
  "whenever the last reference goes away," which is exactly the diffuse,
  hard-to-audit lifetime this Arc exists to prevent. If two call sites
  genuinely need the same derived material, each gets its OWN
  independently-owned `SecretHandle` produced by its own derivation call
  — paying a derivation cost is acceptable; an ambiguous drop point is
  not.

## 5. Borrowing

- **A Secret Buffer may be borrowed, never copied, for the duration of a
  single operation.** Rust's `&SecretHandle` (shared/read-only borrow) is
  the only borrow shape this Arc authorizes for real-secret types — HKDF
  and future AEAD connections already specify this exact shape
  (`docs/secret_lifecycle_implementation_plan.md` §9: "takes a
  `SecretHandle` by shared reference (never consuming or mutating it)").
- **No mutable borrow (`&mut SecretHandle`) is used to mutate the secret
  bytes themselves** — the only mutation a `SecretHandle` ever undergoes
  is the one-way `Holding → Cleared` transition via `clear()`, which is
  itself the retirement phase (§3), not an ordinary data mutation.
- **A borrow never outlives the function call that received it.** No
  future function signature stores a borrowed `&SecretHandle` in a
  struct field, a closure captured for later, or a returned value — this
  mirrors Rust's own borrow-checker discipline, stated here as an
  explicit architectural rule rather than left implicit in the type
  system, because a future IPC-facing wrapper type (§11) could otherwise
  be tempted to "cache" a borrowed reference across an `await` boundary.

## 6. Move semantics

- **`SecretHandle` is move-only.** Because `Clone` is forbidden (§7,
  already binding per `docs/secret_lifecycle_implementation_plan.md` §4),
  every assignment, function argument, and return value that takes a
  `SecretHandle` by value MOVES it — the source binding becomes invalid,
  Rust's compiler enforces this at compile time, and there is never a
  runtime "moved-from but still holds a stale buffer" state to reason
  about.
- **A move never triggers zeroization.** Moving a value changes which
  variable owns it; it does not end its lifetime (§3) or run `Drop` — a
  future implementation must not conflate "the buffer moved to a new
  stack location" with "the buffer was retired." Only `clear()` or scope
  end retires a secret.
- **This is the mechanism ownership transfer (§4) uses.** "Ownership
  transfers by move" (§4) and "`SecretHandle` is move-only" (this
  section) are the same fact stated from two angles: there is no other
  way to hand a `SecretHandle` to a new owner.

## 7. Copy prohibition

Restates and extends `docs/secret_lifecycle_implementation_plan.md` §4
and `docs/secret_handle_api_shape.md` §7 as this Arc's own binding rule,
generalized beyond `SecretHandle` to every layer:

- **No real-secret-holding type derives or implements `Copy` or `Clone`,
  anywhere in the stack** — not in Rust (already binding), and, should a
  future stage ever introduce a Runtime-side wrapper type at all (it
  should not hold bytes — see §11's "Runtime never deserializes a byte
  buffer" rule), not there either.
- **A copy is not just a memory-safety concern but a lifetime-audit
  concern (§12)**: every additional copy of a Secret Buffer is a second
  location that must independently reach retirement (§3) for the
  secret's true lifetime to actually end — "no copies" is what makes "one
  owner, one lifetime" (§4) a claim that is actually checkable rather
  than aspirational.
- **Serialization is a copy.** `Serialize`/`JSON.stringify`/`structuredClone`/
  an IPC message payload containing raw bytes are all, for this Arc's
  purposes, copy operations subject to the same prohibition — this is
  why §11 requires the IPC layer to carry only opaque, non-byte
  references, never a serialized buffer.

## 8. Zeroization

- **Every Secret Buffer is zeroized (overwritten with a fixed
  non-secret pattern) at retirement (§3)** — restates
  `docs/secret_lifecycle_implementation_plan.md` §6 as this Arc's binding
  floor, not a re-decision.
- **Zeroization is a Rust-only mechanism.** `zeroize`/`ZeroizeOnDrop`
  operate on the one buffer Rust owns (§2); no Runtime/UI-side "clear my
  local copy" step exists, because no Runtime/UI-side copy is ever
  authorized to exist (§7, §11).
- **Zeroization is the guarantee made — not a guarantee that no trace of
  the secret ever existed in process memory.** This Arc does not relax or
  strengthen the honest limitations `docs/secret_lifecycle_implementation_plan.md`
  §10 already names (compiler-introduced copies, moves the optimizer
  implements as a memory copy, spilled registers) — see §10 below for the
  OS-level protections that narrow, but do not close, that gap.

## 9. Drop behavior

- **`Drop` is the backstop, not the primary retirement path.** The
  primary path is an explicit `clear()` call at the moment a caller knows
  a secret's useful life has ended (e.g., after a conversation's
  capability material is superseded); `Drop` exists so that a caller who
  forgets, or a scope that ends via an early return or a `?`-propagated
  error, still zeroizes the buffer — restates
  `docs/secret_lifecycle_implementation_plan.md` §6's "so the memory is
  overwritten when the value goes out of scope, not left for the
  allocator to reuse silently."
- **Drop must not panic, log, or perform I/O.** A `Drop` impl that could
  fail is a `Drop` impl that could leave a secret un-zeroized on the
  unwind path — this Arc requires any future `Drop`/`ZeroizeOnDrop`
  implementation for a real-secret type to be infallible by construction
  (pure byte overwrite, nothing else).
- **Calling `clear()` and then letting `Drop` run is not double-zeroization
  in any harmful sense** — `docs/secret_memory_test_strategy.md` §4
  already requires the idempotency property ("calling `clear()` a second
  time does not panic... clearing an already-cleared handle must be a
  safe no-op"); `Drop` running after an explicit `clear()` is exactly
  that second call.
- **Panic-time drop behavior is explicitly NOT guaranteed** — restates
  `docs/secret_lifecycle_implementation_plan.md` §7 and
  `docs/secret_handle_api_shape.md` §9 without relaxing them: a panic
  while a Secret Buffer is live remains a named, open limitation, not
  something this Arc's UI/IPC/Runtime layering silently fixes by adding
  process-wide panic hooks or `unsafe` — closing that gap, if ever, is
  its own separate, explicitly-reviewed future stage.

## 10. mlock / VirtualLock / Page locking / Swap avoidance / Memory wiping

**This entire section is a future Rust responsibility. No TypeScript
code, IPC layer, or Runtime module ever calls, wraps, or depends on any
mechanism named in this section.**

- **`mlock`/`munlock` (POSIX)** and **`VirtualLock`/`VirtualUnlock`
  (Windows)** are OS syscalls that pin a memory page so the kernel will
  never write it to swap/pagefile. A future stage that wants this
  protection for `SecretHandle`'s buffer would call these through a
  native Rust dependency (e.g. `region`, `memsec`, or a hand-written
  `libc`/`windows-sys` FFI wrapper) — **not adopted by this document**,
  named here only so a future implementation stage has a fixed
  vocabulary and does not need to research OS primitives under
  implementation pressure.
- **Page locking** is the general term for the `mlock`/`VirtualLock`
  effect above; **swap avoidance** is why it matters (§10's whole
  motivation: a page written to swap/pagefile before zeroization
  persists on disk, outside the process's own memory-safety guarantees
  entirely — `docs/secret_lifecycle_implementation_plan.md` §10 already
  names "OS/hardware paging" as an unresolved limitation this Arc's
  eventual page-locking stage would be the first attempt to close).
- **Memory wiping** in this section's specific sense means the OS-level
  guarantee that an unlocked page, once freed, may still be read by
  another process until the kernel reuses and clears it — mlock/VirtualLock
  do not wipe memory; they only prevent swap. Wiping remains
  `zeroize`'s job (§8); page locking is a **complementary**, separate
  protection, not a replacement for it.
- **This protection, once built, would be Windows- and platform-specific**
  (`VirtualLock` vs `mlock` are different APIs with different failure
  modes — e.g. per-process locked-page quotas the OS enforces, which a
  future stage must handle as a fallible operation, not assume always
  succeeds) — this is named explicitly because this repository's current
  target platform is Windows-hosted Electron
  (`docs/fedos_wasm_boundary.md`, `src/desktop/host`), and a future stage
  must not assume POSIX `mlock` semantics are what actually ships first.
- **A WASM target has no page-locking primitive at all** — `mlock`/`VirtualLock`
  are native-OS syscalls with no WASM equivalent; if this crate's WASM
  target (`docs/fedos_core_wasm_safety.md`) is ever used for a real-secret
  path, page locking is simply unavailable there, and that limitation
  must be stated plainly (per this repository's standing ban on
  unfalsifiable security language,
  `docs/anti_analysis_shadow_vault_risks.md` §11) rather than implied to
  be covered.
- **None of this is adopted, scheduled, or authorized by this document.**
  It is named so that when a future stage proposes it, that stage can
  cite a fixed vocabulary (`mlock`/`VirtualLock`/page locking/swap
  avoidance/wiping as five distinct, related-but-not-identical concepts)
  instead of inventing overlapping terms mid-review.

## 11. UI → IPC → Runtime → Rust

The full path a secret-touching OPERATION (never a secret BYTE) travels,
today and after this Arc:

```
UI (Electron renderer / React)
  │  opaque request (no secret bytes) — e.g. "derive this conversation's key"
  ▼
IPC (Electron preload/main bridge, src/desktop/host)
  │  opaque request, forwarded unchanged — no secret bytes ever serialize here
  ▼
Runtime (src/runtime/*, src/crypto/types.ts's CryptoProvider seam)
  │  opaque request/handle — CryptoProvider.deriveKey()/.encrypt()/.decrypt()
  │  already carry only keyRef/plaintextRef/ciphertextRef STRING HANDLES
  │  (src/crypto/types.ts, Stage 34) — never raw bytes, today or after this Arc
  ▼
Rust (packages/fedos-core-rust)
  │  resolves handles to real SecretHandle values INTERNALLY
  │  Secret Buffer lives, is used, and is retired — entirely here
```

- **What crosses each arrow: an opaque handle/label and a non-sensitive
  decision — never a byte.** This is not a new rule this Arc invents —
  `src/crypto/types.ts`'s own Stage 34 header already states it
  ("Requests carry OPAQUE, non-secret handles and labels ONLY... this
  TypeScript boundary neither transports nor stores secret material").
  This Arc's contribution is naming the FULL four-layer path explicitly
  (UI and IPC were previously implicit/undescribed) and fixing that the
  same rule applies at every hop, not just the Runtime/Rust boundary
  `crypto/types.ts` already covers.
- **UI never constructs, receives, or displays a secret byte, in any
  form** — not hex, not base64, not a truncated preview. UI may display a
  `SecretView` (§14) — a label/state snapshot — never bytes.
- **IPC is a pure pass-through for these opaque requests.** The
  Electron/preload boundary (`src/desktop/host`) does not decrypt,
  inspect, or transform a secret-touching request's payload — it
  forwards the same opaque handle/label structure `crypto/types.ts`
  already defines. If IPC serialization (structured clone, JSON, or an
  Electron `ipcRenderer.invoke` payload) ever needs to carry something
  secret-shaped, that is itself a violation of this section, not a
  detail to work around with additional obfuscation.
- **Runtime is the resolver, not the holder.** `CryptoProvider`
  implementations (present and future) hold no secret state of their
  own — every `keyRef`/`plaintextRef`/`ciphertextRef` is a label the Rust
  layer alone knows how to resolve to a real `SecretHandle`. A future
  Runtime-side implementation must not cache, log, or persist a
  resolved value between calls.
- **Rust is the only layer with a Secret Buffer (§2).** Every
  responsibility named in §2–§10 belongs here and nowhere else in the
  diagram above.

## 12. Secret lifetime audit

A **secret lifetime audit** is a review, performed BEFORE the
Runtime/Worker crypto activation gate (`docs/runtime_crypto_threat_model.md`)
is ever opened, that traces one real secret's lifetime (§3) end to end
and confirms every claim in §2–§11 holds for the actual shipped code, not
just this document's prose. This Arc does not perform that audit — it
fixes what the audit must check:

1. **Single Secret Buffer, single owner** (§2, §4) — grep/trace every
   construction site of the real-secret type and confirm exactly one
   live buffer exists per logical secret at any point in the trace.
2. **No copy crossed a layer boundary** (§7, §11) — inspect every
   IPC message shape and Runtime-side request/response type actually
   exchanged during the traced operation and confirm none contains a
   byte array, string, or serialized form that could reconstruct the
   secret.
3. **Retirement actually ran** (§3, §8, §9) — confirm `clear()` or
   `Drop` executed on every path out of the traced operation, including
   error/early-return paths, not just the success path.
4. **No borrow outlived its call** (§5) — confirm no reference to the
   live buffer was captured in a struct field, closure, or `await`-spanning
   local that could observe a stale or already-cleared buffer.
5. **No `String`/`Vec<u8>` was used as an intermediate container** (§13,
   §7) anywhere along the traced path, including inside Runtime-side glue
   code, not just inside `packages/fedos-core-rust` itself.

**This audit is a future, one-time (or per-major-change) manual/tooled
review, not a CI gate this document creates.** A future stage may choose
to automate parts of it (e.g. a source-string guard test extending the
pattern `docs/secret_memory_test_strategy.md` §6–§7 already uses) — that
automation is that stage's own decision, not authorized or scheduled
here.

## 13. String prohibition

- **No real secret byte is ever represented as a `String`, `&str`,
  `Vec<u8>` cast to a string, or any text encoding (hex, base64) of a
  secret, at any layer, at any point in its lifetime.** This restates
  `docs/secret_handle_api_shape.md` §5's forbidden-input rule ("`String`/password
  input remains FORBIDDEN") and `docs/secret_memory_test_strategy.md` §7's
  no-`String`-in-the-type rule, generalized here to the FULL stack (UI/IPC/Runtime),
  not just the Rust type's own fields.
- **Why**: a `String` is heap-allocated, may be reallocated/copied by
  ordinary string operations (concatenation, slicing that
  copies-on-write in some runtimes), and — in TypeScript/JavaScript
  specifically — strings are immutable and may be interned by the engine,
  meaning there is no reliable way to overwrite a JS string's backing
  memory at all (restates `docs/secret_lifecycle_implementation_plan.md`
  §6's "Python/JS cannot reliably zero memory: immutable strings/bytes,
  GC, interning, and copies mean plaintext can linger" as the reason this
  prohibition extends all the way up to the UI layer, not just the Rust
  boundary).
- **Explicit carve-out — this prohibition does not retroactively apply
  to `FedosConversationCapabilityBearerSecret`
  (`src/conversation/capability/fedos_conversation_capability_bearer_secret.ts`,
  Alpha 778).** That type is a branded `string`, but it is NOT real
  cryptographic secret material — its own header states it is generated
  by an injected, non-cryptographic `FedosConversationCapabilitySecretGenerator`
  and exists purely as a capability-redemption bearer token, predating
  and orthogonal to this Arc's real-secret-memory architecture. This
  document does not change, deprecate, or flag that type; it fixes the
  String prohibition for real key/seed/plaintext material once real
  Rust cryptography is eventually activated (§11), which is a separate
  concern from an application-level bearer-token string. See §16 for
  how the two systems relate without conflating them.
- **Non-secret labels remain strings, always** — `SecretHandleKind`'s
  variant names, status labels, error reasons: none of these hold or
  derive from secret bytes (§8's "not even their length" rule from
  `docs/secret_lifecycle_implementation_plan.md` §5 already covers the
  narrower case), so this prohibition never forces those to become some
  other type.

## 14. `Secret<T>`, `SecretHandle`, `SecretView`

Three distinct type tiers, not synonyms, spanning the four-layer diagram
in §11:

| Type | Layer | Status | Role |
|---|---|---|---|
| **`SecretHandle`** | Rust | **Shipped** (Stage 79, real bytes Stage 144–146) | The one concrete, non-generic container that exists TODAY. Holds a `[u8; 32]` real-secret buffer, `pub(crate)`-at-most, exactly as `docs/secret_handle_api_shape.md` fixed it. Unchanged by this document. |
| **`Secret<T>`** | Rust | **Named, not authorized** | A future GENERALIZATION of `SecretHandle` — a generic container over an arbitrary fixed-size secret shape `T` (mirroring `secrecy::Secret<T>`/`SecretBox<T>`, the upstream crate `SecretHandle` already wraps internally per §8 of `docs/secret_lifecycle_implementation_plan.md`), for a future world where more than one fixed secret shape (beyond today's single `[u8; 32]`, `docs/secret_handle_api_shape.md` §5) needs this container's guarantees. **This document does not propose generalizing `SecretHandle` now** — it fixes the name `Secret<T>` as the vocabulary slot for that eventual generalization so a future stage does not invent a competing name (`SecretBuffer<T>`, `Sensitive<T>`, ...) mid-review. Whether that generalization is ever built is an open, future, separate decision. |
| **`SecretView`** | Runtime / IPC / UI | **NEW — named by this document, not authorized as code** | A non-owning, read-only, non-sensitive DESCRIPTOR of a live secret that exists in Rust, for use ONLY above the Rust boundary (Runtime, IPC, UI). Carries exactly the same class of information `SecretHandleStatus`/`SecretHandleKind` already expose (state label, kind label, an opaque reference id) and NOTHING else — never a byte, never a length that narrows the secret down, never `Clone`d into a byte-bearing form. A `SecretView` answers "is a secret currently held, and roughly what kind" for UI display purposes (e.g. a settings screen showing "device key: present" ) — it never answers "what is it." |

- **`SecretView` is the ONLY type of these three that a UI or IPC layer
  may ever hold.** It is the concrete shape the "opaque handle/label"
  language in §11 refers to when the payload crossing IPC needs to
  describe a secret's STATE (not perform an operation with it) —
  e.g. a status query. An operation REQUEST (derive/encrypt/decrypt) uses
  the `keyRef`/`plaintextRef`/`ciphertextRef` string-label shape
  `src/crypto/types.ts` already defines; a `SecretView` is the shape a
  STATUS RESPONSE would take. Both are opaque-label shapes; `SecretView`
  is named separately here because it specifically answers "what is the
  state of a thing that already exists," which §11's request types do
  not attempt to.
- **`SecretView` is not a downgrade of the copy prohibition (§7).** A
  `SecretView` is not a copy of the Secret Buffer — it never held bytes
  in the first place, so there is nothing in it for zeroization (§8) to
  apply to. It may be freely cloned, logged (state/kind labels are
  non-sensitive, §13), and serialized across IPC precisely because it was
  designed, from the start, to carry no sensitive content.

## 15. Memory fragmentation

- **Fragmentation is named here as an observation, not a problem this
  Arc solves.** A long-lived process (the Electron main process, or a
  future long-lived Runtime worker) that repeatedly provisions and
  retires many `SecretHandle`-shaped buffers over its lifetime can, like
  any allocator-managed program, fragment its heap — freed secret-buffer
  slots become irregularly-sized holes the allocator may or may not reuse
  efficiently.
- **This is an allocator-efficiency concern, not a secrecy concern, and
  this Arc does not conflate the two.** Zeroization (§8) already
  guarantees the CONTENT of a freed slot is overwritten before/at free
  time; fragmentation is about whether that slot's SPACE is reused
  efficiently afterward, which has no bearing on whether the secret it
  once held is recoverable.
- **A future stage MAY choose a fixed-size secret-buffer pool/arena**
  (allocating a small number of same-sized slots up front and cycling
  `SecretHandle` construction through them) specifically to bound
  fragmentation AND to make page-locking (§10) practical — locking a
  small, fixed set of pages is far more tractable than locking an
  unbounded number of ad hoc heap allocations, and per-process locked-page
  quotas (§10) make an unbounded-allocation strategy risk silently
  failing to lock some secrets and not others. **This is named as a
  design option for a future stage, not adopted here** — no pool/arena
  type, size, or allocation strategy is fixed by this document.

## 16. Capability interaction

- **This Arc's real-secret architecture (§2–§14) and the existing
  conversation-capability system
  (`src/conversation/capability/fedos_conversation_capability_bearer_secret.ts`,
  Alpha 761–790) are two separate systems that do not currently
  intersect, and this document does not merge them.**
  `FedosConversationCapabilityBearerSecret` is an
  application-level authorization token (a bearer value proving
  membership/permission), generated by an injected non-cryptographic
  generator, compared via a length-independent-of-early-exit string
  comparison (`fedosConversationCapabilityBearerSecretsMatch`) — it is
  not, and does not claim to be, key material, and is explicitly out of
  scope for `SecretHandle`/`Secret<T>`'s zeroize/page-lock guarantees.
- **The interaction point, if one is ever built, is a FUTURE stage's
  decision, named here only as a question this document does not
  answer**: should a future capability-bearer secret ever be upgraded to
  use real cryptographic randomness (rather than an injected
  non-cryptographic generator) or be bound to a real
  Rust-held key, that upgrade would need its OWN review of which of §2–§14's
  rules apply to it — this document neither authorizes nor schedules
  that upgrade.
- **Rust crate-side capability labeling (`docs/crypto_capability_matrix.md`'s
  `CryptoCapability::SecretHandle` variant) already names `SecretHandle`
  as a tracked capability** — this Arc adds no new variant to that
  enumeration; `Secret<T>` (§14), being unauthorized/unbuilt, has no
  capability-matrix entry either, and would need one only if and when it
  is ever actually implemented.
- **A `SecretView` (§14) is not a capability grant.** Observing that a
  secret exists and roughly what kind it is (via `SecretView`) confers no
  permission to use it — any future authorization check for WHETHER an
  operation on a Rust-held secret is permitted is the conversation
  capability system's job (or a future Rust-side policy, mirroring
  `docs/runtime_crypto_threat_model.md`'s existing fail-closed activation
  gate), never something `SecretView` itself decides.

## 17. Threat model interaction

- **This document extends, and is bound by, `docs/runtime_crypto_threat_model.md`'s
  existing fail-closed guarantee.** That document proves a misconfigured
  env var cannot, by itself, turn on real cryptography. This Arc's entire
  UI → IPC → Runtime → Rust architecture (§11) is additional, deliberately
  duplicated safety on top of that gate — even AFTER the gate is
  eventually opened (a separate future decision that document already
  anticipates), a secret byte still cannot reach the UI or IPC layer,
  because those layers structurally never carry one (§11), independent
  of whether the crypto gate itself is open or closed. **Two independent
  reasons a secret cannot leak upward: the crypto gate (denies the
  operation entirely) and this Arc's layering (denies the byte a path
  even if the operation were allowed)** — restating
  `docs/runtime_crypto_threat_model.md` §2's "multiple independent
  layers, not one" principle at a different point in the stack.
- **This document does not claim to defend against a compromised Rust
  build/deploy pipeline, a compromised OS kernel, or a physically
  present attacker with debugger/core-dump access** — restating
  `docs/runtime_crypto_threat_model.md` §3's own scope limits: this is an
  in-process, in-transit architecture, not a supply-chain or physical-security
  guarantee.
- **This document does not claim WASM parity.** Per §10 and
  `docs/fedos_core_wasm_safety.md`, a WASM-compiled path (if the
  Runtime/Worker crypto activation gate is ever opened for a WASM target
  specifically, rather than a native Rust process) would lack page-locking
  entirely and has its own, separately-documented memory model — this
  Arc's §10 protections are native-Rust-process-only claims, not extended
  to WASM by implication.
- **No new threat is introduced by this document, because no code is
  introduced by this document** — the threat model this Arc interacts
  with is unchanged; this Arc only fixes, in writing, the architecture a
  future implementation stage must build to keep that threat model's
  existing guarantees true once a live secret actually exists above the
  Rust boundary.

## 18. Rust responsibilities vs. TypeScript responsibilities — explicit split

| Responsibility | Owner | Section |
|---|---|---|
| Allocating the Secret Buffer | **Rust** | §2 |
| Holding the Secret Buffer for its entire lifetime | **Rust** | §3 |
| Enforcing single ownership | **Rust** (compiler-enforced) | §4 |
| Enforcing borrow rules | **Rust** (compiler-enforced) | §5 |
| Move semantics | **Rust** (compiler-enforced) | §6 |
| Forbidding `Clone`/`Copy` on the real-secret type | **Rust** | §7 |
| Zeroization on `clear()`/`Drop` | **Rust** | §8, §9 |
| `mlock`/`VirtualLock`/page locking | **Rust** (future, unbuilt) | §10 |
| Resolving opaque handles to real secrets | **Rust** | §11 |
| Constructing/returning `SecretHandle`/`Secret<T>` values | **Rust** | §14 |
| Sending an opaque request (never a byte) | **TypeScript** (UI, IPC, Runtime) | §11 |
| Displaying a `SecretView` | **TypeScript** (UI) | §11, §14 |
| Passing an opaque request through unmodified | **TypeScript** (IPC) | §11 |
| Resolving an opaque request to a `CryptoProvider` call | **TypeScript** (Runtime) | §11 |
| Never constructing a `String`/`Vec<u8>` that holds secret bytes | **Both** — Rust enforces it in its own types (§13, already binding); TypeScript enforces it by NEVER receiving secret bytes in the first place, so the prohibition is structural, not a discipline TS code must remember | §13 |
| The conversation-capability bearer-secret system | **TypeScript** (existing, unchanged, out of scope) | §16 |
| The Runtime/Worker crypto activation gate | **TypeScript** (existing, unchanged, `docs/runtime_crypto_threat_model.md`) | §17 |

**The single-sentence version of this split**: Rust owns every byte;
TypeScript owns every decision about WHETHER an operation on those bytes
happens, and never sees the bytes it is deciding about.

## 19. What this document does NOT do

- Does not add a field, method, type, or trait impl to `SecretHandle` or
  any other Rust type.
- Does not adopt `mlock`, `VirtualLock`, `region`, `memsec`, or any
  native page-locking dependency.
- Does not implement, wire, or schedule `Secret<T>` as a generalization
  of `SecretHandle` — it only reserves the name.
- Does not implement, wire, or schedule `SecretView` as a TypeScript
  type — it only fixes the shape a future implementation must follow.
- Does not open, narrow, or otherwise touch the Runtime/Worker crypto
  activation gate (`docs/runtime_crypto_threat_model.md`).
- Does not change `FedosConversationCapabilityBearerSecret` or any file
  under `src/conversation/capability/`.
- Does not touch `Cargo.toml`, any `.rs` file, or any `test/` file.
- Does not add a new `docs/secure_runtime_alpha_*_execution_spec.md` /
  `..._completion_declaration.md` pair — this Arc's single deliverable is
  this document plus the README status update (§20).

## 20. Review notes — tests and typecheck

- **No test file is added, changed, or expected to change by this
  document** — it is a specification with no code surface to test.
- `npm run typecheck` and `npm test` are expected to remain exactly as
  green as they were before this Arc, since no `.ts`/`.tsx` file changes.
  `cargo check`/`cargo test`/`cargo check --tests` are expected to remain
  exactly as green as before, since no `.rs`/`Cargo.toml` file changes.
- **A future stage that implements any part of §2–§18 must satisfy the
  existing test-gate pattern this repository already established** for
  `SecretHandle` (`docs/secret_memory_test_strategy.md` §2–§7) and extend
  it, not replace it, for whichever new surface (`Secret<T>`,
  `SecretView`, a page-locking wrapper) that future stage adds — this
  document does not author new test gates beyond pointing at that
  existing pattern as the one to follow.

## 21. Conclusion

- **Exactly one Secret Buffer exists in the whole stack, and it lives in
  Rust** — every other layer (UI, IPC, Runtime) carries opaque
  handles/labels/`SecretView` descriptors only, never a byte, restating
  and extending `src/crypto/types.ts`'s already-shipped Stage 34 design
  across the full four-layer path for the first time in writing.
- **Ownership, borrowing, move semantics, and copy prohibition are one
  coherent story**: a `SecretHandle` (or its future `Secret<T>`
  generalization) has exactly one owner, is borrowed only by shared
  reference for the duration of one call, moves rather than copies, and
  never derives `Clone`/`Copy` — four angles on the same "one buffer, one
  lifetime" guarantee.
- **Zeroization and Drop are the guarantee made; panic-safety,
  compiler-introduced copies, and OS paging are the honestly-named
  limitations** — this Arc changes none of those existing, binding
  claims.
- **`mlock`/`VirtualLock`/page locking are future Rust-only work**,
  named here in fixed vocabulary so a future stage does not have to
  invent it under pressure — not adopted, not scheduled, not claimed as
  already protecting anything today.
- **`Secret<T>` and `SecretView` are new names, not new code** — the
  first reserves a future generic Rust container; the second fixes the
  one shape a UI/IPC/Runtime layer is ever allowed to hold instead of a
  byte.
- **The capability system and the crypto activation gate are existing,
  unchanged systems this Arc interacts with but does not modify** — this
  document is additive vocabulary and layering discipline on top of
  decisions already made, single-commit, docs-only, on its own branch.
