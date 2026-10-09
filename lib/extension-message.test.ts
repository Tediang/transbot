import { describe, expect, it } from "vitest";
import { runtimeAlive, sendExtensionMessage } from "./extension-message";

describe("sendExtensionMessage", () => {
  it("turns a synchronous invalidated-context throw into null", async () => {
    const result = await sendExtensionMessage(() => {
      throw new Error("Extension context invalidated");
    });
    expect(result).toBeNull();
  });

  it("turns a missing runtime.sendMessage into null", async () => {
    const runtime: { sendMessage?: (message: unknown) => Promise<unknown> } | undefined = undefined;
    const result = await sendExtensionMessage(() => runtime!.sendMessage!({ type: "transbot:meta" }));
    expect(result).toBeNull();
  });

  it("returns a rejected send as null", async () => {
    const result = await sendExtensionMessage(() => Promise.reject(new Error("Extension context invalidated")));
    expect(result).toBeNull();
  });

  it("passes a normal response through", async () => {
    const result = await sendExtensionMessage(() => Promise.resolve({ selectionEnabled: true }));
    expect(result).toEqual({ selectionEnabled: true });
  });
});

describe("runtimeAlive", () => {
  it("is false when the id read throws or is missing", () => {
    expect(runtimeAlive(() => undefined)).toBe(false);
    expect(
      runtimeAlive(() => {
        throw new Error("Extension context invalidated");
      }),
    ).toBe(false);
  });

  it("is true when an extension id is present", () => {
    expect(runtimeAlive(() => "abc")).toBe(true);
  });
});
