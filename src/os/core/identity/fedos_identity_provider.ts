/**
 * Secure Runtime Alpha 029 — "FedOS Identity Provider Interface".
 *
 * The MINIMAL contract a future, per-protocol Identity Provider
 * implementation would satisfy — a provider label plus exactly one
 * READ-ONLY query, `describeIdentity()`. See
 * `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
 * for the full design rationale, the responsibility separations from
 * `FedosIdentityDescriptor`/Secure Runtime/authentication/Protocol
 * Adapters, and the future Resolver relationship (Alpha 027's own
 * recommended Option C, continuing Alpha 028's Descriptor).
 *
 * This file defines an INTERFACE ONLY — no class, no function, no
 * implementation of any kind, and no wiring into any other module in
 * this repository. `describeIdentity()` is a single, idempotent READ:
 * it names "what identity descriptor does this provider currently
 * describe," never a sign-in flow, never a state change, never a
 * creation. Deliberately excluded, permanently, from this interface:
 * any method that starts, advances, or completes an authentication
 * attempt, or that creates/registers anything. Only ONE method exists
 * here, and only one ever should.
 */

import type { FedosIdentityDescriptor } from "./fedos_identity_descriptor.js";

export interface FedosIdentityProvider {
  readonly provider: string;
  describeIdentity(): Promise<FedosIdentityDescriptor | null>;
}
