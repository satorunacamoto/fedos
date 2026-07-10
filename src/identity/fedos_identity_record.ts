/**
 * Secure Runtime Alpha 040 — "FedOS Identity Record (Canonical Identity
 * Model)". Secure Runtime Alpha 047 — "FedOS Identity Record Expansion"
 * (this revision — two optional fields).
 *
 * The MINIMAL shape of the single, canonical Identity Layer model a
 * future Stage would persist and reconcile across multiple
 * `FedosIdentityProvider` (Alpha 029) implementations — as opposed to
 * `FedosIdentityDescriptor` (Alpha 028), which is the per-Provider,
 * non-persistent value a single `describeIdentity()` call returns. As of
 * Alpha 047, the Record also carries two OPTIONAL, public, display-only
 * fields — `displayName`/`avatar` — matching `FedosIdentityDescriptor`'s
 * own identical two-field expansion (Alpha 045) and continuing Alpha
 * 038's own formal ADOPT decision. See
 * `docs/secure_runtime_alpha_040_fedos_identity_record.md` for the
 * original three-field design rationale: the Descriptor/Record
 * distinction, the responsibility separations from
 * Capability/Provider/Storage/Runtime/Protocol Adapters, and why every
 * other candidate field is not added here, and
 * `docs/secure_runtime_alpha_047_fedos_identity_record_expansion.md` for
 * this Stage's own rationale: why `displayName`/`avatar` are copied onto
 * the Record, why both remain optional, and why neither may ever carry
 * sign-in-shaped or confidential content of any kind.
 *
 * This file defines a TYPE ONLY — no class, no function, no runtime
 * behavior, no persistence logic, and no wiring into any other module
 * in this repository. `FedosIdentityRecord` is not returned by
 * `describeIdentity()` (Alpha 029), not constructed by
 * `NostrIdentityProvider` (Alpha 035/039) or `NoopFedosIdentityProvider`
 * (Alpha 033), not read or written by any Storage API, and not
 * referenced by Runtime, Worker, or Rust. `displayName`/`avatar` are
 * both OPTIONAL (`?:`) — no producer of a Record in this repository is
 * modified by this Stage to guarantee either field, so a Record built
 * from a Descriptor that itself omits both continues to omit both.
 */
export interface FedosIdentityRecord {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
  readonly displayName?: string;
  readonly avatar?: string;
}
