import { describe, expect, it } from "vitest";
import { formatDuration, routeLabel } from "./render";
import type { Translation } from "./translate";

function result(overrides: Partial<Translation> = {}): Translation {
  return {
    sourceLang: "en",
    targetLang: "zh-Hans",
    mode: "text",
    translation: "你好",
    senses: [],
    provider: "azure",
    characters: 5,
    durationMs: 842,
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("uses milliseconds under one second and seconds after that", () => {
    expect(formatDuration(0)).toBe("0 毫秒");
    expect(formatDuration(842)).toBe("842 毫秒");
    expect(formatDuration(999.4)).toBe("999 毫秒");
    expect(formatDuration(1000)).toBe("1 秒");
    expect(formatDuration(1500)).toBe("1.5 秒");
    expect(formatDuration(10500)).toBe("10.5 秒");
  });

  it("treats a missing or negative value as zero", () => {
    expect(formatDuration(Number.NaN)).toBe("0 毫秒");
    expect(formatDuration(-20)).toBe("0 毫秒");
  });
});

describe("routeLabel", () => {
  it("shows the language pair, character use, and elapsed time", () => {
    expect(routeLabel(result())).toBe(
      "English → 简体中文 · 译文 · Azure Translator · 消耗 5 字符 · 耗时 842 毫秒",
    );
  });

  it("keeps the dictionary label and formats longer calls in seconds", () => {
    expect(routeLabel(result({ mode: "dictionary", provider: "volcengine", durationMs: 2400 }))).toBe(
      "English → 简体中文 · 词典 · 火山引擎机器翻译 · 消耗 5 字符 · 耗时 2.4 秒",
    );
  });
});
