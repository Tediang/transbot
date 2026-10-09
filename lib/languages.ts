export const LANGS = [
  { code: "zh-Hans", label: "简体中文", short: "中" },
  { code: "en", label: "English", short: "英" },
  { code: "ja", label: "日本語", short: "日" },
  { code: "ko", label: "한국어", short: "韩" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];

export function isLangCode(value: string): value is LangCode {
  return LANGS.some((lang) => lang.code === value);
}

export function displayLang(code: string): string {
  const known = LANGS.find((lang) => lang.code === code);
  if (known) return known.label;
  const lower = code.toLowerCase();
  if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") return "繁体中文";
  return code;
}

/** Collapse regional tags so routing can treat zh-Hant as Chinese. */
export function langFamily(code: string): string {
  const lower = code.toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  return lower;
}
