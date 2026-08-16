// Hand-written declaration file for `verify_release_package_allowlist.mjs`
// -- this package's `tsconfig.json`/`tsconfig.test.json` do not enable
// `allowJs`, so a plain `.mjs` module has no type information on its own;
// mirrors `lib/packaged_dependency_closure.d.mts`'s own established
// minimal-declaration pattern for this same reason.

export interface FedosBetaPackageAllowlistProblem {
  readonly kind: string;
  readonly entry?: string;
  readonly forbidden?: string;
  readonly hasFilter?: boolean;
}

export interface FedosBetaPackageAllowlistResult {
  readonly ok: boolean;
  readonly problems: readonly FedosBetaPackageAllowlistProblem[];
}

export function verifyFedosBetaPackageAllowlist(configText: string): FedosBetaPackageAllowlistResult;
