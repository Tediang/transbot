import { describe, expect, it } from "vitest";
import { assertEndpoint, DEFAULT_ENDPOINT, normalizeSettings, providerLabel } from "./settings";

describe("normalizeSettings", () => {
  it("fills missing fields and rejects an identical language pair", () => {
    const settings = normalizeSettings({ key: "  abc  ", primary: "ja", secondary: "ja" });
    expect(settings.key).toBe("abc");
    expect(settings.endpoint).toBe(DEFAULT_ENDPOINT);
    expect(settings.primary).toBe("ja");
    expect(settings.secondary).toBe("en");
    expect(settings.selectionEnabled).toBe(true);
    expect(settings.provider).toBe("azure");
  });

  it("keeps Volcengine credentials and ignores an unknown provider", () => {
    const settings = normalizeSettings({
      provider: "volcengine",
      volcAccessKey: " ak ",
      volcSecretKey: " sk ",
    });
    expect(settings.provider).toBe("volcengine");
    expect(settings.volcAccessKey).toBe("ak");
    expect(settings.volcSecretKey).toBe("sk");
  });
});

describe("providerLabel", () => {
  it("uses the same names as the settings page", () => {
    expect(providerLabel("azure")).toBe("Azure Translator");
    expect(providerLabel("volcengine")).toBe("火山引擎机器翻译");
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
