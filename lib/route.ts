import { langFamily, type LangCode } from "./languages";

const SENTENCE_BREAK = /[\r\n。！？!?；;]/;
const CJK_PUNCT = /[，、：:「」『』（）()《》]/;

/**
 * Shinjitai that do not appear in simplified Chinese. Han-only text that
 * contains one of these is Japanese rather than Chinese.
 */
const JAPANESE_MARK = /[駅県桜竜気払込対応売楽円黒毎様譲児芸釈訳関広仏図団囲塩仮拡覚歳専戦銭残賛姉従縦粛署]/;

export function guessLang(text: string): LangCode | null {
  const hangul = count(text, /[\uac00-\ud7af]/g);
  const kana = count(text, /[\u3040-\u30ff]/g);
  const han = count(text, /[\u4e00-\u9fff]/g);
  const latin = count(text, /[A-Za-z]/g);

  if (hangul > 0 && kana === 0 && hangul >= latin) return "ko";
  if (kana > 0 && hangul === 0) return "ja";
  if (JAPANESE_MARK.test(text) && hangul === 0 && latin === 0) return "ja";
  if (han > 0 && latin === 0 && hangul === 0 && kana === 0) return "zh-Hans";
  if (latin > 0 && han === 0 && kana === 0 && hangul === 0) return "en";
  return null;
}

/** A short selection with no sentence break can use the dictionary. */
export function isWordLike(text: string): boolean {
  const value = text.trim();
  if (!value || SENTENCE_BREAK.test(value) || CJK_PUNCT.test(value)) return false;

  const hangul = count(value, /[\uac00-\ud7af]/g);
  const kana = count(value, /[\u3040-\u30ff]/g);
  const han = count(value, /[\u4e00-\u9fff]/g);
  const latin = count(value, /[A-Za-z]/g);

  if ((han > 0 || kana > 0) && latin === 0 && hangul === 0) {
    return value.replace(/\s+/g, "").length <= 8;
  }
  if (hangul > 0 && kana === 0 && han === 0 && latin === 0) {
    return value.length <= 12 && value.split(/\s+/).length <= 2;
  }
  if (latin > 0 && han === 0 && kana === 0 && hangul === 0) {
    return /^[A-Za-z]+(?:[-'][A-Za-z]+)?(?:\s+[A-Za-z]+(?:[-'][A-Za-z]+)?){0,2}$/.test(value);
  }
  return false;
}

/**
 * Dictionary Lookup only returns alternate senses between English and
 * another dictionary language. Japanese-Chinese goes through Translate.
 */
export function dictionaryPair(from: string, to: string): { from: LangCode; to: LangCode } | null {
  const source = dictionaryCode(from);
  const target = dictionaryCode(to);
  if (!source || !target || source === target) return null;
  if (source !== "en" && target !== "en") return null;
  return { from: source, to: target };
}

export function smartTarget(detected: string, primary: LangCode, secondary: LangCode): LangCode {
  const source = langFamily(detected);
  const home = langFamily(primary);
  const foreign = langFamily(secondary);
  if (source === home) {
    return foreign === home ? (primary === "en" ? "zh-Hans" : "en") : secondary;
  }
  return primary;
}

function dictionaryCode(code: string): LangCode | null {
  const lower = code.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  if (lower === "zh-hans" || lower === "zh-cn" || lower === "zh") return "zh-Hans";
  return null;
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}
