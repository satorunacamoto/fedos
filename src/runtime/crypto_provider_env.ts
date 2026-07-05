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
 *
 * Stage 297 adds `parseFedosCryptoEnabledEnv` — the "Lock #2" parser for a
 * SECOND, SEPARATE env var, `FEDOS_CRYPTO_ENABLED` — WITHOUT changing
 * `parseFedosCryptoProviderEnv`'s own behavior at all ("Lock #1" stays
 * exactly as Stage 281–288 left it). See that function's own doc comment
 * below for why it is deliberately far stricter than any truthy-flag
 * parser elsewhere in this repository.
 */

/** The only provider names this repository's `FEDOS_CRYPTO_PROVIDER` env var may resolve to. */
export type FedosCryptoProviderName = "placeholder" | "fedos";

/** Every valid `FedosCryptoProviderName`, for validation/documentation helpers. */
export const FEDOS_CRYPTO_PROVIDER_NAMES: readonly FedosCryptoProviderName[] = [
  "placeholder",
  "fedos",
];

/**
 * The only two labels this repository's `FEDOS_CRYPTO_ENABLED` env var
 * ("Lock #2") may resolve to. Deliberately NOT a plain `boolean` — mirrors
 * `FedosCryptoProviderName`'s own "canonicalized label, never the raw
 * string" shape, so a diagnostics display can show `configuredEnabled`
 * the same way it shows `configuredProvider`, without ever echoing the
 * raw env string itself.
 */
export type FedosCryptoEnabledLabel = "explicit-dev-only" | "disabled";

/** Every valid `FedosCryptoEnabledLabel`, for validation/documentation helpers. */
export const FEDOS_CRYPTO_ENABLED_LABELS: readonly FedosCryptoEnabledLabel[] = [
  "explicit-dev-only",
  "disabled",
];

/**
 * The ONE string `FEDOS_CRYPTO_ENABLED` must equal (after trimming) to
 * parse as `"explicit-dev-only"` — exported so tests/docs never
 * hand-duplicate the literal.
 */
export const FEDOS_CRYPTO_ENABLED_EXPLICIT_DEV_ONLY_VALUE = "explicit-dev-only";

/**
 * A minimal, structural shape for anything that MIGHT carry
 * `FEDOS_CRYPTO_PROVIDER`/`FEDOS_CRYPTO_ENABLED` fields — a real
 * `RuntimeEnv` (`src/runtime/types.ts`) satisfies this structurally
 * without needing any change to that interface, and so does a bare test
 * fixture `{ FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" }`.
 */
export interface FedosCryptoProviderEnvLike {
  readonly FEDOS_CRYPTO_PROVIDER?: string;
  readonly FEDOS_CRYPTO_ENABLED?: string;
}

/** The fixed, safe default `parseFedosCryptoProviderEnv` falls back to. */
const DEFAULT_FEDOS_CRYPTO_PROVIDER_NAME: FedosCryptoProviderName = "placeholder";

/** The fixed, safe default `parseFedosCryptoEnabledEnv` falls back to. */
const DEFAULT_FEDOS_CRYPTO_ENABLED_LABEL: FedosCryptoEnabledLabel = "disabled";

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

/**
 * Parse a raw `FEDOS_CRYPTO_ENABLED` env string ("Lock #2") into a
 * `FedosCryptoEnabledLabel`. Recognizes EXACTLY ONE enabling value — the
 * literal (trimmed) string `"explicit-dev-only"` — and resolves
 * EVERYTHING else to `"disabled"`, INCLUDING every common truthy
 * spelling this repository's other env flags accept
 * (`"true"`/`"1"`/`"yes"`/`"on"`/`"enabled"`), common negative spellings
 * (`"false"`/`"0"`/`"no"`/`"off"`/`"disabled"`), environment-name-shaped
 * words (`"dev"`/`"development"`/`"debug"`/`"prod"`/`"production"`),
 * FedOS-adjacent words that might look plausible
 * (`"allow"`/`"allow-fedos"`/`"fedos"`/`"real"`/`"real-fedos"`/
 * `"experimental"`/`"beta"`), `undefined`/`null`/empty/whitespace-only,
 * and any other unrecognized text.
 *
 * This is DELIBERATELY far stricter than `isEnvFlagTruthy`
 * (`src/runtime/create_runtime.ts`) or `parseFedosCryptoProviderEnv`
 * above — `FEDOS_CRYPTO_ENABLED` gates whether FedOS crypto could ever
 * even be CONSIDERED for activation (Lock #2 of the dual-lock model,
 * `docs/runtime_crypto_activation_policy.md`), so accidentally
 * recognizing a common truthy spelling would defeat the entire
 * fail-closed design (`docs/runtime_crypto_threat_model.md`). Requiring
 * one unusual, unmistakable, deliberately-typed phrase makes an
 * ACCIDENTAL match effectively impossible.
 *
 * Pure; never throws.
 */
export function parseFedosCryptoEnabledEnv(
  value?: string | null,
): FedosCryptoEnabledLabel {
  if (value === undefined || value === null) {
    return DEFAULT_FEDOS_CRYPTO_ENABLED_LABEL;
  }
  const trimmed = value.trim();
  if (trimmed === FEDOS_CRYPTO_ENABLED_EXPLICIT_DEV_ONLY_VALUE) {
    return "explicit-dev-only";
  }
  return DEFAULT_FEDOS_CRYPTO_ENABLED_LABEL;
}
