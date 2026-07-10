# FedOS Secure Runtime Alpha 035 — FedOS Nostr Identity Provider

**Status: IMPLEMENTED — a single class only.** Adds
`NostrIdentityProvider` (`src/identity/fedos_nostr_identity_provider.ts`)
— the FIRST Nostr-specific `FedosIdentityProvider` (Alpha 029)
implementation anywhere in this repository, and the SECOND
`FedosIdentityProvider` implementation overall, after
`NoopFedosIdentityProvider` (Alpha 033). `provider` is the fixed literal
`"nostr"`; `describeIdentity()` always resolves `null`. No constructor,
no configuration, no internal state, no thrown exceptions, no Relay
connection, no Nostr event construction, no signing, no secret key of
any kind. This is the eighth artifact in the FedOS Identity arc (Alpha
028–035), and it is deliberately wired into nothing — not the Resolver
(Alpha 032/034), not the Service (Alpha 031), not the Runtime, not the
Worker.

## 1. Nostr Providerを追加した理由 (why add a Nostr Provider now)

Alpha 027 §8 inventoried Nostr as the "first Protocol Adapter
candidate" for a future FedOS Identity layer, and explicitly deferred
building it: "a Nostr Adapter boundaryの設計レビュー — premature." Alpha
033 §5 later named `NostrIdentityProvider` as the concrete future
sibling `NoopFedosIdentityProvider` was built alongside, without
building it. Alpha 034 §3/§5 continued referring to "a future
`NostrIdentityProvider` (not built)" as the eventual real answer this
arc's Resolver would one day return. This Stage is the first to
actually add that class — on its own, narrowly-scoped merits, matching
exactly how Alpha 033 added the No-op Provider on its own merits rather
than as a side effect of the Resolver's needs:

- It is the first opportunity to confirm a second, independent
  `FedosIdentityProvider` implementation coexists cleanly with the
  first — proving the interface (Alpha 029) is genuinely
  multi-implementation-shaped, not accidentally tailored to fit only
  the No-op case.
- It gives this arc's own documentation a concrete, named, Nostr-labeled
  class to point future Stages at, instead of only ever describing
  Nostr as a hypothetical in prose (Alpha 027 §8, Alpha 033 §5, Alpha
  034 §5 all did this).
- It follows this arc's own established sequencing discipline exactly:
  build the SHAPE first (a class that compiles, type-checks, and
  implements the interface honestly), defer all BEHAVIOR to later,
  separately-reviewed Stages — the same discipline that separated Alpha
  029 (interface) from Alpha 032 (Resolver) from Alpha 033 (first
  implementation) from Alpha 034 (wiring). A Nostr Provider that reads
  real keys, opens real Relay connections, or signs real events is a
  substantially larger, higher-risk piece of work than this Stage's own
  mandate authorizes; this Stage authorizes only the shape.

Building the shape now, with a permanently-`null` `describeIdentity()`,
costs nothing in risk — it is structurally identical in behavior to
`NoopFedosIdentityProvider` today (see §4) — while giving this arc a
real, named, importable class to grow into instead of continuing to
describe Nostr identity only in documentation prose.

## 2. まだdescribeIdentity()がnullである理由 (why `describeIdentity()` still always resolves `null`)

```ts
export class NostrIdentityProvider implements FedosIdentityProvider {
  readonly provider = "nostr";

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return null;
  }
}
```

Three independent reasons, each sufficient on its own, keep this
Stage's `describeIdentity()` body exactly `return null;`:

1. **No secret key exists to read.** A `FedosIdentityDescriptor` (Alpha
   028) requires a `publicIdentifier` — for Nostr, that would be an
   `npub`. Deriving an `npub` requires a key pair to already exist
   somewhere this Provider can reach. No such key pair, vault, or
   signer connection exists anywhere in this repository today (see §6)
   — there is nothing honest for this method to derive a value from.
2. **This Stage's own mandate forbids building the fetching mechanism.**
   Even if a key pair existed, populating `describeIdentity()` with real
   behavior would require deciding HOW an `npub` becomes a
   `publicIdentifier` (direct copy? normalized? validated?), which is a
   separate, unreviewed design decision this Stage does not have
   authorization to make. Scoping this Stage to the class shape only —
   matching exactly how Alpha 033 §1 scoped the No-op Provider to "one
   field, one async method" — keeps that decision correctly deferred.
3. **A fabricated non-`null` value would be actively worse than `null`.**
   Alpha 032 §6 already established, for the Resolver, that "a
   placeholder object would be a worse answer than `null`." The same
   logic applies here at the method level: a hardcoded fake
   `FedosIdentityDescriptor` (e.g. an empty-string `publicIdentifier`)
   would let a future caller believe a real Nostr identity had been
   found when none was ever queried. `null` is the only value that
   truthfully reports "this Provider exists, but has not been asked to
   do, and cannot yet do, anything real."

## 3. Resolverへ接続しない理由 (why this is NOT wired into `resolveFedosIdentityProvider()`)

`resolveFedosIdentityProvider()` (Alpha 032, wired in Alpha 034) still
reads, unmodified:

