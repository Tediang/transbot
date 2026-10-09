import { describe, expect, it } from "vitest";
import { assertEndpoint, DEFAULT_ENDPOINT, normalizeSettings } from "./settings";

describe("normalizeSettings", () => {
  it("fills missing fields and rejects an identical language pair", () => {
    const settings = normalizeSettings({ key: "  abc  ", primary: "ja", secondary: "ja" });
    expect(settings.key).toBe("abc");
    expect(settings.endpoint).toBe(DEFAULT_ENDPOINT);
    expect(settings.primary).toBe("ja");
    expect(settings.secondary).toBe("en");
    expect(settings.selectionEnabled).toBe(true);
  });
});

describe("assertEndpoint", () => {
  it("allows official Translator hosts", () => {
    expect(assertEndpoint("https://api.cognitive.microsofttranslator.com/")).toBe(
      "https://api.cognitive.microsofttranslator.com",
    );
    expect(assertEndpoint("https://my-name.cognitiveservices.azure.com")).toBe(
      "https://my-name.cognitiveservices.azure.com",
    );
  });

  it("rejects other hosts", () => {
    expect(() => assertEndpoint("https://example.com")).toThrow(/官方域名/);
    expect(() => assertEndpoint("http://api.cognitive.microsofttranslator.com")).toThrow(/官方域名/);
  });
});
