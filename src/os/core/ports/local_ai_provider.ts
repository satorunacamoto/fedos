/**
 * OS Capability Modularization — `LocalAIProvider`.
 *
 * A generic contract for a local-model completion capability. INTERFACE
 * ONLY — no implementation ships here. No local-model integration (e.g. an
 * LM Studio client) exists anywhere in this repo today; this file names the
 * seam a future implementation would fill, it does not invent one.
 *
 * This file must never import from `src/conversation`, `src/os/messenger`,
 * `src/commerce`/`src/os/commerce`, or any other domain-specific module.
 */

/**
 * Free-form, adapter-defined context passed alongside a prompt (e.g. prior
 * turns, system instructions). Left opaque to this port on purpose.
 */
export type LocalAIContext = Readonly<Record<string, unknown>>;

/**
 * The local-AI seam. An adapter implementing this port owns the actual
 * model runtime/process; `os/core` and `os/commerce` depend only on this
 * shape.
 */
export interface LocalAIProvider {
  /** True only when a local model is actually reachable right now. */
  isAvailable(): Promise<boolean>;
  /** Request a completion for `prompt`. Never throws; rejects are for the adapter to define. */
  complete(prompt: string, context?: LocalAIContext): Promise<string>;
}
