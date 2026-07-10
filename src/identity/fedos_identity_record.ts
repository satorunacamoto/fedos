/**
 * Secure Runtime Alpha 040 — "FedOS Identity Record (Canonical Identity
 * Model)".
 *
 * The MINIMAL shape of the single, canonical Identity Layer model a
 * future Stage would persist and reconcile across multiple
 * `FedosIdentityProvider` (Alpha 029) implementations — as opposed to
 * `FedosIdentityDescriptor` (Alpha 028), which is the per-Provider,
 * non-persistent value a single `describeIdentity()` call returns. See
 * `docs/secure_runtime_alpha_040_fedos_identity_record.md` for the full
 * design rationale: the Descriptor/Record distinction, the
 * responsibility separations from Capability/Provider/Storage/Runtime/
 * Protocol Adapters, the future `displayName`/`avatar` policy, and why
 * every other candidate field is not added here.
 *
 * This file defines a TYPE ONLY — no class, no function, no runtime
 * behavior, no persistence logic, and no wiring into any other module
 * in this repository. `FedosIdentityRecord` is not returned by
 * `describeIdentity()` (Alpha 029), not constructed by
 * `NostrIdentityProvider` (Alpha 035/039) or `NoopFedosIdentityProvider`
 * (Alpha 033), not read or written by any Storage API, and not
 * referenced by Runtime, Worker, or Rust.
 */
export interface FedosIdentityRecord {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
