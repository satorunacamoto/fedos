/**
 * Secure Runtime Alpha 333 ("Desktop Host State Model") — Stage 3 of
 * the Alpha 331–340 Desktop Host Runtime Foundation Arc.
 *
 * The explicit lifecycle state `FedosDesktopHost`
 * (`./fedos_desktop_host.ts`, Alpha 334/335) is driven by. A closed,
 * six-token union — never a free string, never an `enum`, matching
 * this repository's own existing convention for closed-vocabulary
 * state (e.g. `FedosBoardRegistrationResult`,
 * `FedosBoardPersistenceWriteResult`).
 *
 * `"failed"` deliberately carries NO error payload of its own — no
 * `{ state: "failed"; error: unknown }` shape. The state model stays
 * COARSE: a caller who needs the underlying cause reads it from the
 * `Error` `FedosDesktopHost.start()` itself rejects with (Alpha 335),
 * never from `state()`. This mirrors `FedosRuntimeIdentity`'s own
 * Fail-Closed discipline (Alpha 060): "bootstrap not yet attempted"
 * and "bootstrap failed" both read as one coarse value from the state
 * reader, with any richer detail — if any is ever needed — living on
 * the rejected `Promise` itself, never smuggled through state.
 *
 * HARD GUARDRAILS:
 *   - `FedosDesktopHostState` is the ONLY export.
 *   - Exactly six tokens: `"constructed"`, `"starting"`, `"ready"`,
 *     `"stopping"`, `"stopped"`, `"failed"` — no seventh token, no
 *     payload attached to any of them.
 *   - Required transitions: `constructed → starting`,
 *     `starting → ready`, `starting → failed`, `ready → stopping`,
 *     `stopping → stopped`. `FedosDesktopHost` (Alpha 334/335/337) is
 *     the ONLY place in this repository permitted to assign a value of
 *     this type.
 *   - Forbidden, permanently: starting `start()` a second time,
 *     `stop()` before `start()`, restarting a stopped instance,
 *     `ready → starting`, and `failed → ready` without constructing a
 *     brand-new `FedosDesktopHost` — consistent with the Alpha 062
 *     Identity Bootstrap Reset Decision ("switching means constructing
 *     a new instance", never an in-place reset API).
 *   - No error object, exception, stack trace, or `unknown` payload of
 *     any kind travels through this type — it is a plain string
 *     literal union and nothing else.
 */

export type FedosDesktopHostState =
  | "constructed"
  | "starting"
  | "ready"
  | "stopping"
  | "stopped"
  | "failed";
