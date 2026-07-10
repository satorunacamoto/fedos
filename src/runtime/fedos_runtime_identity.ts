/**
 * Secure Runtime Alpha 050–052 — "Identity Runtime Integration Arc"
 * (Alpha 050: Runtime Identity Authority).
 *
 * The FIRST connection anywhere in this repository between the
 * Identity Layer (`src/identity/*`, Alpha 027–049) and the Runtime
 * (`src/runtime/*`). `FedosRuntimeIdentity` is a thin, internal-only
 * assembly of the three Identity Layer objects a single Runtime
 * instance would need to hold together — `FedosIdentityRegistry`
 * (Alpha 041, the store), `FedosIdentityService` (Alpha 031/042/047,
 * the writer, backed by the shared `FedosIdentityProvider` singleton
 * `resolveFedosIdentityProvider()` (Alpha 032/034/036/039/049)
 * resolves), and `FedosIdentityResolver` (Alpha 043, the reader) — all
 * three wired to the SAME `FedosIdentityRegistry` instance, exactly as
 * `FedosIdentityResolver`'s own design has always required. See
 * `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
 * for the full design rationale: why this class exists, why it wires
 * Service/Registry/Resolver together rather than leaving Runtime to
 * construct each separately, why it is not yet exposed on `AppRuntime`,
 * why identity retrieval is always `null` today, and the Development/
 * Production/Unknown Runtime Mode verification this Arc performs.
 *
 * This file defines a SINGLE CLASS and nothing else — no function, no
 * module-scoped singleton, no environment read, no Worker reference,
 * no Storage reference, no Rust reference, and no wiring into
 * `AppRuntime`/`RuntimeEnv`/`RuntimeOverrides` (`types.js`) or the
 * Public Runtime API. `create_runtime.ts` (Alpha 051) is the ONLY file
 * in this repository that constructs a `FedosRuntimeIdentity` — held as
 * a private, module-scoped field there, never returned from
 * `createRuntime()`, never attached to the `AppRuntime` object literal
 * that function assembles, and never read by any other file.
 *
 * HARD GUARDRAILS:
 *   - `FedosRuntimeIdentity` is the ONLY export.
 *   - The constructor takes NO arguments, reads NO `RuntimeEnv`, and
 *     performs NO environment classification of any kind — Runtime
 *     Mode (`Development`/`Production`/`Unknown`) does not change what
 *     gets constructed; the SAME three Identity Layer objects are
 *     assembled identically regardless of mode.
 *   - The injected `FedosIdentityProvider` is ALWAYS
 *     `resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider()`
 *     — the nullable Resolver return type is handled with the SAME
 *     safe, permanently-`null`-resolving fallback Alpha 033 built for
 *     exactly this purpose; `resolveFedosIdentityProvider()` itself is
 *     never modified and, as of this Arc, never actually returns
 *     `null` (Alpha 036/039/049).
 *   - `describeIdentity()`/`findIdentity()`/`listIdentities()` are PURE
 *     PASS-THROUGHS to the internally-held Service/Resolver — no new
 *     validation, caching, aggregation, or transformation of any kind.
 *   - NO Relay, event, signing, secret-key, Authentication, Credential,
 *     or Session reference of any kind.
 *   - NO reference to `src/worker.ts`, any `src/storage/*` file, any
 *     `packages/fedos-core-rust` file, `Cargo.toml`, or `package.json`.
 */

import { FedosIdentityService } from "../identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../identity/fedos_identity_resolver.js";
import { resolveFedosIdentityProvider } from "../identity/fedos_identity_provider_resolver.js";
import { NoopFedosIdentityProvider } from "../identity/fedos_noop_identity_provider.js";
import type { FedosIdentityDescriptor } from "../identity/fedos_identity_descriptor.js";
import type { FedosIdentityRecord } from "../identity/fedos_identity_record.js";

export class FedosRuntimeIdentity {
  readonly #registry: FedosIdentityRegistry;
  readonly #service: FedosIdentityService;
  readonly #resolver: FedosIdentityResolver;

  constructor() {
    this.#registry = new FedosIdentityRegistry();
    const provider = resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider();
    this.#service = new FedosIdentityService(provider, this.#registry);
    this.#resolver = new FedosIdentityResolver(this.#registry);
  }

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return this.#service.describeIdentity();
  }

  findIdentity(id: string): FedosIdentityRecord | null {
    return this.#resolver.findIdentity(id);
  }

  listIdentities(): readonly FedosIdentityRecord[] {
    return this.#resolver.listIdentities();
  }
}
