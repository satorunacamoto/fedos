/**
 * Secure Runtime Alpha 096 ("Desktop Shell Skeleton") — the FIRST file
 * anywhere in `src/desktop/`, and the first REAL implementation Stage
 * of the Desktop Shell Foundation Arc (Alpha 096–100), following the
 * fully-completed, implementation-free Desktop Design (Alpha 086–095).
 * `DesktopApplication` is a thin, internal-only holder of exactly ONE
 * `FedosRuntimeIdentity` instance, constructed directly in its own
 * constructor — per the Alpha 091 Entry Point Decision, NOT via
 * `createRuntime()` and NOT via any Worker code path. The constructor
 * performs ONLY that synchronous construction; it does NOT call
 * `bootstrapIdentity()` itself (per Alpha 091's own rejection of an
 * `async`-performing constructor). `bootstrap()` is a pure delegation
 * to `this.#identity.bootstrapIdentity()`.
 *
 * Secure Runtime Alpha 097 ("Bootstrap Wiring") wired `start()`'s own
 * entire body to `return this.bootstrap();` — a pure delegation to
 * `bootstrap()`, exactly matching the Alpha 092 Bootstrap Sequence
 * Decision's own `construct → bootstrapIdentity() → ready` order —
 * `bootstrap()` itself, per Alpha 061's own pre-existing idempotency
 * guarantee (inherited unchanged from `FedosRuntimeIdentity`), is
 * called at most once per instance in substance, even if `start()`
 * were ever invoked more than once.
 *
 * Secure Runtime Alpha 098 ("Ready State") adds a private
 * `#started: boolean` field (initial `false`) and rewrites `start()`'s
 * own body to a guard, `if (this.#started) { throw new Error(...); }`,
 * followed by the SAME `await this.bootstrap();` call Alpha 097
 * already wired, followed by `this.#started = true;` — the ONLY
 * change this Stage makes. Unlike `FedosRuntimeIdentity`'s own
 * `bootstrapIdentity()`, which silently no-ops on a repeat call
 * (Alpha 061), a second `start()` call on the SAME
 * `DesktopApplication` instance THROWS — a DIFFERENT, Desktop-level
 * concern from Identity's own Bootstrap idempotency: `#started` guards
 * against Desktop's own startup sequence itself running twice (which
 * might, in a future Stage, also re-trigger window/process-level
 * setup this class does not yet perform), not against a redundant
 * Provider read, which `bootstrapIdentity()`'s own guard already
 * prevents independently. `bootstrap()` itself remains ungated by
 * `#started` and may still be called directly, any number of times,
 * relying entirely on `FedosRuntimeIdentity`'s own idempotency.
 *
 * Secure Runtime Alpha 102 ("Desktop Identity Reader", review/design
 * only, NO code change) formally decided that `DesktopApplication` —
 * NOT `FedosRuntimeIdentity` — owns a future `FedosPublicIdentityReader`
 * (`fedos_public_identity_reader.ts`, Alpha 101) instance.
 * `FedosRuntimeIdentity` itself is permanently EXCLUDED from ever
 * holding a Reader of its own.
 *
 * Secure Runtime Alpha 103 ("Source Injection") implements that
 * Decision: a new `readonly #reader: FedosPublicIdentityReader` field,
 * set via a new constructor parameter,
 * `reader: FedosPublicIdentityReader = new NostrPublicIdentityReader(resolveNostrPublicIdentitySource())`.
 * The default value mirrors `NostrIdentityProvider`'s own Alpha 049
 * default-parameter pattern exactly — every EXISTING no-argument
 * `new DesktopApplication()` call site (including every prior Stage's
 * own test suite) continues to work unchanged, since the default
 * resolves through the SAME `resolveNostrPublicIdentitySource()`
 * singleton (Alpha 048) that today always yields
 * `NullNostrPublicIdentitySource` — behaviorally IDENTICAL to before
 * this Stage. `createDesktopApplication()` is updated to construct the
 * Source and Reader explicitly and pass them through, matching this
 * Stage's own Source Injection diagram precisely, though it remains
 * functionally equivalent to relying on the default. `#reader` is
 * held but not yet read by any method on this class — no new public
 * API is added.
 *
 * Secure Runtime Alpha 107 ("Desktop Public Identity Configuration")
 * adds a new, SECOND, optional constructor parameter,
 * `publicIdentity: FedosNostrPublicIdentitySnapshot | undefined =
 * undefined`, and a new `readonly #publicIdentity` field storing it —
 * the ONLY change this Stage makes. The pre-existing `reader`
 * parameter (Alpha 103) stays FIRST, with its own default value
 * completely unchanged — this Stage is purely additive, so EVERY
 * existing call site (`new DesktopApplication()`,
 * `new DesktopApplication(customReader)`) continues to work
 * unchanged. `#publicIdentity` is held but read by nothing yet — Alpha
 * 109's own deliverable is wiring `createDesktopApplication()` to use
 * a configuration value of this SAME shape to construct the `reader`
 * it passes in; this class's own constructor never derives `reader`
 * from `publicIdentity` itself, since a later parameter cannot appear
 * in an earlier parameter's own default-value expression.
 *
 * Secure Runtime Alpha 116 ("Desktop Identity Access") adds a new
 * public method, `currentIdentity(): FedosIdentityDescriptor | null`,
 * whose own entire body is `return this.#identity.currentIdentity();`
 * — a PURE delegation to the sole Identity Authority
 * (`FedosRuntimeIdentity`, Alpha 111) — the ONLY change this Stage
 * makes. No processing, no transformation, no caching of any kind:
 * this method reads `#identity`'s own current value fresh on every
 * call and returns exactly what it returns, unmodified.
 *
 * Secure Runtime Alpha 117 ("Desktop Bootstrap State") adds a new
 * public method, `isBootstrapped(): boolean`, whose own entire body
 * is `return this.#identity.isBootstrapped();` — a PURE delegation to
 * the sole Identity Authority's own existing method (Alpha 072) — the
 * ONLY change this Stage makes. No Desktop-independent state of any
 * kind: this class holds no `#bootstrapped` field of its own, and
 * never derives this value from `#started` or from `currentIdentity()`
 * — it is read fresh from `#identity` on every call.
 *
 * Secure Runtime Alpha 121 ("Desktop Reader Access") adds a new public
 * method, `readPublicIdentity(): Promise<FedosIdentityDescriptor | null>`,
 * whose own entire body is `return this.#reader.readPublicIdentity();`
 * — a PURE delegation to the held Reader (Alpha 103) — the ONLY change
 * this Stage makes. `#reader` had been held, unread, since Alpha 103;
 * this is the FIRST method on this class to read it. No processing, no
 * transformation, no caching, and NO reference to `#identity` of any
 * kind — this method NEVER touches Identity Runtime, exactly
 * symmetrically to how `currentIdentity()`/`isBootstrapped()` never
 * touch `#reader`.
 *
 * Secure Runtime Alpha 126 ("Desktop Public Identity State") adds a
 * new private field, `#currentPublicIdentity: FedosIdentityDescriptor | null`,
 * initialized to `null` — the ONLY change this Stage makes. Unlike
 * `#reader`/`#publicIdentity` (references/configuration held since
 * construction), this is Desktop's own FIRST piece of genuinely
 * computed, mutable state outside `#started`. No method reads or
 * writes it yet — `readPublicIdentity()` (Alpha 121) remains
 * byte-for-byte unchanged by this Stage; wiring is Alpha 127's own
 * deliverable.
 *
 * Secure Runtime Alpha 127 ("Reader Result Persistence") rewrites
 * `readPublicIdentity()`'s own body: `async`, `await`s the Reader's
 * own result into a local `const result`, assigns
 * `this.#currentPublicIdentity = result;`, then `return result;` — the
 * ONLY change this Stage makes. The assignment happens ONLY on
 * success, in the plain JavaScript `Promise` sense: if
 * `this.#reader.readPublicIdentity()` were ever to reject, the `await`
 * throws before the assignment line is ever reached, and
 * `#currentPublicIdentity` is left unchanged — no `try`/`catch` of any
 * kind is added, so this Stage adds NO new error-handling behavior.
 * "Success" per Alpha 101's own interface includes a resolved `null`
 * (no identity found) — a resolved `null` IS persisted, exactly as
 * received. `result` is stored and returned BY REFERENCE — no clone,
 * no spread, no property copy of any kind.
 *
 * Secure Runtime Alpha 128 ("Desktop Public Identity Reader") adds a
 * new public method, `currentPublicIdentity(): FedosIdentityDescriptor | null`,
 * whose own entire body is `return this.#currentPublicIdentity;` — the
 * ONLY change this Stage makes. SYNCHRONOUS — no `async`, no
 * `Promise`, unlike `readPublicIdentity()`. NEVER throws — a plain
 * field read can only ever return `#currentPublicIdentity`'s own
 * current value (`null` until Alpha 127's own `readPublicIdentity()`
 * has resolved at least once), never raise. This is the public
 * counterpart to `currentIdentity()` (Alpha 116) for the Reader path,
 * symmetrically named and symmetrically synchronous.
 *
 * Secure Runtime Alpha 131 ("Desktop Refresh API") adds a new public
 * method, `refreshPublicIdentity(): Promise<FedosIdentityDescriptor | null>`,
 * whose own entire body is `return this.readPublicIdentity();` — a
 * PURE delegation to this class's OWN `readPublicIdentity()` (Alpha
 * 121/127), not to `#reader` directly — the ONLY change this Stage
 * makes. "Refresh" names an explicit, intentional re-fetch for
 * callers who want to state their intent clearly; it adds NO new
 * behavior of its own — `readPublicIdentity()` already re-invokes the
 * Reader fresh on every call (Alpha 121's own no-caching guarantee)
 * and already persists into `#currentPublicIdentity` on success
 * (Alpha 127) — `refreshPublicIdentity()` inherits both, automatically,
 * by calling through the SAME method, not by duplicating its body.
 *
 * HARD GUARDRAILS:
 *   - `DesktopApplication` is the ONLY export.
 *   - The constructor performs NO async work of any kind — it only
 *     constructs the one `FedosRuntimeIdentity` instance this class
 *     holds and stores the injected (or defaulted) Reader and the
 *     injected (or defaulted) public identity configuration.
 *   - `bootstrap()` performs NO Registry/Provider/Resolver access of
 *     its own — it delegates entirely to
 *     `this.#identity.bootstrapIdentity()`.
 *   - `#started`/`start()` (Alpha 098): `#started` starts `false` and
 *     flips to `true` ONLY after `start()`'s own `await
 *     this.bootstrap();` resolves without throwing. A SECOND `start()`
 *     call on an instance where `#started` is already `true` THROWS —
 *     it does NOT silently no-op.
 *   - `#reader` (Alpha 103) is PERMANENTLY owned by `DesktopApplication`
 *     alone — `FedosRuntimeIdentity` must NEVER hold one, in any
 *     future implementation, for any purpose. `readPublicIdentity()`
 *     (Alpha 121) is the ONLY method on this class that reads `#reader`.
 *   - `#publicIdentity` (Alpha 107) defaults to `undefined` — no
 *     public identity is configured unless explicitly supplied. No
 *     method on this class reads `#publicIdentity` yet, and this
 *     class's own constructor never uses it to compute `reader`'s own
 *     default value.
 *   - `currentIdentity()` (Alpha 116) is a PURE WRAPPER — its own
 *     entire body is `return this.#identity.currentIdentity();`,
 *     nothing more. It performs NO caching, NO transformation, and NO
 *     access to `#reader`, `#publicIdentity`, or any Provider/Source
 *     of any kind — Identity Authority (Alpha 111) is consulted
 *     exclusively through `#identity`.
 *   - `isBootstrapped()` (Alpha 117) is a PURE WRAPPER — its own entire
 *     body is `return this.#identity.isBootstrapped();`, nothing more.
 *     `DesktopApplication` holds NO `#bootstrapped` field of its own,
 *     and this method NEVER derives its answer from `#started` or from
 *     `currentIdentity()` — Identity Authority (Alpha 111) is consulted
 *     exclusively through `#identity`.
 *   - `readPublicIdentity()` (Alpha 121/127) delegates to
 *     `this.#reader.readPublicIdentity()` and, on successful
 *     resolution ONLY, persists the exact resolved value (by
 *     reference, no clone) into `#currentPublicIdentity` before
 *     returning it. It performs NO transformation of the resolved
 *     value, and NO access to `#identity`, `#publicIdentity`, or
 *     `#started` of any kind — it NEVER touches Identity Runtime.
 *     This is the sole read-AND-write boundary for `#reader`/
 *     `#currentPublicIdentity`, symmetrically opposite
 *     `currentIdentity()`/`isBootstrapped()`, which are the sole read
 *     boundary for `#identity` — the two paths never cross.
 *   - `#currentPublicIdentity` (Alpha 126/127) starts `null` and is
 *     written ONLY by `readPublicIdentity()`, ONLY on successful
 *     resolution. `currentPublicIdentity()` (Alpha 128) is the ONLY
 *     method that reads it besides `readPublicIdentity()` itself.
 *   - `currentPublicIdentity()` (Alpha 128) is a PURE, SYNCHRONOUS
 *     WRAPPER — its own entire body is
 *     `return this.#currentPublicIdentity;`, nothing more. It NEVER
 *     throws, NEVER awaits, and performs NO access to `#identity`,
 *     `#reader`, `#publicIdentity`, or `#started` of any kind.
 *   - `refreshPublicIdentity()` (Alpha 131) is a PURE WRAPPER — its own
 *     entire body is `return this.readPublicIdentity();`, nothing
 *     more. It calls NO method other than `readPublicIdentity()` —
 *     NOT `this.#reader.readPublicIdentity()` directly, NOT
 *     `this.bootstrap()`/`this.start()`, NOT any `#identity` method of
 *     any kind. It performs NO processing of its own and touches NO
 *     Identity Runtime, Registry, Provider, Storage, or Worker
 *     concept, directly or transitively — its ONLY effect is whatever
 *     `readPublicIdentity()` itself already does.
 *   - NO GUI, NO Nostr/Relay connection, NO Observation implementation
 *     of any kind exists anywhere in this file.
 *   - NO reference to `create_runtime.ts`, `types.ts`, `worker.ts`, or
 *     any `AppRuntime` field.
 */

