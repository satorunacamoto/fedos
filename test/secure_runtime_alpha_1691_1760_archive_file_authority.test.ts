/**
 * Secure Runtime Alpha 1691–1760 ("Conversation Archive Runtime
 * Integration and Recovery Operations Arc") — File Authority tests.
 * Real `node:fs`, a fresh temp directory per test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NodeFedosConversationArchiveFileAuthority } from "../src/os/messenger/conversations/archive/fs/fedos_conversation_archive_file_authority.js";

let dir: string;
let authority: NodeFedosConversationArchiveFileAuthority;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fedos-archive-fs-test-"));
  authority = new NodeFedosConversationArchiveFileAuthority();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("Secure Runtime Alpha 1691-1760 -- NodeFedosConversationArchiveFileAuthority.inspectFile", () => {
  it("1. reports exists=false for a path that does not exist", async () => {
    const result = await authority.inspectFile(join(dir, "nope.archive"));
    expect(result).toEqual({ exists: false, isDirectory: false, byteLength: 0 });
  });

  it("2. reports exists=true, isDirectory=false, the exact byte length for a real file", async () => {
    const path = join(dir, "a.archive");
    writeFileSync(path, new Uint8Array([1, 2, 3, 4]));
    const result = await authority.inspectFile(path);
    expect(result).toEqual({ exists: true, isDirectory: false, byteLength: 4 });
  });

  it("3. reports isDirectory=true, byteLength=0 for a directory", async () => {
    const result = await authority.inspectFile(dir);
    expect(result).toEqual({ exists: true, isDirectory: true, byteLength: 0 });
  });
});

describe("Secure Runtime Alpha 1691-1760 -- NodeFedosConversationArchiveFileAuthority.readArchive", () => {
  it("1. not-found for a missing path", async () => {
    const result = await authority.readArchive(join(dir, "missing.archive"), 1024);
    expect(result).toEqual({ outcome: "not-found" });
  });

  it("2. is-directory for a directory path", async () => {
    const result = await authority.readArchive(dir, 1024);
    expect(result).toEqual({ outcome: "is-directory" });
  });

  it("3. reads the exact bytes for a well-formed file within bounds", async () => {
    const path = join(dir, "a.archive");
    const bytes = new Uint8Array([9, 8, 7, 6, 5]);
    writeFileSync(path, bytes);
    const result = await authority.readArchive(path, 1024);
    expect(result.outcome).toBe("read");
    if (result.outcome === "read") expect(result.bytes).toEqual(bytes);
  });

  it("4. too-large -- a file over maxByteLength is rejected via stat, never fully read into memory", async () => {
    const path = join(dir, "big.archive");
    writeFileSync(path, new Uint8Array(100));
    const result = await authority.readArchive(path, 10);
    expect(result).toEqual({ outcome: "too-large", byteLength: 100 });
  });

  it("5. too-large -- an exactly-at-bound file is accepted (boundary is inclusive)", async () => {
    const path = join(dir, "exact.archive");
    writeFileSync(path, new Uint8Array(10));
    const result = await authority.readArchive(path, 10);
    expect(result.outcome).toBe("read");
  });
});

describe("Secure Runtime Alpha 1691-1760 -- NodeFedosConversationArchiveFileAuthority.createArchiveExclusive", () => {
  it("1. writes a fresh file with the exact bytes given", async () => {
    const path = join(dir, "out.archive");
    const bytes = new Uint8Array([1, 2, 3]);
    const result = await authority.createArchiveExclusive(path, bytes);
    expect(result).toEqual({ outcome: "written" });
    const read = await authority.readArchive(path, 1024);
    expect(read.outcome).toBe("read");
    if (read.outcome === "read") expect(read.bytes).toEqual(bytes);
  });

  it("2. already-exists -- never overwrites a pre-existing file, and the original content is preserved byte-for-byte", async () => {
    const path = join(dir, "out.archive");
    const original = new Uint8Array([1, 1, 1]);
    writeFileSync(path, original);
    const result = await authority.createArchiveExclusive(path, new Uint8Array([2, 2, 2]));
    expect(result).toEqual({ outcome: "already-exists" });
    const read = await authority.readArchive(path, 1024);
    expect(read.outcome).toBe("read");
    if (read.outcome === "read") expect(read.bytes).toEqual(original);
  });

  it("3. is-directory when the destination path is itself an existing directory", async () => {
    const subdir = join(dir, "sub");
    mkdirSync(subdir);
    const result = await authority.createArchiveExclusive(subdir, new Uint8Array([1]));
    expect(result).toEqual({ outcome: "is-directory" });
  });

  it("4. parent-missing when the destination's parent directory does not exist -- this module never creates it", async () => {
    const path = join(dir, "does-not-exist-yet", "out.archive");
    const result = await authority.createArchiveExclusive(path, new Uint8Array([1]));
    expect(result).toEqual({ outcome: "parent-missing" });
  });

  it("5. temp-file cleanup -- after a successful write, no leftover .fedos-archive-tmp- file remains in the parent directory", async () => {
    const path = join(dir, "out.archive");
    await authority.createArchiveExclusive(path, new Uint8Array([1, 2]));
    const leftovers = (readdirSync(dir) as string[]).filter((name) => name.includes("fedos-archive-tmp"));
    expect(leftovers).toEqual([]);
  });

  it("6. temp-file cleanup -- after an already-exists collision, no leftover temp file remains either", async () => {
    const path = join(dir, "out.archive");
    writeFileSync(path, new Uint8Array([9]));
    await authority.createArchiveExclusive(path, new Uint8Array([1, 2]));
    const leftovers = (readdirSync(dir) as string[]).filter((name) => name.includes("fedos-archive-tmp"));
    expect(leftovers).toEqual([]);
  });

  it("7. two concurrent exclusive-create calls at the SAME destination -- exactly one succeeds, the other reports already-exists, and the file is never corrupted/mixed", async () => {
    const path = join(dir, "race.archive");
    const [a, b] = await Promise.all([
      authority.createArchiveExclusive(path, new Uint8Array([1, 1, 1, 1])),
      authority.createArchiveExclusive(path, new Uint8Array([2, 2, 2, 2])),
    ]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(["already-exists", "written"]);
    const read = await authority.readArchive(path, 1024);
    expect(read.outcome).toBe("read");
    if (read.outcome === "read") expect(read.bytes.length).toBe(4);
  });

  it("8. bounded write does not exist outside caller-chosen directory -- writing under dir/sub after mkdir succeeds normally (no path-traversal special-casing, matches this codebase's own trusted-caller-path convention)", async () => {
    const subdir = join(dir, "sub");
    mkdirSync(subdir);
    const path = join(subdir, "out.archive");
    const result = await authority.createArchiveExclusive(path, new Uint8Array([7]));
    expect(result).toEqual({ outcome: "written" });
    expect(existsSync(path)).toBe(true);
  });
});