```ts
export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return sharedNoopProvider;
}
```

Wiring `NostrIdentityProvider` in here — replacing `sharedNoopProvider`
with a `NostrIdentityProvider` instance, or adding a second branch — was
considered and rejected, for reasons distinct from, and stronger than,
"the mandate forbids it":

- **It would silently change every existing caller's behavior for no
  behavioral gain.** `NostrIdentityProvider.describeIdentity()` and
  `NoopFedosIdentityProvider.describeIdentity()` both always resolve
  `null` today (see §4's table) — swapping one for the other changes
  `resolved.provider` from `"noop"` to `"nostr"` for every existing
  caller, changing an observable value, while changing NOTHING about
  what any caller can actually DO with the result. That is a
  behavior-label change disguised as a no-op change, which is worse
  than making no change at all.
- **It would misrepresent this Stage's own scope.** Alpha 034 §1 wired
  in the No-op Provider specifically because "one exists, is fully
  guard-tested" — an honest statement about a Provider whose entire
  contract was already fulfilled. `NostrIdentityProvider` at this Stage
  fulfills its contract (compiles, implements the interface, never
  throws) but has NOT yet fulfilled the reason anyone would want a
  Nostr Provider in the first place (see §5's future-Descriptor plan).
  Wiring it in now would present an empty shell as if it were the real
  answer this arc has been deferring since Alpha 027 §8.
- **This Stage's own explicit mandate forbids it.** "Resolver変更禁止"
  is stated directly, and this Stage respects it as a hard boundary, not
  merely as the reason above restated — even if the two reasons above
  did not independently apply, the mandate alone would be sufficient.

## 4. Noopとの差 (difference from `NoopFedosIdentityProvider`, Alpha 033)

| | `NoopFedosIdentityProvider` (Alpha 033) | `NostrIdentityProvider` (Alpha 035, this Stage) |
|---|---|---|
| **`provider` value** | `"noop"` | `"nostr"` |
| **`describeIdentity()` result, today** | Always `null` | Always `null` |
| **Why it returns `null`** | By definition, permanently — a No-op Provider has nothing to report BY DESIGN, forever | By CURRENT LIMITATION, temporarily — a Nostr Provider has nothing to report YET, because no key/Relay/signer connection has been built (§2) |
| **Expected long-term fate** | Permanent — never expected to report a real identity, ever (Alpha 033 §5) | Temporary — expected to gain a real `describeIdentity()` body in a future, separately-reviewed Stage (§5 below) |
| **Relationship to each other** | SIBLINGS, not a base/derived pair (Alpha 033 §5) — this Stage does not change that; `NostrIdentityProvider` does not subclass, wrap, or import `NoopFedosIdentityProvider` |
| **Wired into the Resolver?** | Yes, since Alpha 034 | No — see §3 |
| **Represents "no identity available" or "not yet implemented"?** | "No identity available," always | "Not yet implemented," at this Stage only |

The two classes are behaviorally IDENTICAL today — both always resolve
`null` from `describeIdentity()` — but that identical behavior means two
structurally different things, exactly as Alpha 033 §4 already
distinguished the Resolver's `null` from the No-op Provider's own
`null`. Collapsing "permanently empty by design" and "not yet built" into
one indistinguishable `null` would erase a fact a future Stage needs:
which Provider is a permanent, safe fallback, and which one is a
placeholder actively waiting to be completed.

## 5. 将来のDescriptor取得予定 (the future Descriptor-fetching plan, not built here)

A future, separately-reviewed Stage would give `describeIdentity()` a
real body. This Stage does not build any of the following — it only
names them, as a plan, so the eventual real work has a documented
starting point instead of being invented from nothing:

1. **A key/signer source would need to exist first**, outside this
   Provider entirely — most plausibly a Vault-style boundary (per
   `docs/vault_crypto_identity.md`'s own "Vault Boundary" — local
   encrypted master-seed storage, unlocked by an auth factor, "no key
   custody in the app") that this Provider could query WITHOUT ever
   holding a secret key itself.
2. **`describeIdentity()` would read a PUBLIC key only.** Consistent
   with Alpha 028's own `FedosIdentityDescriptor.publicIdentifier`
   field being, by name and by design, public and non-sensitive, a real
   implementation's job would be narrowly "ask the key source for a
   public key, format it as `npub`, return it" — never derive, generate,
   or hold the corresponding secret key itself.
3. **No Relay round-trip would be required for this specific method.**
   `describeIdentity()` (Alpha 029) answers "what identity descriptor
   does this Provider currently describe" — a local, already-known-key
   question — not "what does the Nostr network currently say about this
   identity," which would be a different, Relay-dependent question this
   arc has never scoped `FedosIdentityProvider` to answer (Alpha 029 §-
   its own doc comment: "never a sign-in flow, never a state change").
4. **Each of those three steps is its own future Stage**, reviewed
   separately, exactly as this arc has sequenced every prior step
   (interface, then capability, then service, then resolver, then first
   implementation, then wiring, then a second implementation). This
   Stage explicitly claims credit for none of them — it adds the class
   shape only, so a future Stage has a real file and a real, passing
   test suite to extend rather than a blank slate.

## 6. 秘密鍵を扱わない理由 (why no secret key of any kind is handled here)

`fedos_nostr_identity_provider.ts` contains no secret key generation,
no secret key derivation, no secret key storage, no `nsec` handling, and
no reference to `src/nostr/crypto.ts` (this repository's existing
Nostr key-material module) — confirmed by direct inspection of the
file's own imports, which name only `fedos_identity_descriptor.js` and
`fedos_identity_provider.js`. This is not an oversight this Stage works
around; it follows directly from what this Stage is authorized to
build:

- **A class with zero fields beyond a fixed string literal cannot hold
  a secret key.** `NostrIdentityProvider` has exactly one field,
  `readonly provider = "nostr"` — there is no second field, no
  constructor parameter, and no private state of any kind where a key
  could live even accidentally.
- **`describeIdentity()`'s body never reads anything.** Its body is
  exactly `return null;` — no argument, no field read, no import call,
  no side effect. A method that reads nothing cannot read a secret key.
- **Secret key handling was never this Stage's mandate.** The explicit
  scope for this Stage is a class shape whose sole method is
  `return null;` — building key generation, `nsec` parsing, or any
  secret-material handling would be a substantial, unauthorized
  expansion far beyond "Provider追加," and would additionally violate
  this Stage's own explicit "秘密鍵禁止" instruction directly, not merely
  its spirit.
- **This mirrors Alpha 027 §8's own exclusion list.** Alpha 027 §8
  named, and explicitly excluded from any near-term work, "Nostr key
  generation, `npub`/`nsec` conversion, event signing" — this Stage
  continues respecting that exclusion unchanged, seven Stages later.

## 7. What this Stage does NOT do

- Does **not** implement any Relay connection — no import of
  `src/nostr/relay.ts` or `src/nostr/ws_relay.ts` anywhere in this
  Stage's own new file.
- Does **not** construct, parse, publish, or subscribe to any Nostr
  event — no import of `src/nostr/event.ts`, `src/nostr/messages.ts`,
  or `src/nostr/publish.ts`.
- Does **not** sign or verify any signature — no import of
  `src/nostr/signature.ts` or `src/nostr/noble_signature.ts`.
- Does **not** generate, derive, read, or store any secret key,
  `nsec`, or `npub` — no import of `src/nostr/crypto.ts` (see §6).
- Does **not** implement any Direct Message (DM) feature of any kind.
- Does **not** wire `NostrIdentityProvider` into
  `resolveFedosIdentityProvider()` (Alpha 032/034) — the Resolver
  remains byte-for-byte unchanged, still returning the shared
  `NoopFedosIdentityProvider` singleton.
- Does **not** modify `fedos_noop_identity_provider.ts` (Alpha 033) —
  `NoopFedosIdentityProvider` is untouched, and this Stage's own class
  does not subclass, wrap, or import it.
- Does **not** wire `NostrIdentityProvider` into `FedosIdentityService`
  (Alpha 031), the Runtime, or `src/worker.ts` — it has zero importers
  by design.
- Does **not** add authentication, login, session, or credential
  handling of any kind.
- Does **not** add any Storage read or write of any kind.
- Does **not** add a constructor, configuration, internal state, or any
  field beyond the fixed `provider` literal.
- Does **not** throw an exception under any circumstance.
- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028).
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029).
- Does **not** modify `fedos_identity_capability.ts` (Alpha 030).
- Does **not** modify `fedos_identity_service.ts` (Alpha 031).
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha
  032/034).
