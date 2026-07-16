# 14 — Operator Non-Linkability Claims

## The claim this section exists to discipline

"The operator can't tell who's talking to whom" is a claim about the
ENTIRE observable system, not about the application database schema
alone. This review's own instruction is explicit: not storing
`accountId` in an application table is necessary but nowhere near
sufficient, and this section must name the full observability surface a
real non-linkability claim would have to survive — most of which is
outside this repository's own source code, and this review says so
plainly rather than pretending otherwise.

## Observability surface, itemized

- **IP logs.** Outside this repository's scope entirely — whatever
  hosts the Desktop Host process, or any future server-side component,
  controls its own network-layer logging. This codebase's own
  confirmed architecture (§01/§07: only Desktop Host/Node has real
  filesystem access; Cloudflare Workers is the only other real
  environment, per `docs/secure_runtime_alpha_348_deployment_review.md`)
  means a Worker-hosted future component would inherit Cloudflare's
  own edge-request logging by default, unless explicitly disabled at
  the infrastructure layer — a decision this review names as required,
  not one it can make from source code alone.
- **Reverse proxy logs.** Same category — infrastructure-layer, not
  application-layer. Not evaluable from this repository's source; named
  as a real gap a deployment-level review (out of this review's own
  scope) must separately audit.
- **TLS metadata.** Connection timing, SNI (server name indication,
  visible even over TLS unless ECH/encrypted-SNI is used), and
  certificate-request patterns are observable to any network
  intermediary regardless of what this codebase's own application layer
  does — not something source-level review can fix or verify.
- **Filesystem metadata.** §07's own confirmed finding directly applies
  here: `AppendOnlyFedosBoardPersistence`/a future Private Storage
  backend (§07 Option B) leaves file creation/modification TIMESTAMPS
  on disk regardless of content encryption — an operator (or anyone
  with filesystem access to the host machine) can observe WHEN activity
  happened even without reading WHAT was said, from ordinary `stat`
  metadata alone, unless the deployment separately hardens this (out of
  scope for an append-only-log-based design to solve on its own).
- **Account/payment correlation.** Not evaluated in this codebase today
  (no payment/commerce code was investigated as part of this Private
  Conversation review — `src/commerce`/`src/payment` exist but are
  out of this review's own scope). Named as a REAL risk category any
  future product decision to charge for a private-conversation feature
  must weigh explicitly: a payment record correlating a real-world
  identity (billing name, card) to an account that ALSO holds private
  conversation capabilities is a non-linkability failure regardless of
  how well the conversation layer itself is designed.
- **Invitation graph.** A genuinely NEW risk this section names,
  specific to §09/§10: even if a Capability's own `issuer` field (§09)
  is never displayed publicly, the DURABLE REDEMPTION RECORD (§10's own
  recommended single-Authority model) inherently links "who issued this
  capability" to "who redeemed it," at the Authority that processed the
  redemption — the SAME kind of durable, timestamped, plaintext-metadata
  record §07 already found the append-only architecture produces for
  everything else. An Authority holding redemption records for many
  capabilities can reconstruct a social graph of who-invited-whom
  across an entire private-conversation feature, even with zero message
  content ever exposed.
- **Timing correlation.** §07's own Delivery Observation finding
  applies directly: `subjectId`+`state`+`observedAt` tuples (even with
  no content) reveal delivery existence and CADENCE — an operator
  observing send-frequency patterns across multiple "anonymous"
  conversations could correlate activity bursts to a single real-world
  user's own online/offline schedule, independent of any content
  encryption.
- **Crash dumps.** Not evaluated by direct source inspection in this
  pass (out of this review's own scope — a crash dump's contents depend
  on runtime/OS behavior, not this codebase's own source). Named as a
  real risk: a process crash could, depending on OS/runtime behavior,
  write live memory (potentially including decrypted plaintext or key
  material momentarily resident in memory) to disk in a location
  outside this codebase's own control.
- **Telemetry.** §01's own related finding: `#observeBootstrap()`
  (`src/runtime/fedos_runtime_identity.ts`, the "Alpha 077 Contract")
  is an EXISTING, already-named seam explicitly reserved for a future
  "Metrics/Tracing/Audit/Logging/Telemetry" implementation around
  identity bootstrap — currently an empty, no-op implementation
  (confirmed: the contract's own guardrails require it stay
  synchronous, void-returning, side-effect-free). This is not a risk
  TODAY (the hook does nothing), but it is a NAMED, real seam a future
  telemetry implementation could wire identity-bootstrap timing into,
  and this review flags it as the one place in this codebase already
  anticipating observability instrumentation — any future
  Private-Conversation-adjacent telemetry should be reviewed against
  this same contract's own "Metrics/Tracing/Audit/Logging/Telemetry
  ONLY, never altering semantics" discipline, not bolted on ad hoc
  elsewhere.
- **Abuse observations.** §15's own Application/Gateway/Ontology layers
  (bot/abuse defense) inherently produce observational data ABOUT
  private-space activity (rate patterns, reported-content flags) — this
  is a direct tension with non-linkability: an abuse-defense signal
  strong enough to be useful is, by construction, also a correlatable
  signal about a specific participant's own behavior pattern. §15 names
  this tension; it is not resolved here.
- **Backups.** §17's own finding applies directly: whatever backup
  mechanism is chosen (deterministic-from-seed or wrapped-random-key)
  is itself a durable artifact that, if it ever leaks or is subpoenaed,
  correlates every conversation a given Master Seed's own identity
  participated in — backups are not exempt from the non-linkability
  analysis merely because they're "just for recovery."

## Statement this review requires any future product claim to include

**"Application DB does not store `accountId`" is necessary, not
sufficient.** A genuine non-linkability claim must separately address
every item above — most of which live at the infrastructure/deployment
layer, entirely outside what this repository's own source code can
guarantee. This review does not, and cannot, certify operator
non-linkability as an achieved property; it enumerates the boundary a
real claim would have to survive, and confirms this codebase's own
current architecture (append-only plaintext-metadata logs, §07; no
consensus/anonymization network of any kind, §01/§10) does not, by
itself, close most of the gaps named above.

## No promise of complete anonymity

Per this review's own instruction: this section makes no claim that any
future Private Conversation design achieves complete anonymity or
un-observability. It states the boundary of what IS and is NOT
observable, honestly, so a future product decision is made with full
information rather than an implied guarantee this codebase cannot back.

## See also

- `docs/reviews/private_conversation_security/07_at_rest_storage.md`
- `docs/reviews/private_conversation_security/15_bot_abuse_layers.md`
- `docs/reviews/private_conversation_security/17_backup_multi_device.md`
