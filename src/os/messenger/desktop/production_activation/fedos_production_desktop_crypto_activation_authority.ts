/**
 * Secure Runtime Alpha 4741-4820 — Phase B: Production Desktop Runtime
 * Crypto Activation Authority.
 *
 * The ONE explicit production Desktop crypto activation authority. It
 * answers, with a CLOSED result vocabulary (never a single boolean):
 *   - is this an approved Desktop host?            (host attestation)
 *   - is the packaged artifact present?            (artifact-missing)
 *   - is the artifact integrity acceptable?        (artifact-invalid)
 *   - is the artifact version acceptable?          (artifact-version-mismatch)
 *   - is this the approved build identity?         (unapproved-build)
 *   - is the requested capability reviewed?        (capability-not-allowed)
 *   - may initialization proceed?                  (initialization-failed)
 *   - permitted.
 *
 * It does NOT weaken the existing dev-only WASM gate: it is a SEPARATE,
 * narrow path, reachable only with a valid Electron-main host
 * attestation (Phase C) and a verified pinned artifact manifest
 * (Phase D). It never reads `NODE_ENV`, never opens the dev gate, and
 * never fetches anything remotely. On success it returns a
 * capability-limited facade (Phase F); on any failure it returns an
 * explicit closed decision — never a silent fallback to a dev or fake
 * authority.
 */

import {
  isFedosProductionDesktopHostAttestation,
  type FedosProductionDesktopHostAttestation,
} from "./fedos_production_desktop_host_attestation.js";
import {
  parseFedosProductionWasmArtifactManifest,
  verifyFedosProductionWasmArtifactManifest,
  type FedosProductionWasmArtifactManifestV1,
} from "./fedos_production_wasm_artifact_manifest.js";
import {
  createFedosProductionMasterSeedFacade,
  type FedosProductionMasterSeedFacade,
} from "./fedos_production_wasm_master_seed_facade.js";

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

declare const process: { cwd(): string };

export type FedosProductionActivationDecision =
  | "permitted"
  | "unsupported-host"
  | "artifact-missing"
  | "artifact-invalid"
  | "artifact-version-mismatch"
  | "unapproved-build"
  | "capability-not-allowed"
  | "initialization-failed";

export type FedosProductionActivationResult =
  | { readonly decision: "permitted"; readonly facade: FedosProductionMasterSeedFacade; readonly appId: string }
  | { readonly decision: Exclude<FedosProductionActivationDecision, "permitted">; readonly reason: string };

/** Default `pkg/` artifact locations, resolved from `process.cwd()`. */
export const FEDOS_PRODUCTION_ARTIFACT_DIR = "packages/fedos-core-rust/pkg";
export const FEDOS_PRODUCTION_WASM_FILENAME = "fedos_core_rust_bg.wasm";
export const FEDOS_PRODUCTION_JS_GLUE_FILENAME = "fedos_core_rust.js";
export const FEDOS_PRODUCTION_MANIFEST_FILENAME = "fedos_wasm_artifact_manifest.v1.json";

export interface FedosProductionActivationRequest {
  /** The unforgeable Electron-main host attestation (Phase C). */
  readonly attestation: FedosProductionDesktopHostAttestation | unknown;
  /** Absolute directory holding the generated `pkg/` artifacts. Defaults to `process.cwd()`-relative. */
  readonly artifactDir?: string;
  /**
   * Optional expected build identity. When present, the manifest's crate
   * name/version must match, else `unapproved-build`.
   */
  readonly expectedCrate?: { readonly name?: string; readonly version?: string };
  // ---- Test seams (production callers never supply these) ----
  readonly readBytes?: (path: string) => Uint8Array;
  readonly readText?: (path: string) => string;
  readonly fileExists?: (path: string) => boolean;
  readonly importGlue?: (specifier: string) => Promise<unknown>;
}

function blocked(
  decision: Exclude<FedosProductionActivationDecision, "permitted">,
  reason: string,
): FedosProductionActivationResult {
  return { decision, reason };
}

/**
 * Authorize and, if permitted, activate the production Desktop Master
 * Seed crypto path. Never throws; every failure is a closed decision.
 */
