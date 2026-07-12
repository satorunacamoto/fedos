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
 * HARD GUARDRAILS:
 *   - `DesktopApplication` is the ONLY export.
 *   - The constructor takes NO arguments and performs NO async work of
 *     any kind — it only constructs the one `FedosRuntimeIdentity`
 *     instance this class holds.
 *   - `bootstrap()` performs NO Registry/Provider/Resolver access of
 *     its own — it delegates entirely to
 *     `this.#identity.bootstrapIdentity()`.
 *   - `#started`/`start()` (Alpha 098): `#started` starts `false` and
 *     flips to `true` ONLY after `start()`'s own `await
 *     this.bootstrap();` resolves without throwing. A SECOND `start()`
 *     call on an instance where `#started` is already `true` THROWS —
 *     it does NOT silently no-op.
 *   - NO GUI, NO Nostr/Relay connection, NO Observation implementation
 *     of any kind exists anywhere in this file.
 *   - NO reference to `create_runtime.ts`, `types.ts`, `worker.ts`, or
 *     any `AppRuntime` field.
 */

import { FedosRuntimeIdentity } from "../runtime/fedos_runtime_identity.js";

export class DesktopApplication {
  readonly #identity: FedosRuntimeIdentity;
  #started: boolean = false;

  constructor() {
    this.#identity = new FedosRuntimeIdentity();
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
}
