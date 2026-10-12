import { azureDetect, azureDictionary, azureTranslate, AzureError, type Sense } from "./azure";
import { isLangCode, langFamily, type LangCode } from "./languages";
import { dictionaryPair, guessLang, isWordLike, smartTarget } from "./route";
import { MAX_CHARS, type Settings } from "./settings";
import { fromVolcLanguage, volcTranslate } from "./volcengine";

export type TranslateQuery = {
  text: string;
  from: LangCode | "auto";
  to: LangCode | "auto";
  primary: LangCode;
  secondary: LangCode;
};

export type Translation = {
  sourceLang: string;
  targetLang: LangCode;
  mode: "dictionary" | "text";
  translation: string;
  senses: Sense[];
  provider: Settings["provider"];
  characters: number;
  durationMs: number;
};

type BuiltTranslation = Omit<Translation, "durationMs">;

type FetchLike = typeof fetch;

export async function translateText(
  query: TranslateQuery,
  settings: Settings,
  fetchImpl: FetchLike = fetch,
): Promise<Translation> {
  const started = performance.now();
  const translation = await translateRequest(query, settings, fetchImpl);
  return { ...translation, durationMs: elapsedMs(started) };
}

async function translateRequest(
  query: TranslateQuery,
  settings: Settings,
  fetchImpl: FetchLike,
): Promise<BuiltTranslation> {
  const text = query.text.trim();
  if (!text) throw new AzureError("没有可翻译的文字。", 0);
  if (text.length > MAX_CHARS) throw new AzureError(`一次最多翻译 ${MAX_CHARS} 个字符。`, 0);
  if (query.primary === query.secondary) throw new AzureError("我的语言和外语不能相同。", 0);
  if (settings.provider === "volcengine") return translateWithVolc(text, query, settings, fetchImpl);

  const explicitFrom = query.from === "auto" ? undefined : query.from;
  let source: string | undefined = explicitFrom ?? guessLang(text) ?? undefined;
  if (!source) {
    source = (await azureDetect(settings, text, fetchImpl)).language;
  }
  if (!source) throw new AzureError("没有识别出源语言。", 0);

  const target = query.to === "auto" ? smartTarget(source, query.primary, query.secondary) : query.to;
  if (source.toLowerCase() === target.toLowerCase()) {
    throw new AzureError("源语言和目标语言相同。换一个目标语言。", 0);
  }

  const pair = isWordLike(text) ? dictionaryPair(source, target) : null;
  let characters = 0;
  if (pair) {
    characters += billedCharacters(text);
    try {
      const senses = await azureDictionary(settings, text, pair.from, pair.to, fetchImpl);
      if (senses.length > 0) {
        return {
          sourceLang: pair.from,
          targetLang: pair.to,
          mode: "dictionary",
          translation: senses[0]?.text ?? "",
          senses,
          provider: "azure",
          characters,
        };
      }
    } catch (error) {
      if (!(error instanceof AzureError) || error.status !== 400) throw error;
    }
  }

  const from = isLangCode(source) || /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(source) ? source : undefined;
  const translated = await azureTranslate(settings, text, target, from, fetchImpl);
  characters += billedCharacters(text);
  return {
    sourceLang: translated.detectedLanguage || source,
    targetLang: target,
    mode: "text",
    translation: translated.text,
    senses: [],
    provider: "azure",
    characters,
  };
}

async function translateWithVolc(
  text: string,
  query: TranslateQuery,
  settings: Settings,
  fetchImpl: FetchLike,
): Promise<BuiltTranslation> {
  const explicitFrom = query.from === "auto" ? undefined : query.from;
  const known = explicitFrom ?? guessLang(text) ?? undefined;
  const target = query.to === "auto" ? (known ? smartTarget(known, query.primary, query.secondary) : query.primary) : query.to;
  let characters = billedCharacters(text);
  const first = await volcTranslate(settings, text, target, known, fetchImpl);
  const detected = first.detectedLanguage ? String(fromVolcLanguage(first.detectedLanguage)) : undefined;
  if (query.to === "auto" && !known && detected && langFamily(detected) === langFamily(target)) {
    const other = target === query.primary ? query.secondary : query.primary;
    characters += billedCharacters(text);
    const second = await volcTranslate(settings, text, other, detected, fetchImpl);
    return volcResult(second.detectedLanguage ?? detected, other, second.text, characters);
  }
  return volcResult(known ?? detected ?? target, target, first.text, characters);
}

function volcResult(source: string, target: LangCode, text: string, characters: number): BuiltTranslation {
  const mapped = fromVolcLanguage(source);
  return {
    sourceLang: typeof mapped === "string" ? mapped : source,
    targetLang: target,
    mode: "text",
    translation: text,
    senses: [],
    provider: "volcengine",
    characters,
  };
}

/** Characters submitted for billing. Azure counts each UTF-16 code unit in Text, including spaces; Detect is free. Volcengine counts each letter, digit, symbol, and space the same way. */
function billedCharacters(text: string): number {
  return text.length;
}

function elapsedMs(started: number): number {
  return Math.max(0, Math.round(performance.now() - started));
}