export async function authorizeAndActivateFedosProductionDesktopMasterSeed(
  request: FedosProductionActivationRequest,
): Promise<FedosProductionActivationResult> {
  // 1. Approved Desktop host? — an unforgeable attestation instance only.
  if (!isFedosProductionDesktopHostAttestation(request.attestation)) {
    return blocked("unsupported-host", "activation requires a valid Electron main host attestation");
  }
  const attestation = request.attestation;

  const dir = request.artifactDir ?? join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
  const wasmPath = join(dir, FEDOS_PRODUCTION_WASM_FILENAME);
  const gluePath = join(dir, FEDOS_PRODUCTION_JS_GLUE_FILENAME);
  const manifestPath = join(dir, FEDOS_PRODUCTION_MANIFEST_FILENAME);

  const exists = request.fileExists ?? ((p: string) => existsSync(p));
  const readBytesFn = request.readBytes ?? ((p: string) => readFileSync(p) as Uint8Array);
  const readTextFn = request.readText ?? ((p: string) => readFileSync(p, "utf8") as string);

  // 2. Packaged artifact present? — all three files.
  if (!exists(wasmPath) || !exists(gluePath) || !exists(manifestPath)) {
    return blocked("artifact-missing", "one or more pinned artifact files are absent");
  }

  // 3. Read artifact bytes + manifest text (fail closed on any read error).
  let wasmBytes: Uint8Array;
  let manifestText: string;
  try {
    wasmBytes = readBytesFn(wasmPath);
    manifestText = readTextFn(manifestPath);
  } catch {
    return blocked("artifact-missing", "pinned artifact files could not be read");
  }

  let manifest: FedosProductionWasmArtifactManifestV1 | null;
  try {
    manifest = parseFedosProductionWasmArtifactManifest(JSON.parse(manifestText));
  } catch {
    manifest = null;
  }
  if (manifest === null) {
    return blocked("artifact-invalid", "pinned artifact manifest is malformed");
  }

  // 4. Approved build identity? (only when an expectation is supplied.)
  if (request.expectedCrate) {
    if (request.expectedCrate.name !== undefined && request.expectedCrate.name !== manifest.crateName) {
      return blocked("unapproved-build", "artifact crate name does not match the approved build");
    }
    if (request.expectedCrate.version !== undefined && request.expectedCrate.version !== manifest.crateVersion) {
      return blocked("unapproved-build", "artifact crate version does not match the approved build");
    }
  }

  // 5. Import the JS glue (capability-contained: only inside this authority).
  const importGlue =
    request.importGlue ?? ((specifier: string) => import(/* @vite-ignore */ specifier));
  let glueModule: object;
  try {
    const imported = await importGlue(gluePath);
    if (typeof imported !== "object" || imported === null) {
      return blocked("artifact-invalid", "JS glue import did not yield a module object");
    }
    glueModule = imported;
  } catch {
    return blocked("artifact-invalid", "JS glue could not be imported");
  }
  const presentExports = Object.keys(glueModule);

  // 6. Verify the pinned manifest against the REAL bytes + present exports.
  const verdict = verifyFedosProductionWasmArtifactManifest(manifest, wasmBytes, presentExports);
  switch (verdict) {
    case "ok":
      break;
    case "version-incompatible":
      return blocked("artifact-version-mismatch", "artifact manifest compatibility version is unsupported");
    case "capability-not-allowed":
      return blocked("capability-not-allowed", "artifact capability profile is not the reviewed one");
    case "manifest-malformed":
    case "schema-unsupported":
    case "hash-mismatch":
    case "export-missing":
      return blocked("artifact-invalid", `artifact verification failed: ${verdict}`);
    default:
      return blocked("artifact-invalid", "artifact verification failed");
  }

  // 7. May initialization proceed? — initSync with the verified bytes.
  const initSync = (glueModule as { initSync?: unknown }).initSync;
  if (typeof initSync !== "function") {
    return blocked("initialization-failed", "artifact exposes no synchronous initializer");
  }
  try {
    (initSync as (arg: { module: Uint8Array }) => unknown)({ module: wasmBytes });
  } catch {
    return blocked("initialization-failed", "WASM initialization failed");
  }

  // 8. Permitted — return only the capability-limited facade.
  return {
    decision: "permitted",
    facade: createFedosProductionMasterSeedFacade(glueModule),
    appId: attestation.appId,
  };
}
