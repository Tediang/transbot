import { describe, expect, it } from "vitest";
import { dictionaryPair, guessLang, isWordLike, smartTarget } from "./route";

describe("guessLang", () => {
  it("recognizes the four scripts", () => {
    expect(guessLang("你好")).toBe("zh-Hans");
    expect(guessLang("こんにちは")).toBe("ja");
    expect(guessLang("駅前")).toBe("ja");
    expect(guessLang("안녕하세요")).toBe("ko");
    expect(guessLang("Hello")).toBe("en");
  });

  it("returns null for mixed text", () => {
    expect(guessLang("hello 世界")).toBeNull();
  });
});

describe("isWordLike", () => {
  it("accepts a word or a short name", () => {
    expect(isWordLike("hello")).toBe(true);
    expect(isWordLike("New York")).toBe(true);
    expect(isWordLike("你好")).toBe(true);
    expect(isWordLike("中华人民共和国")).toBe(true);
  });

  it("rejects sentences and longer phrases", () => {
    expect(isWordLike("Hello, world")).toBe(false);
    expect(isWordLike("hello\nworld")).toBe(false);
    expect(isWordLike("中华人民共和国成立")).toBe(false);
    expect(isWordLike("one two three four")).toBe(false);
  });
});

describe("dictionaryPair", () => {
  it("only allows pairs that include English", () => {
    expect(dictionaryPair("en", "zh-Hans")).toEqual({ from: "en", to: "zh-Hans" });
    expect(dictionaryPair("ja", "zh-Hans")).toBeNull();
    expect(dictionaryPair("zh-Hant", "en")).toBeNull();
  });
});

describe("smartTarget", () => {
  it("swaps between the home language and the foreign language", () => {
    expect(smartTarget("zh-Hans", "zh-Hans", "en")).toBe("en");
    expect(smartTarget("ja", "zh-Hans", "en")).toBe("zh-Hans");
    expect(smartTarget("en", "zh-Hans", "en")).toBe("zh-Hans");
    expect(smartTarget("ko", "ja", "en")).toBe("ja");
  });
});
