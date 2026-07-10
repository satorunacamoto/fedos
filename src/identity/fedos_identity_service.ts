/**
 * Secure Runtime Alpha 031 — "FedOS Identity Service Skeleton".
 *
 * The MINIMAL Service that wraps exactly ONE `FedosIdentityProvider`
 * (Alpha 029) behind two pass-through methods. See
 * `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
 * for the full design rationale, the responsibility separations from
 * `FedosIdentityDescriptor`/`FedosIdentityProvider`/`FedosIdentityCapability`/
 * Secure Runtime, and why this Service deliberately has no Resolver.
 *
 * This file defines a SINGLE CLASS, `FedosIdentityService`, and nothing
 * else — no Resolver, no Provider implementation, no wiring into any
 * other module in this repository. It holds exactly one thing — the
 * `FedosIdentityProvider` its own constructor was given — and performs
 * PURE DELEGATION, never caching, never deriving new information, never
 * tracking a lifecycle:
 *
 *   - `describeIdentity()` calls `provider.describeIdentity()` directly
 *     and returns its result unchanged.
 *   - `describeCapability()` reads ONLY the `provider` label already
 *     present on the `FedosIdentityProvider` it holds (a field, not a
 *     method call — `FedosIdentityProvider` has no `describeCapability()`
 *     method, per Alpha 029/030's own explicit "reviewed, not added"
 *     decision) and reports `available: true`. A constructed
 *     `FedosIdentityService` always has a real `FedosIdentityProvider`
 *     object to delegate to — that a Provider EXISTS and was
 *     successfully handed to this Service is the ONLY signal available
 *     without exceeding this Stage's own "delegate only, no internal
 *     logic" mandate, and is exactly what `available: true` reports:
 *     nothing computed, nothing cached, nothing inferred beyond reading
 *     one already-present field.
 */

import type { FedosIdentityDescriptor } from "./fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "./fedos_identity_provider.js";
import type { FedosIdentityCapability } from "./fedos_identity_capability.js";

export class FedosIdentityService {
  readonly #provider: FedosIdentityProvider;

  constructor(provider: FedosIdentityProvider) {
    this.#provider = provider;
  }

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return this.#provider.describeIdentity();
  }

  async describeCapability(): Promise<FedosIdentityCapability> {
    return { provider: this.#provider.provider, available: true };
  }
}
