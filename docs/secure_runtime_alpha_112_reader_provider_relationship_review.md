# Secure Runtime Alpha 112 — Reader / Provider Relationship Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO code
change of any kind — no file under `src/` is touched. This document
and its own guard test are the entire deliverable. This is Stage 2 of
the Alpha 111–115 Identity Authority Design Arc.**

## 1. Why now

Alpha 111 fixed `FedosRuntimeIdentity` ("Runtime") as the sole
Identity Authority, reached through `FedosIdentityProvider`
("Provider"). Desktop separately holds a `FedosPublicIdentityReader`
("Reader"). Neither Alpha 101 (which introduced Reader) nor any Stage
since has formally fixed the RELATIONSHIP between Reader and Provider
— this Stage does.

## 2. Candidates compared

- **1. Reader is Provider's input.** Provider would internally consume
  a Reader to obtain its own data.
- **2. Reader is Provider's alternative/substitute.** Desktop could
  use Reader INSTEAD of the Bootstrap/Provider pipeline to obtain
  identity.
- **3. Reader and Provider are independent.** Neither depends on,
  substitutes for, or feeds the other; they serve different consumers
  for different purposes.
- **4. Reader is an Adapter.** Reader exists specifically to adapt
  something into something else.

## 3. Grounding against the actual source

- `NostrIdentityProvider`'s own constructor
  (`src/identity/fedos_nostr_identity_provider.ts`, Alpha 035/039/049)
  takes a `FedosNostrPublicIdentitySource` directly — NOT a
  `FedosPublicIdentityReader`. Provider has never read from, imported,
  or referenced Reader in any way, at any Stage.
- `NostrPublicIdentityReader` (`src/desktop/nostr_public_identity_reader.ts`,
  Alpha 103) likewise takes a `FedosNostrPublicIdentitySource` directly
  — NOT a Provider. Reader has never read from, imported, or
  referenced Provider in any way, at any Stage.
- Alpha 105 and Alpha 110 both confirmed, empirically, that the two
  paths reach SEPARATE Source instances — even of the identical class
  (`NullNostrPublicIdentitySource`) — with zero code-level connection.
  Alpha 110 additionally confirmed that configuring Reader (via
  `createDesktopApplication(publicIdentity)`) has ZERO effect on
  `FedosRuntimeIdentity.currentIdentity()`.

## 4. Evaluation of each candidate

- **1 (Reader is Provider's input) — rejected.** Would require
  changing `FedosIdentityProvider`'s own constructor signature or
  `FedosIdentityService`'s own composition to accept a Reader — a real
  code change this Stage's own "Design Review, minimal code"
  discipline forbids, and, more fundamentally, would pull Desktop's
  own Reader concept INTO the Identity Layer's internal Bootstrap
  pipeline — directly contradicting Alpha 102's own Decision that a
  Reader is Desktop's own, separate concern, permanently excluded from
  `FedosRuntimeIdentity` and everything it internally composes.
- **2 (Reader is Provider's substitute) — rejected.** Would let
  Desktop bypass Runtime's own Bootstrap/Provider pipeline entirely
  for reading identity — directly reopening Alpha 111's own Decision
  that Runtime is the SOLE Authority. If Reader could substitute for
  Provider, Reader would become a second, competing Authority for
  identity data, exactly the ambiguity Alpha 111 exists to close.
- **4 (Reader is an Adapter) — reframed, not adopted as the answer.**
  Reader IS, internally, shaped like an adapter — it adapts a
  `FedosNostrPublicIdentitySnapshot` into a `FedosIdentityDescriptor`,
  the SAME transformation Provider also performs, independently, over
  its OWN Source instance. This is true, but it describes Reader's OWN
  internal shape, not its RELATIONSHIP to Provider — the question this
  Stage actually asks. Provider is, by the same reasoning, ALSO an
  adapter. Both being "an adapter" in the general pattern sense does
  not by itself establish any relationship BETWEEN them.
- **3 (Reader and Provider are independent) — adopted.** Matches the
  actual, confirmed architecture precisely (§3): no import, no shared
  instance, no call from one into the other, at any Stage in this
  project's history. Consistent with Alpha 111's own Decision — since
  Runtime/Provider alone carries Authority, Reader correctly does NOT
  compete for it by remaining structurally separate.

## 5. Decision

**Reader and Provider are PERMANENTLY INDEPENDENT. Reader serves
Desktop's own read-only convenience use case; Provider serves
Runtime's own Bootstrap/Authority pipeline (Alpha 111). Neither is the
other's input, substitute, or adapter TO the other — both
independently happen to be shaped like an adapter OVER their own
Source, a structural similarity that does not create a relationship
BETWEEN them.**

This Decision does not forbid a FUTURE, separately-scoped Stage from
deliberately connecting them for a concrete, named reason — it fixes
that, absent such a Stage, no connection exists or is assumed, and
that today's actual architecture (zero connection) is the CORRECT,
intentional state, not an oversight.

## 6. What this Stage does NOT do

- Does **not** modify `FedosIdentityProvider`, `NostrIdentityProvider`,
  `FedosPublicIdentityReader`, `NostrPublicIdentityReader`, or any
  other `src/identity/*` or `src/desktop/*` file.
- Does **not** connect Reader and Provider in any way.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, GUI, or Observation of any kind.

## 7. See also

- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_102_desktop_identity_reader.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
- `docs/secure_runtime_alpha_105_integration_verification.md`
- `docs/secure_runtime_alpha_110_integration_verification.md`
- `docs/secure_runtime_alpha_111_identity_authority_review.md`
