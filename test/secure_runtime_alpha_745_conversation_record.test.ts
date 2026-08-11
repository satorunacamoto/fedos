import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/os/messenger/conversations/fedos_conversation_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import modeSource from "../src/os/messenger/board/runtime/policy/fedos_conversation_mode.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/**
 * Secure Runtime Alpha 744 ("Conversation Mode Vocabulary") / Alpha 745
 * ("Conversation Record V1 Decision") / Alpha 746 ("Policy Reference
 * Decision") -- Stages 4-6 of the Alpha 741-760 Canonical Conversation
 * Identity and Record Foundation Arc.
 */
describe("Secure Runtime Alpha 745 -- Conversation Record V1", () => {
  it("1. FedosConversationRecord has exactly 7 fields, all readonly", () => {
    const code = codeOnlyLines(recordSource);
    const interfaceStart = code.indexOf("export interface FedosConversationRecord");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    const fieldCount = (interfaceBody.match(/readonly \w+[?:]/g) ?? []).length;
    expect(fieldCount).toBe(7);
    expect((interfaceBody.match(/readonly /g) ?? []).length).toBe(fieldCount);
  });

  it("2. reuses the EXISTING FedosConversationMode -- no second mode enum is defined in this file", () => {
    expect(recordSource).toMatch(/import type \{ FedosConversationMode \} from "\.\.\/board\/runtime\/policy\/fedos_conversation_mode\.js"/);
    expect(recordSource).not.toMatch(/export type FedosConversationMode/);
  });

  it("3. no encryption key, member list, invitation/secret, delivery status, author profile, arbitrary metadata, or mutable deleted/private boolean field exists", () => {
    const code = codeOnlyLines(recordSource);
    const interfaceStart = code.indexOf("export interface FedosConversationRecord");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/key|member|invit|secret|deliver|author|metadata|deleted|private\s*[:?]|visibility/i);
  });

  it("4. no lifecycle field of any kind", () => {
    const code = codeOnlyLines(recordSource);
    const interfaceStart = code.indexOf("export interface FedosConversationRecord");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/lifecycle|state\s*[:?]|status\s*[:?]/i);
  });

  it("5. policyReference is the one V1 literal tag, not a bare string or a hash type", () => {
    expect(recordSource).toMatch(/export type FedosConversationPolicyReference = "public-v1"/);
  });

  it("6. FedosConversationMode is still exactly the 3-value union this Arc reuses unchanged", () => {
    expect(modeSource).toMatch(/export type FedosConversationMode = "public" \| "private-group" \| "direct"/);
  });

  it("7. every field is readonly -- no mutation method or setter of any kind", () => {
    expect(recordSource).not.toMatch(/\bset\s+\w+\(|=\s*\(.*\)\s*=>\s*\{[\s\S]*this\./);
  });
});
