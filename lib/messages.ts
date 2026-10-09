import { isLangCode, type LangCode } from "./languages";
import type { Provider } from "./settings";
import type { Translation } from "./translate";

export type TranslateRequest = {
  type: "transbot:translate";
  text: string;
  from: LangCode | "auto";
  to: LangCode | "auto";
};

export type MetaRequest = {
  type: "transbot:meta";
};

export type ShowSelectionRequest = {
  type: "transbot:show-selection";
  text?: string;
};

export type MetaResponse = {
  selectionEnabled: boolean;
  hasKey: boolean;
  primary: LangCode;
  secondary: LangCode;
  provider: Provider;
};

export type ResultMessage = ({ ok: true } & Translation) | { ok: false; error: string };

export function isTranslateRequest(value: unknown): value is TranslateRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<TranslateRequest>;
  return message.type === "transbot:translate" && typeof message.text === "string";
}

export function isResult(value: unknown): value is ResultMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ResultMessage>;
  if (message.ok === true) return typeof message.translation === "string" && typeof message.targetLang === "string";
  if (message.ok === false) return typeof message.error === "string";
  return false;
}

export function langChoice(value: unknown): LangCode | "auto" {
  if (value === "auto") return "auto";
  if (typeof value === "string" && isLangCode(value)) return value;
  return "auto";
}
