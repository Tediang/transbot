import { describe, expect, it } from "vitest";
import { messageForStatus } from "./azure";
import { DEFAULT_ENDPOINT, type Settings } from "./settings";
import { translateText, type TranslateQuery } from "./translate";

const settings: Settings = {
  key: "secret",
  region: "eastasia",
  endpoint: DEFAULT_ENDPOINT,
  primary: "zh-Hans",
  secondary: "en",
  selectionEnabled: true,
};

const baseQuery: TranslateQuery = {
  text: "hello",
  from: "auto",
  to: "auto",
  primary: "zh-Hans",
  secondary: "en",
};

describe("translateText", () => {
  it("looks up an English word in the dictionary", async () => {
    const seen = installFetch((url) => {
      expect(url).toContain("/dictionary/lookup");
      expect(url).toContain("from=en");
      expect(url).toContain("to=zh-Hans");
      return json({
        translations: [
          dictionarySense("岸", "NOUN", 0.2, ["shore"]),
          dictionarySense("银行", "NOUN", 0.8, ["bank", "banking"]),
        ],
      });
    });

    const result = await translateText({ ...baseQuery, text: "bank", from: "en", to: "zh-Hans" }, settings, seen.fetchImpl);

    expect(result.mode).toBe("dictionary");
    expect(result.translation).toBe("银行");
    expect(result.senses[0]?.back).toEqual(["bank", "banking"]);
    expect(header(seen.calls[0]?.init, "Ocp-Apim-Subscription-Key")).toBe("secret");
    expect(header(seen.calls[0]?.init, "Ocp-Apim-Subscription-Region")).toBe("eastasia");
    expect(JSON.parse(String(seen.calls[0]?.init?.body))).toEqual([{ Text: "bank" }]);
  });

  it("translates a sentence instead of looking it up", async () => {
    const seen = installFetch((url) => {
      expect(url).toContain("/translate?");
      expect(url).toContain("to=zh-Hans");
      return json({ translations: [{ text: "你好，世界。", to: "zh-Hans" }] });
    });

    const result = await translateText({ ...baseQuery, text: "Hello, world." }, settings, seen.fetchImpl);
    expect(result.mode).toBe("text");
    expect(result.translation).toBe("你好，世界。");
    expect(result.targetLang).toBe("zh-Hans");
  });

  it("translates Japanese into the home language without the dictionary", async () => {
    const seen = installFetch((url) => {
      expect(url).not.toContain("/dictionary/");
      expect(url).toContain("from=ja");
      expect(url).toContain("to=zh-Hans");
      return json({ translations: [{ text: "你好。", to: "zh-Hans" }] });
    });

    const result = await translateText({ ...baseQuery, text: "こんにちは。" }, settings, seen.fetchImpl);
    expect(result.sourceLang).toBe("ja");
    expect(result.targetLang).toBe("zh-Hans");
  });

  it("translates a Chinese word into the foreign language", async () => {
    const seen = installFetch((url) => {
      expect(url).toContain("/dictionary/lookup");
      expect(url).toContain("from=zh-Hans");
      expect(url).toContain("to=en");
      return json({ translations: [dictionarySense("hello", "NOUN", 0.9, ["你好"])] });
    });

    const result = await translateText({ ...baseQuery, text: "你好" }, settings, seen.fetchImpl);
    expect(result.translation).toBe("hello");
    expect(result.targetLang).toBe("en");
  });

  it("detects mixed text before translating", async () => {
    const seen = installFetch((url) => {
      if (url.includes("/detect")) return json([{ language: "en", score: 0.9 }]);
      expect(url).toContain("to=zh-Hans");
      return json({ translations: [{ text: "你好，世界", to: "zh-Hans" }] });
    });

    const result = await translateText({ ...baseQuery, text: "hello 世界" }, settings, seen.fetchImpl);
    expect(seen.calls.map((call) => call.url).join(" ")).toContain("/detect");
    expect(result.translation).toBe("你好，世界");
  });

  it("falls back to translate when the dictionary rejects the word", async () => {
    const seen = installFetch((url) => {
      if (url.includes("/dictionary/")) return json({ error: { message: "not a word" } }, 400);
      return json({ translations: [{ text: "银行账户", to: "zh-Hans" }] });
    });

    const result = await translateText({ ...baseQuery, text: "bank", from: "en", to: "zh-Hans" }, settings, seen.fetchImpl);
    expect(result.mode).toBe("text");
    expect(result.translation).toBe("银行账户");
  });

  it("does not call Azure without a key", async () => {
    const seen = installFetch(() => json({}));
    await expect(translateText(baseQuery, { ...settings, key: "" }, seen.fetchImpl)).rejects.toThrow(/Azure Key/);
    expect(seen.calls).toHaveLength(0);
  });

  it("omits the region header for a global resource", async () => {
    const seen = installFetch(() => json({ translations: [{ text: "你好", to: "zh-Hans" }] }));
    await translateText({ ...baseQuery, text: "Hello there." }, { ...settings, region: "" }, seen.fetchImpl);
    expect(header(seen.calls[0]?.init, "Ocp-Apim-Subscription-Region")).toBeNull();
  });

  it("rejects an identical explicit language pair before calling Azure", async () => {
    const seen = installFetch(() => json({}));
    await expect(translateText({ ...baseQuery, from: "en", to: "en" }, settings, seen.fetchImpl)).rejects.toThrow(/相同/);
    expect(seen.calls).toHaveLength(0);
  });
});

describe("messageForStatus", () => {
  it("explains auth and quota failures", () => {
    expect(messageForStatus(401, "")).toContain("区域");
    expect(messageForStatus(429, "")).toContain("额度");
    expect(messageForStatus(400, JSON.stringify({ error: { message: "bad text" } }))).toContain("bad text");
  });
});

function dictionarySense(text: string, pos: string, confidence: number, back: string[]) {
  return {
    displayTarget: text,
    posTag: pos,
    confidence,
    backTranslations: back.map((displayText) => ({ displayText })),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(Array.isArray(body) ? body : [body]), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(handler: (url: string) => Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url);
  };
  return { fetchImpl, calls };
}

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}
