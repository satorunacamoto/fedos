// Hand-written declaration file for `packaged_dependency_closure.mjs` --
// this package's `tsconfig.json`/`tsconfig.test.json` do not enable
// `allowJs`, so a plain `.mjs` module has no type information on its own;
// this file is the established, minimal way to type-check callers (this
// package's own compiled `build`/`typecheck` scripts never touch this
// file directly -- only TypeScript's module resolution reads it).

export interface UnresolvedSpecifier {
  readonly specifier: string;
  readonly fromFile: string;
}

export interface DependencyClosureResult {
  readonly names: readonly string[];
  readonly unresolved: readonly UnresolvedSpecifier[];
}

export interface WalkRuntimeDependencyGraphResult {
  readonly packages: ReadonlyMap<string, string>;
  readonly unresolved: readonly UnresolvedSpecifier[];
}

export interface ClosurePresenceResult {
  readonly ok: boolean;
  readonly missing: readonly string[];
}

export function walkRuntimeDependencyGraph(entryFiles: readonly string[], hostProvidedPackages?: readonly string[]): WalkRuntimeDependencyGraphResult;

export function listCompiledFiles(dir: string, extensions?: readonly string[]): string[];

export function deriveRuntimeDependencyClosure(dirs: { readonly repoRootDist: string; readonly packageDist: string }): DependencyClosureResult;

export interface PackageLocalFileClosureResult {
  readonly relativePaths: readonly string[];
}

export function derivePackageLocalFileClosure(args: { readonly entryFiles: readonly string[]; readonly packageDist: string }): PackageLocalFileClosureResult;

export function checkLocalFileClosurePresentInAsarListing(asarEntries: readonly string[], relativePaths: readonly string[]): ClosurePresenceResult;

export function checkClosurePresentInAsarListing(asarEntries: readonly string[], closureNames: readonly string[]): ClosurePresenceResult;

export function checkClosurePresentOnDisk(dir: string, closureNames: readonly string[]): ClosurePresenceResult;
