# Review 12 — Runtime Ownership

## Candidates

- **`FedosBoardRuntime`** (`src/board/runtime/fedos_board_runtime.ts`)
  — the ONLY class that constructs a Conversation record today (`01`),
  but its own header is explicit about scope: "PUBLIC MODE ONLY, per
  this Arc's own instruction," and its own dependency list (`FedosPublicAuthorAuthority`,
  `FedosConversationPolicyAuthority`, `FedosConversationPersistence`)
  has no reference anywhere to Membership, Capability, Retention, or
  Payload Storage — none of Alpha 761–850's own domains are imported
  by this file at all, confirmed by direct reading.
- **A new `FedosConversationRuntime`** — does not exist anywhere in
  `src/` today (`01`).
- **`FedosDesktopHost`/Local Runtime** (`src/desktop/host/fedos_desktop_host.ts`,
  `src/desktop/runtime/fedos_desktop_runtime.ts`) — owns PROCESS
  lifecycle (`start()`/`stop()`), Board hydration order, and
  `FedosBoardQuery` construction; holds no reference to any
  `src/conversation/` domain object today.
- **Host (the same class, considered separately as "resource
  lifecycle owner")** — per this review's own required framing,
  distinct from "command orchestration owner."

## Why overloading `FedosBoardRuntime` further is the wrong direction

`FedosBoardRuntime`'s own header ALREADY lists nine explicit
"NOT this class's responsibility" items (Host lifecycle, filesystem,
Publisher execution, retry, crypto, Relay, protocol adapter, GUI) —
adding "private-group/direct construction, Membership orchestration,
Capability issuance, encryption-readiness gating" would be a TENTH+
category of responsibility bolted onto a class whose own name and
history are about BOARD posts. `#recordConversationForRootPost()`
already required the introduction of Conversation Persistence as a
SEPARATE injected dependency rather than folding it into
`FedosBoardPersistence` (Alpha 749's own "never fold into Board
persistence" requirement, confirmed in `01`) — the same reasoning
applies one layer up: Conversation CONSTRUCTION (as opposed to the
narrow "this Board thread also gets a Conversation record" side
effect `FedosBoardRuntime` already performs) is a different
responsibility from Board command orchestration.

## Recommendation: a dedicated `FedosConversationRuntime` — additive, not a replacement

A new class, structurally mirroring `FedosBoardRuntime`'s OWN
construction pattern exactly (injected dependencies, no singleton, no
Host lifecycle ownership, `createFedosConversationRuntime()` factory
matching `createFedosBoardRuntime()`'s own "thin factory only" style):

```ts
export interface FedosConversationRuntimeDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly capabilityIssuerAuthority?: FedosConversationCapabilityIssuerAuthority;
  readonly policyAuthority: FedosConversationPolicyAuthority; // a future, real per-mode implementation (07)
  readonly identityResolver: /* the creator-identity readiness axis, 02 */;
  readonly encryptionReadiness: /* 08's gate function */;
  readonly clock?: FedosBoardRuntimeClock; // reused, not reinvented
}

export class FedosConversationRuntime {
  createPrivateGroupConversation(command: CreatePrivateGroupConversationCommand): Promise<CreatePrivateGroupConversationResult>;
  createDirectConversation(command: CreateDirectConversationCommand): Promise<CreateDirectConversationResult>;
  // 13's read API methods live here too
}
```

This is a NEW peer to `FedosBoardRuntime`, never a wrapper around it
and never a subclass — `FedosBoardRuntime` keeps owning PUBLIC
Conversation construction exactly as it does today (this review
proposes no change to `createPublicThread()`'s own behavior), and
`FedosConversationRuntime` owns `private-group`/`direct` construction
exclusively. Both may share the SAME `FedosConversationPersistence`
instance (both already accept it as an injected dependency; nothing
about the port itself is mode-specific, `01`) without either depending
on the other.

## Host remains lifecycle/resource owner — unchanged

`FedosDesktopHost` gains NO new responsibility under this
recommendation — `FedosConversationRuntime`, like `FedosBoardRuntime`,
is constructed and injected with already-durable ports; it does not
reach into Host for lifecycle, does not call `host.start()`/`stop()`,
and does not require Host to construct or hold a reference to it (an
APPLICATION layer, composed alongside Host by whatever top-level
wiring assembles both — `src/desktop/create_desktop_application.ts` or
equivalent — never inside Host itself). This preserves the EXACT
ownership boundary `FedosBoardRuntime`'s own header already draws
("holds exactly one `FedosDesktopHost` reference, injected — never
constructs, starts, or stops it"), extended to a second Application
class rather than violated by cramming a second concern into the
first.

## Why not fold into Host directly

Host's own `start()` sequence (`01`, `05`) is a single `try`/`catch`
block with a fixed, already-complex step order (hydrate Board → build
Query → start DesktopApplication → ready). Adding Conversation-domain
readiness checks (identity, membership, capability, encryption — `02`)
into THAT sequence would make Host's own startup depend on axes that
have nothing to do with process/Board lifecycle, and would block
EVERY Host start on Conversation-domain readiness even for a purely
public-mode deployment that never constructs a private Conversation at
all — a real regression this review's "prefer adapters over
replacements... minimize ripple" ground rule forbids introducing.
