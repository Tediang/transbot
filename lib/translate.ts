import { azureDetect, azureDictionary, azureTranslate, AzureError, type Sense } from "./azure";
import { isLangCode, type LangCode } from "./languages";
import { dictionaryPair, guessLang, isWordLike, smartTarget } from "./route";
import { MAX_CHARS, type Settings } from "./settings";

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
};

type FetchLike = typeof fetch;

export async function translateText(
  query: TranslateQuery,
  settings: Settings,
  fetchImpl: FetchLike = fetch,
): Promise<Translation> {
  const text = query.text.trim();
  if (!text) throw new AzureError("没有可翻译的文字。", 0);
  if (text.length > MAX_CHARS) throw new AzureError(`一次最多翻译 ${MAX_CHARS} 个字符。`, 0);
  if (query.primary === query.secondary) throw new AzureError("我的语言和外语不能相同。", 0);

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
  if (pair) {
    try {
      const senses = await azureDictionary(settings, text, pair.from, pair.to, fetchImpl);
      if (senses.length > 0) {
        return {
          sourceLang: pair.from,
          targetLang: pair.to,
          mode: "dictionary",
          translation: senses[0]?.text ?? "",
          senses,
        };
      }
    } catch (error) {
      if (!(error instanceof AzureError) || error.status !== 400) throw error;
    }
  }

  const from = isLangCode(source) || /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(source) ? source : undefined;
  const translated = await azureTranslate(settings, text, target, from, fetchImpl);
  return {
    sourceLang: translated.detectedLanguage || source,
    targetLang: target,
    mode: "text",
    translation: translated.text,
    senses: [],
  };
}

