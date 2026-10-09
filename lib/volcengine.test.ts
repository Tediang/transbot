import { describe, expect, it } from "vitest";
import { createVolcRequest, fromVolcLanguage, messageForVolc, toVolcLanguage, volcTranslate } from "./volcengine";
import type { Settings } from "./settings";

const body = '{"TargetLanguage":"zh","TextList":["Hello world"]}';

describe("createVolcRequest", () => {
  it("signs TranslateText 2025-03-01 with the documented canonical request", async () => {
    const signed = await createVolcRequest({
      accessKeyId: "AKIDexample",
      secretAccessKey: "secretkey",
      body,
      now: new Date("2020-04-09T23:06:48.000Z"),
    });

    expect(signed.canonicalRequest).toBe(
      [
        "POST",
        "/",
        "Action=TranslateText&Version=2025-03-01",
        "content-type:application/json",
        "host:translate.volcengineapi.com",
        "x-content-sha256:8e1b0b64320caa6db6fdbac63e676d982a5bf84a547b9ca8bff95afde30a9a4e",
        "x-date:20200409T230648Z",
        "",
        "content-type;host;x-content-sha256;x-date",
        "8e1b0b64320caa6db6fdbac63e676d982a5bf84a547b9ca8bff95afde30a9a4e",
      ].join("\n"),
    );
    expect(signed.authorization).toBe(
      "HMAC-SHA256 Credential=AKIDexample/20200409/cn-north-1/translate/request, SignedHeaders=content-type;host;x-content-sha256;x-date, Signature=e43305b45db1b389a52c0c8dc7a1d03879a9eaaa6f24f2bb680bcb0bcb439add",
    );
    expect(signed.url).toBe("https://translate.volcengineapi.com/?Action=TranslateText&Version=2025-03-01");
    expect(signed.headers.Authorization).toBe(signed.authorization);
  });
});

describe("language codes", () => {
  it("maps the four supported languages to Volcengine codes", () => {
    expect(toVolcLanguage("zh-Hans")).toBe("zh");
    expect(toVolcLanguage("en")).toBe("en");
    expect(fromVolcLanguage("zh")).toBe("zh-Hans");
    expect(fromVolcLanguage("ja")).toBe("ja");
  });
});

describe("volcTranslate", () => {
  const settings = {
    provider: "volcengine",
    volcAccessKey: "AKIDexample",
    volcSecretKey: "secretkey",
  } as Settings;

  it("reads a 2025-03-01 translation wrapped in Result", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          ResponseMetadata: { Error: null, Action: "TranslateText", Version: "2025-03-01" },
          Result: { TranslationList: [{ Translation: "你好", DetectedSourceLanguage: "en" }] },
        }),
      );
    await expect(volcTranslate(settings, "hello", "zh-Hans", "en", fetchImpl)).resolves.toEqual({
      text: "你好",
      detectedLanguage: "en",
    });
  });

  it("reads the plain-text translation and detected source", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(String(input));
      expect(JSON.parse(String(init?.body))).toEqual({ TargetLanguage: "zh", TextList: ["Hello world"] });
      return new Response(
        JSON.stringify({
          TranslationList: [{ Translation: "你好世界", DetectedSourceLanguage: "en" }],
          ResponseMetadata: { Error: null },
        }),
      );
    };

    const result = await volcTranslate(settings, "Hello world", "zh-Hans", undefined, fetchImpl);
    expect(result).toEqual({ text: "你好世界", detectedLanguage: "en" });
    expect(seen[0]).toContain("Action=TranslateText");
  });

  it("surfaces an API error from ResponseMetadata", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ResponseMetadata: { Error: { Code: "-415", Message: "unsupported" } } }));
    await expect(volcTranslate(settings, "hello", "zh-Hans", "en", fetchImpl)).rejects.toThrow(/不支持/);
  });

  it("accepts a numeric error code", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ResponseMetadata: { Error: { Code: -429, Message: "busy" } } }));
    await expect(volcTranslate(settings, "hello", "zh-Hans", "en", fetchImpl)).rejects.toThrow(/频繁/);
  });
});

describe("messageForVolc", () => {
  it("explains quota failures", () => {
    expect(messageForVolc("-429", "")).toContain("频繁");
  });
});