import { FedosRuntimeIdentity } from "../runtime/fedos_runtime_identity.js";
import { resolveNostrPublicIdentitySource } from "../identity/fedos_nostr_public_identity_source_resolver.js";
import type { FedosNostrPublicIdentitySnapshot } from "../identity/fedos_nostr_public_identity_source.js";
import type { FedosIdentityDescriptor } from "../identity/fedos_identity_descriptor.js";
import type { FedosPublicIdentityReader } from "./fedos_public_identity_reader.js";
import { NostrPublicIdentityReader } from "./nostr_public_identity_reader.js";

export class DesktopApplication {
  readonly #identity: FedosRuntimeIdentity;
  readonly #reader: FedosPublicIdentityReader;
  readonly #publicIdentity: FedosNostrPublicIdentitySnapshot | undefined;
  #started: boolean = false;
  #currentPublicIdentity: FedosIdentityDescriptor | null = null;

  constructor(
    reader: FedosPublicIdentityReader = new NostrPublicIdentityReader(resolveNostrPublicIdentitySource()),
    publicIdentity: FedosNostrPublicIdentitySnapshot | undefined = undefined,
  ) {
    this.#identity = new FedosRuntimeIdentity();
    this.#reader = reader;
    this.#publicIdentity = publicIdentity;
  }

  async bootstrap(): Promise<void> {
    return this.#identity.bootstrapIdentity();
  }

  async start(): Promise<void> {
    if (this.#started) {
      throw new Error("DesktopApplication.start() was already called.");
    }
    await this.bootstrap();
    this.#started = true;
  }

  currentIdentity(): FedosIdentityDescriptor | null {
    return this.#identity.currentIdentity();
  }

  isBootstrapped(): boolean {
    return this.#identity.isBootstrapped();
  }

  async readPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
    const result = await this.#reader.readPublicIdentity();
    this.#currentPublicIdentity = result;
    return result;
  }

  currentPublicIdentity(): FedosIdentityDescriptor | null {
    return this.#currentPublicIdentity;
  }

  refreshPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
    return this.readPublicIdentity();
  }
}
