/**
 * FedOS Trust / Offline Monetization + OSS Release Closure arc.
 *
 * Shared, single-source-of-truth replacement for the ~190 historical
 * "Stage N regression" tests scattered across `test/` that each
 * independently hardcoded root `package.json`'s exact dependency COUNT
 * and/or exact SORTED KEY LIST (e.g. `expect(Object.keys(pkg.dependencies
 * ?? {}).length).toBe(2)`, `expect(Object.keys(pkg.dependencies ??
 * {}).sort()).toEqual(["@noble/curves", "@noble/hashes"])`). Adding
 * `qrcode` as this arc's one new runtime dependency (Signed QR transport,
 * `src/os/trust/qr/`) broke every one of those hardcoded snapshots
 * simultaneously — not because anything is actually wrong, but because the
 * INVARIANT those tests encoded ("exactly these two packages, forever") was
 * itself the wrong thing to freeze. A dependency count is expected to grow
 * over a project's life; what should stay invariant is "every REQUIRED
 * dependency is present" and "no UNEXPECTED dependency snuck in outside
 * this repo's own reviewed allowlist."
 *
 * This helper is that corrected invariant. Every one of those ~190 test
 * files now calls `assertFedosRootDependencyInvariant()` instead of
 * re-deriving its own frozen count/list — one canonical definition of
 * "what root `package.json` is allowed to depend on," updated in exactly
 * one place (this file) the next time a dependency is deliberately added or
 * removed, rather than requiring a ripple edit across ~190 unrelated files
 * again. `THIRD_PARTY_NOTICES.md` (regenerated via
 * `node scripts/generate_third_party_notices.mjs`, deterministically
 * derived from a real install) is this repo's own audit trail of what each
 * currently-declared dependency's license actually is — this allowlist and
 * that generated file are expected to name the same package set; if they
 * ever diverge, regenerate the notices file, don't hand-edit it.
 */

/** Every dependency root `package.json` MUST declare. Removing one here
 * without also removing it from `package.json` breaks this invariant on
 * purpose (a required dependency going missing is a real regression). */
export const FEDOS_ROOT_REQUIRED_DEPENDENCIES = ["@noble/curves", "@noble/hashes"] as const;

/** Every dependency root `package.json` is ALLOWED to declare — required
 * dependencies plus any deliberately, reviewedly added extras. `qrcode`
 * (MIT-licensed; see `LICENSE_STATUS.md` §5 / `THIRD_PARTY_NOTICES.md`) was
 * added this arc for `src/os/trust/qr/`'s QR image rendering — the ONE new
 * production dependency this repository has ever added since the original
 * `@noble/curves`/`@noble/hashes` pair. Adding a future dependency means
 * adding it here too, deliberately, in the same commit that adds it to
 * `package.json` — that's the review checkpoint this invariant enforces. */
export const FEDOS_ROOT_ALLOWED_DEPENDENCIES = ["@noble/curves", "@noble/hashes", "qrcode"] as const;

/**
 * Asserts root `package.json`'s `dependencies` field contains every
 * required dependency and nothing outside the allowlist. Throws (via a
 * plain `Error`, so it works the same whether called inside a vitest `it()`
 * or anywhere else) with a precise, actionable message on violation —
 * never a bare `toBe`/`toEqual` mismatch dump.
 */
export function assertFedosRootDependencyInvariant(dependencies: Record<string, string> | undefined | null): void {
  const keys = Object.keys(dependencies ?? {});
  const missing = FEDOS_ROOT_REQUIRED_DEPENDENCIES.filter((required) => !keys.includes(required));
  const unexpected = keys.filter(
    (key) => !(FEDOS_ROOT_ALLOWED_DEPENDENCIES as readonly string[]).includes(key),
  );
  if (missing.length > 0) {
    throw new Error(
      `fedos root dependency invariant: missing required dependenc${missing.length === 1 ? "y" : "ies"}: ${missing.join(", ")}`,
    );
  }
  if (unexpected.length > 0) {
    throw new Error(
      `fedos root dependency invariant: unexpected dependenc${unexpected.length === 1 ? "y" : "ies"} not in the reviewed allowlist (FEDOS_ROOT_ALLOWED_DEPENDENCIES in test/helpers/fedos_root_dependency_invariant.ts): ${unexpected.join(", ")}`,
    );
  }
}

/** Every devDependency root `package.json` MUST declare. */
export const FEDOS_ROOT_REQUIRED_DEV_DEPENDENCIES = ["@cloudflare/workers-types", "typescript", "vitest"] as const;

/** Every devDependency root `package.json` is ALLOWED to declare. `@types/qrcode`
 * was added this arc alongside the `qrcode` runtime dependency (`qrcode` ships
 * no bundled types; `@types/qrcode` supplies them for `src/os/trust/qr/`) — see
 * `FEDOS_ROOT_ALLOWED_DEPENDENCIES`'s own header above for the same reviewed-
 * addition discipline applied here. */
export const FEDOS_ROOT_ALLOWED_DEV_DEPENDENCIES = [
  "@cloudflare/workers-types",
  "@types/qrcode",
  "typescript",
  "vitest",
] as const;

/** Same invariant as {@link assertFedosRootDependencyInvariant}, applied to
 * root `package.json`'s `devDependencies` field. */
export function assertFedosRootDevDependencyInvariant(devDependencies: Record<string, string> | undefined | null): void {
  const keys = Object.keys(devDependencies ?? {});
  const missing = FEDOS_ROOT_REQUIRED_DEV_DEPENDENCIES.filter((required) => !keys.includes(required));
  const unexpected = keys.filter(
    (key) => !(FEDOS_ROOT_ALLOWED_DEV_DEPENDENCIES as readonly string[]).includes(key),
  );
  if (missing.length > 0) {
    throw new Error(
      `fedos root devDependency invariant: missing required devDependenc${missing.length === 1 ? "y" : "ies"}: ${missing.join(", ")}`,
    );
  }
  if (unexpected.length > 0) {
    throw new Error(
      `fedos root devDependency invariant: unexpected devDependenc${unexpected.length === 1 ? "y" : "ies"} not in the reviewed allowlist (FEDOS_ROOT_ALLOWED_DEV_DEPENDENCIES in test/helpers/fedos_root_dependency_invariant.ts): ${unexpected.join(", ")}`,
    );
  }
}
