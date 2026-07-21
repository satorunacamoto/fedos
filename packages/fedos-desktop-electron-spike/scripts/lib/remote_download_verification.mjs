// Secure Runtime Alpha 5321-5400 -- Phase P: verifies a release artifact
// as fetched from a remote host matches the locally-produced, trusted
// release-manifest/publication-bundle -- WITHOUT ever auto-trusting a
// redirect or a mirror. Uses only Node's own built-in `http`/`https`
// modules (no new dependency). This module never uploads anything; it
// only downloads bytes that a human (or a test) already served, and
// checks them.
import { createHash } from "node:crypto";
import http from "node:http";
import https from "node:https";

/** Fetches a URL's full body as a Buffer, following at most one redirect (a chain longer than one hop is rejected -- it is exactly the kind of ambiguity that lets a mirror silently substitute content). */
export function fetchFedosReleaseArtifact(url, { maxRedirects = 1 } = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const chunks = [];
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(Object.assign(new Error("too many redirects"), { kind: "redirect-chain-too-long" }));
          res.resume();
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        resolve(fetchFedosReleaseArtifact(nextUrl, { maxRedirects: maxRedirects - 1 }).then((result) => ({ ...result, redirected: true })));
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        reject(Object.assign(new Error(`unexpected status ${res.statusCode}`), { kind: "unexpected-status", statusCode: res.statusCode }));
        res.resume();
        return;
      }
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ body: Buffer.concat(chunks), finalUrl: url, redirected: false }));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

/**
 * Compares a downloaded artifact's real bytes against the trusted,
 * locally-produced release manifest entry for that filename. Returns a
 * closed `{ok, problems}` result -- never throws for an ordinary
 * mismatch. A mirror/redirect that changed bytes without changing the
 * declared hash is caught here exactly like a local tamper would be.
 */
export function verifyFedosDownloadedArtifact({ filename, downloadedBytes, releaseManifest, expectedChannel = "beta", expectedProductVersion }) {
  const problems = [];
  if (typeof expectedProductVersion === "string" && releaseManifest.productVersion !== expectedProductVersion) {
    problems.push({ kind: "manifest-product-version-mismatch", expected: expectedProductVersion, actual: releaseManifest.productVersion });
  }
  if (releaseManifest.channel !== expectedChannel) {
    problems.push({ kind: "manifest-channel-mismatch", expected: expectedChannel, actual: releaseManifest.channel });
  }
  if (releaseManifest.unsigned !== true) {
    problems.push({ kind: "manifest-claims-signed", value: releaseManifest.unsigned });
  }
  const entry = (releaseManifest.artifacts ?? []).find((a) => a.filename === filename);
  if (entry === undefined) {
    return { ok: false, problems: [...problems, { kind: "artifact-not-in-manifest", filename }] };
  }
  if (downloadedBytes.length !== entry.sizeBytes) {
    problems.push({ kind: "size-mismatch", filename, expected: entry.sizeBytes, actual: downloadedBytes.length });
  }
  const realHash = createHash("sha256").update(downloadedBytes).digest("hex");
  if (realHash !== entry.sha256Hex) {
    problems.push({ kind: "hash-mismatch", filename, expected: entry.sha256Hex, actual: realHash });
  }
  return { ok: problems.length === 0, problems };
}

/** Cross-checks a downloaded publication-bundle.json's own declared WASM build identity against the trusted local release manifest's -- a mirror serving a stale/substituted bundle is caught even if individual artifact hashes still happen to match. */
export function verifyDownloadedWasmBuildIdentity(downloadedPublicationBundle, releaseManifest) {
  const expected = releaseManifest.wasmArtifactManifest;
  const actual = downloadedPublicationBundle.wasmArtifactManifest;
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    return { ok: false, problems: [{ kind: "wasm-build-identity-mismatch", expected, actual }] };
  }
  return { ok: true, problems: [] };
}
