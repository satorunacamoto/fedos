#!/usr/bin/env node
/**
 * FedOS Trust / Offline Monetization + OSS Release Closure arc — offline
 * issuer CLI (§29-33, §54-55).
 *
 * Plain Node, ESM, argv-driven — this repository has no commander/yargs
 * dependency and none is added for this script, matching the existing
 * `scripts/*.mjs` convention (e.g. `scripts/package_extraction_boundary_scan.mjs`,
 * `packages/fedos-desktop-electron-spike/scripts/scan_release_artifacts_for_secrets.mjs`).
 *
 * BUILD STEP REQUIRED — this is a deliberate deviation worth flagging
 * explicitly: unlike the two scripts named above (which are entirely
 * self-contained plain JS and need no TypeScript logic at all), this
 * script's actual issuer/entitlement/signing logic lives in real,
 * type-checked TypeScript under `src/os/trust/` (`issueFedosSubscriptionEntitlement`,
 * `verifyFedosSubscriptionEntitlement`, Schnorr signing/verification, etc.)
 * — logic this script must reuse rather than reimplement, per the arc's own
 * "no separate signature scheme" rule. This repository has no `tsx`/`ts-node`
 * loader that would let a plain `node script.mjs` resolve `.ts` sources
 * on the fly (only `vitest`, via its own esbuild-backed loader, can do
 * that — which is why `test/trust_issuer_cli.test.ts` imports the *.ts
 * modules directly instead of this script). The established repository
 * precedent for "a plain Node script that needs compiled TypeScript logic"
 * is `package.json`'s own `"start:runtime": "npm run build:runtime && node
 * dist/os/messenger/desktop/runtime/run_fedos_desktop_runtime.js"` — a
 * dedicated `tsc -p <tsconfig>.json` project that emits to `dist/`, then a
 * plain `node dist/....js` run. This script follows that exact same
 * two-step shape, using the dedicated `tsconfig.trust-issuer.json` (compiles
 * `src/os/trust/**` to `dist/os/trust/**`).
 *
 * Because this arc's own hard boundary rule allows exactly ONE new
 * `package.json` script entry (`"trust:issuer"`), the build step is chained
 * INTO that one entry rather than split into a separate
 * `build:trust-issuer` + `trust:issuer` pair the way `build:runtime` +
 * `start:runtime` are split:
 *
 *   "trust:issuer": "tsc -p tsconfig.trust-issuer.json && node scripts/fedos_trust_issuer_cli.mjs"
 *
 * Run it as: `npm run trust:issuer -- <subcommand> [args...]`
 * (npm appends everything after `--` to the end of the chained command
 * line, which lands correctly after `node scripts/fedos_trust_issuer_cli.mjs`
 * since that is the last command in the chain).
 *
 * If you are hacking on this script directly and don't want to rebuild on
 * every invocation, run `npx tsc -p tsconfig.trust-issuer.json` once
 * yourself, then invoke `node scripts/fedos_trust_issuer_cli.mjs <subcommand>
 * [args...]` directly — it only ever reads from `dist/`, never triggers a
 * build itself.
 *
 * SECRET HANDLING (see `src/os/trust/issuer/fedos_trust_issuer_secret_provider.ts`
 * for the full rationale): a raw secret key is NEVER accepted as a CLI
 * argument. `generate-key` writes ONLY to an operator-supplied out-file path
 * argument (the file's CONTENTS are the secret; the argument itself is just
 * a path). `inspect-key`/`sign-entitlement` read the issuer's own secret via
 * the `FEDOS_ISSUER_KEY_FILE` environment variable, which itself holds a
 * PATH, never the secret. That key file must never be committed to this
 * repository and must never be logged. Optionally set `FEDOS_ISSUER_ID` to
 * label the issuer in signed entitlements (defaults to `"self"`).
 *
 * Subcommands:
 *   generate-key <out-file>
 *   inspect-key
 *   sign-entitlement <request-file> <plan-id> <scopes-csv> <valid-days> [--out <file>]
 *   verify-entitlement <entitlement-file> <trust-policy-file>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runFedosTrustIssuerGenerateKey,
  formatFedosTrustGenerateKeyStdout,
  computeFedosTrustIssuerIdentity,
  formatFedosTrustInspectKeyStdout,
  runFedosTrustIssuerSignEntitlement,
  formatFedosTrustSignEntitlementStdout,
  parseFedosTrustPolicyFromParsedJson,
  runFedosTrustIssuerVerifyEntitlement,
  formatFedosTrustVerifyEntitlementStdout,
} from "../dist/os/trust/issuer/fedos_trust_issuer_cli_core.js";
import { formatFedosTrustIssuerSecretForFileStorage } from "../dist/os/trust/issuer/fedos_trust_issuer_keypair.js";
import { FedosTrustIssuerEnvFileSecretProvider } from "../dist/os/trust/issuer/fedos_trust_issuer_secret_provider.js";

const __filename = fileURLToPath(import.meta.url);

function fail(message) {
  console.error(`[trust-issuer] ${message}`);
  process.exit(1);
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`could not read/parse JSON file "${path}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadIssuerSecretKeyBytes() {
  const provider = new FedosTrustIssuerEnvFileSecretProvider();
  try {
    return provider.loadSecretKeyBytes();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function cmdGenerateKey(args) {
  const [outFile] = args;
  if (!outFile) fail("usage: generate-key <out-file>");

  const { secretKeyBytes, publicKeyHex } = runFedosTrustIssuerGenerateKey();
  try {
    const secretHex = formatFedosTrustIssuerSecretForFileStorage(secretKeyBytes);
    writeFileSync(outFile, secretHex, { encoding: "utf8", mode: 0o600 });
  } finally {
    secretKeyBytes.fill(0);
  }
  console.log(formatFedosTrustGenerateKeyStdout(publicKeyHex));
  console.error(`[trust-issuer] wrote new issuer secret key to "${outFile}" — keep this file out of version control.`);
}

function cmdInspectKey() {
  const secretKeyBytes = loadIssuerSecretKeyBytes();
  let identity;
  try {
    identity = computeFedosTrustIssuerIdentity(secretKeyBytes);
  } finally {
    secretKeyBytes.fill(0);
  }
  console.log(formatFedosTrustInspectKeyStdout(identity));
}

function cmdSignEntitlement(args) {
  const [requestFile, planId, scopesCsv, validDaysRaw, ...rest] = args;
  if (!requestFile || !planId || !scopesCsv || !validDaysRaw) {
    fail("usage: sign-entitlement <request-file> <plan-id> <scopes-csv> <valid-days> [--out <file>]");
  }
  let outFile = null;
  const outIndex = rest.indexOf("--out");
  if (outIndex !== -1) outFile = rest[outIndex + 1] ?? null;

  const validDays = Number(validDaysRaw);
  const requestEnvelope = readJsonFile(requestFile);
  const issuerId = process.env.FEDOS_ISSUER_ID && process.env.FEDOS_ISSUER_ID.length > 0 ? process.env.FEDOS_ISSUER_ID : "self";

  const secretKeyBytes = loadIssuerSecretKeyBytes();
  let result;
  try {
    result = runFedosTrustIssuerSignEntitlement(requestEnvelope, planId, scopesCsv, validDays, secretKeyBytes, issuerId);
  } finally {
    secretKeyBytes.fill(0);
  }

  if (!result.ok) {
    fail(`could not sign entitlement: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
  }

  const output = formatFedosTrustSignEntitlementStdout(result.entitlement);
  if (outFile) {
    writeFileSync(outFile, output, "utf8");
    console.error(`[trust-issuer] wrote signed entitlement to "${outFile}".`);
  } else {
    console.log(output);
  }
}

function cmdVerifyEntitlement(args) {
  const [entitlementFile, trustPolicyFile] = args;
  if (!entitlementFile || !trustPolicyFile) {
    fail("usage: verify-entitlement <entitlement-file> <trust-policy-file>");
  }
  const entitlementEnvelope = readJsonFile(entitlementFile);
  const trustPolicyJson = readJsonFile(trustPolicyFile);

  let trustPolicy;
  try {
    trustPolicy = parseFedosTrustPolicyFromParsedJson(trustPolicyJson);
  } catch (error) {
    fail(`invalid trust policy file: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = runFedosTrustIssuerVerifyEntitlement(entitlementEnvelope, trustPolicy);
  console.log(formatFedosTrustVerifyEntitlementStdout(result));
}

function printUsage() {
  console.log(
    [
      "FedOS Trust offline issuer CLI",
      "",
      "Usage: npm run trust:issuer -- <subcommand> [args...]",
      "",
      "Subcommands:",
      "  generate-key <out-file>",
      "  inspect-key",
      "  sign-entitlement <request-file> <plan-id> <scopes-csv> <valid-days> [--out <file>]",
      "  verify-entitlement <entitlement-file> <trust-policy-file>",
      "",
      "Environment:",
      "  FEDOS_ISSUER_KEY_FILE  path to the issuer's own secret key file (required for inspect-key/sign-entitlement)",
      "  FEDOS_ISSUER_ID        issuer label recorded in signed entitlements (default: \"self\")",
    ].join("\n"),
  );
}

function main() {
  const [, , command, ...args] = process.argv;
  switch (command) {
    case "generate-key":
      return cmdGenerateKey(args);
    case "inspect-key":
      return cmdInspectKey();
    case "sign-entitlement":
      return cmdSignEntitlement(args);
    case "verify-entitlement":
      return cmdVerifyEntitlement(args);
    default:
      printUsage();
      if (command !== undefined) process.exit(1);
  }
}

const isDirectRun = process.argv[1] && pathResolve(process.argv[1]) === pathResolve(__filename);
if (isDirectRun) {
  main();
}