- Does **not** change any `src/runtime/*` file or any Public Runtime
  API signature.
- Does **not** change `src/worker.ts`.
- Does **not** change any existing `src/nostr/*` file.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 8. See also

- `docs/secure_runtime_alpha_034_fedos_noop_resolver_wiring.md` (Secure
  Runtime Alpha 034) — the unmodified, No-op-returning Resolver this
  Stage's §3 explains the deliberate non-connection to.
- `docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md`
  (Secure Runtime Alpha 033) — `NoopFedosIdentityProvider`, this Stage's
  §4 comparison point and named future sibling since its own §5.
- `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
  (Secure Runtime Alpha 032) — the "placeholder object would be a worse
  answer than `null`" reasoning this Stage's §2 reason 3 continues.
- `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
  (Secure Runtime Alpha 031) — the unmodified `FedosIdentityService`
  this Stage leaves untouched.
- `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
  (Secure Runtime Alpha 029) — the `FedosIdentityProvider` contract this
  Stage's class is the second to implement, and the "never a sign-in
  flow" exclusion this Stage's §5 continues respecting.
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` (Secure
  Runtime Alpha 028) — the `FedosIdentityDescriptor` shape, including
  its public-only `publicIdentifier` field this Stage's §5 plan is
  scoped around.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — §8's "Nostr Adapter — first Protocol
  Adapter candidate" framing this Stage finally gives a named class to,
  and its own key-generation/signing/relay exclusion list this Stage's
  §6 continues.
- `docs/vault_crypto_identity.md` — the "Vault Boundary" design note
  this Stage's §5 plan names as the future key/signer source a real
  implementation would query.
