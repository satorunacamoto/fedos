// Secure Runtime Alpha 5321-5400 -- Phase K/L: signing toolchain inventory
// + a non-secret signing-readiness assessment.
//
// `inspectFedosSigningToolchain()` performs ONLY safe, read-only, non-
// secret inventory: does `signtool.exe` exist at a well-known location or
// on `PATH`; does `electron_builder.beta.config.json` reference any
// signing hook (`win.certificateFile`/`win.cscKeyPassword`/etc. -- none
// does, confirmed by the prior distribution review); is a
// `CSC_LINK`/`WIN_CSC_LINK`/`CSC_KEY_PASSWORD`/`WIN_CSC_KEY_PASSWORD`
// environment variable PRESENT (existence only -- this function never
// reads or logs the VALUE of any of these, since the value itself may be
// a certificate path or password). It never enumerates the Windows
// Certificate Store's Personal/My certificates (Phase K's own "do not
// inspect unrelated personal certificate material"), never prompts for
// or reads a password, and never loads private-key bytes.
//
// `assessFedosSigningReadiness(inventory)` is a PURE function over a
// plain, already-gathered, non-secret metadata object (subject, issuer,
// thumbprint, validity dates, key usage, expected product identity,
// timestamp policy presence, toolchain facts) -- it never touches a real
// certificate file itself. This split (real inventory vs. pure
// assessment) is what makes the assessment logic testable with safe
// fixtures (Phase R items 33-36) without ever creating a real signing
// key anywhere.
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Phase L — the CLOSED signing-readiness outcome vocabulary. */
export const FEDOS_SIGNING_READINESS_OUTCOMES = Object.freeze([
  "unsigned-allowed-for-beta",
  "signing-ready",
  "certificate-missing",
  "certificate-expired",
  "private-key-unavailable",
  "timestamp-service-unconfigured",
  "identity-mismatch",
  "toolchain-missing",
  "unsupported-certificate",
  "manual-review-required",
]);

const WELL_KNOWN_SDK_SIGNTOOL_DIRS = Object.freeze([
  "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64",
  "C:\\Program Files (x86)\\Windows Kits\\10\\bin",
  "C:\\Program Files\\Windows Kits\\10\\bin\\x64",
]);

/** The ONLY environment variables inspected -- EXISTENCE checked, VALUE never read/returned/logged (each may hold a certificate path or a password). */
const SIGNING_ENV_VAR_NAMES = Object.freeze(["CSC_LINK", "CSC_KEY_PASSWORD", "WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD"]);

function signtoolFoundAtWellKnownSdkPath() {
  for (const dir of WELL_KNOWN_SDK_SIGNTOOL_DIRS) {
    if (existsSync(join(dir, "signtool.exe"))) return true;
  }
  return false;
}

function signtoolFoundOnPath() {
  const pathVar = process.env.PATH ?? process.env.Path ?? "";
  for (const dir of pathVar.split(";")) {
    if (dir.length === 0) continue;
    try {
      if (existsSync(join(dir, "signtool.exe"))) return true;
    } catch {
      /* an unreadable PATH segment is not a fatal inventory error */
    }
  }
  return false;
}

/**
 * Real, safe, non-secret local toolchain inventory (Phase K). Every
 * field is a plain boolean/count fact -- never a path to personal
 * certificate material, never a secret value.
 */
export function inspectFedosSigningToolchain(electronBuilderConfig = {}) {
  const signtoolAvailable = signtoolFoundOnPath() || signtoolFoundAtWellKnownSdkPath();
  const win = electronBuilderConfig.win ?? {};
  const configReferencesSigningHook = ["certificateFile", "certificateSubjectName", "certificateSha1", "cscKeyPassword", "sign", "signingHashAlgorithms"].some(
    (key) => Object.prototype.hasOwnProperty.call(win, key),
  );
  const signingEnvVarsPresent = Object.freeze(
    SIGNING_ENV_VAR_NAMES.filter((name) => typeof process.env[name] === "string" && process.env[name].length > 0),
  );
  return Object.freeze({
    signtoolAvailable,
    configReferencesSigningHook,
    signingEnvVarNamesPresent: signingEnvVarsPresent, // names only, never values
    certificateConfigured: configReferencesSigningHook || signingEnvVarsPresent.length > 0,
  });
}

/**
 * Pure assessment over already-gathered, non-secret metadata. `certificate`
 * is `null` when none is configured (the honest, common Beta 0.1 case);
 * otherwise a plain object with SAFE fields only (`subject`, `issuer`,
 * `thumbprint`, `notBefore`, `notAfter`, `hasPrivateKey`, `keyUsageValid`,
 * `algorithm`). Never receives raw certificate/key bytes.
 */
export function assessFedosSigningReadiness({
  toolchain,
  certificate = null,
  expectedProductIdentity,
  timestampUrlConfigured = false,
  now = new Date(),
}) {
  if (certificate === null) {
    // No certificate configured at all -- the honest, current Beta 0.1 state. This is a POSITIVE,
    // actionable result (accepted V1 policy explicitly allows unsigned Beta), never reported as a
    // blocker or an error.
    return Object.freeze({ outcome: "unsigned-allowed-for-beta", reason: "no code-signing certificate is configured; the accepted V1 distribution policy explicitly allows an unsigned Beta 0.1 release" });
  }
  if (!toolchain.signtoolAvailable) {
    return Object.freeze({ outcome: "toolchain-missing", reason: "a certificate is configured but signtool.exe was not found on PATH or at a well-known Windows SDK location" });
  }
  if (certificate.hasPrivateKey === false) {
    return Object.freeze({ outcome: "private-key-unavailable", reason: "the configured certificate has no accessible private key (a public-only certificate cannot sign)" });
  }
  const notAfter = certificate.notAfter instanceof Date ? certificate.notAfter : new Date(certificate.notAfter);
  if (Number.isNaN(notAfter.getTime()) || notAfter.getTime() <= now.getTime()) {
    return Object.freeze({ outcome: "certificate-expired", reason: `certificate validity ended ${certificate.notAfter}` });
  }
  if (certificate.keyUsageValid === false) {
    return Object.freeze({ outcome: "unsupported-certificate", reason: "the configured certificate's key usage does not permit code signing" });
  }
  if (typeof expectedProductIdentity === "string" && typeof certificate.subject === "string" && !certificate.subject.includes(expectedProductIdentity)) {
    return Object.freeze({ outcome: "identity-mismatch", reason: `certificate subject "${certificate.subject}" does not reference the expected product identity "${expectedProductIdentity}"` });
  }
  if (!timestampUrlConfigured) {
    return Object.freeze({ outcome: "timestamp-service-unconfigured", reason: "no RFC 3161 timestamp URL is configured; a signature without a trusted timestamp becomes invalid once the certificate expires" });
  }
  return Object.freeze({ outcome: "signing-ready", reason: "a valid, non-expired, product-matching certificate with an accessible private key and a configured timestamp service was found" });
}
