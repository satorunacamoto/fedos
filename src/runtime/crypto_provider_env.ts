/**
 * Stage 281 — Shared crypto provider env parser.
 *
 * A single, pure parsing function shared by
 * `src/runtime/runtime_crypto_config.ts` (Stage 282) and
 * `src/runtime/worker_crypto_config.ts` (Stage 283) so `FEDOS_CRYPTO_PROVIDER`
 * is interpreted IDENTICALLY on both the Runtime and Worker sides — never
 * two subtly different parsers drifting apart.
 *
 * HARD GUARDRAILS:
 *   - Recognizes EXACTLY two values: `"placeholder"` and `"fedos"` (after
 *     trimming surrounding whitespace). Anything else — `undefined`, `null`,
 *     empty string, unrecognized text, OR any of the truthy-flag spellings
 *     this repository's OTHER env parsers accept elsewhere
 *     (`"true"`/`"1"`/`"on"`/`"enabled"`, see `isEnvFlagTruthy` in
 *     `src/runtime/create_runtime.ts`) — resolves to `"placeholder"`. This
 *     is DELIBERATE: `FEDOS_CRYPTO_PROVIDER` is a NAME selector, not a
 *     boolean opt-in flag, and must never be confused with one.
 *   - No `"fedos-dev-only"` or any other variant name is ever recognized —
 *     only the two literal strings above.
 *   - Reads NO `process.env`, NO `RuntimeEnv` — this function takes a
 *     single, already-extracted `string | null | undefined` value. Callers
 *     (Stage 282/283) are responsible for extracting
 *     `env?.FEDOS_CRYPTO_PROVIDER` themselves.
 *   - Pure: same input always produces the same output; never throws.
 */

/** The only provider names this repository's `FEDOS_CRYPTO_PROVIDER` env var may resolve to. */
export type FedosCryptoProviderName = "placeholder" | "fedos";

/** Every valid `FedosCryptoProviderName`, for validation/documentation helpers. */
export const FEDOS_CRYPTO_PROVIDER_NAMES: readonly FedosCryptoProviderName[] = [
  "placeholder",
  "fedos",
];

/**
 * A minimal, structural shape for anything that MIGHT carry a
 * `FEDOS_CRYPTO_PROVIDER` field — a real `RuntimeEnv`
 * (`src/runtime/types.ts`) satisfies this structurally without needing any
 * change to that interface, and so does a bare test fixture
 * `{ FEDOS_CRYPTO_PROVIDER: "fedos" }`.
 */
export interface FedosCryptoProviderEnvLike {
  readonly FEDOS_CRYPTO_PROVIDER?: string;
}

/** The fixed, safe default `parseFedosCryptoProviderEnv` falls back to. */
const DEFAULT_FEDOS_CRYPTO_PROVIDER_NAME: FedosCryptoProviderName = "placeholder";

/**
 * Parse a raw `FEDOS_CRYPTO_PROVIDER` env string into a
 * `FedosCryptoProviderName`. `undefined`/`null`/empty/whitespace-only, OR
 * any value other than the literal (trimmed) `"placeholder"`/`"fedos"`
 * strings, resolves to `"placeholder"` — this INCLUDES truthy-flag
 * spellings (`"true"`/`"1"`/`"on"`/`"enabled"`) and any dev-only variant
 * name (`"fedos-dev-only"`, etc.), which are never treated as `"fedos"`.
 * Pure; never throws.
 */
export function parseFedosCryptoProviderEnv(
  value?: string | null,
): FedosCryptoProviderName {
  if (value === undefined || value === null) {
    return DEFAULT_FEDOS_CRYPTO_PROVIDER_NAME;
  }
  const trimmed = value.trim();
  if (trimmed === "placeholder") return "placeholder";
  if (trimmed === "fedos") return "fedos";
  return DEFAULT_FEDOS_CRYPTO_PROVIDER_NAME;
}
