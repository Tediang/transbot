import { isLangCode, type LangCode } from "./languages";

export const DEFAULT_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
export const MAX_CHARS = 5000;

export type Provider = "azure" | "volcengine";

export type Settings = {
  provider: Provider;
  key: string;
  region: string;
  endpoint: string;
  volcAccessKey: string;
  volcSecretKey: string;
  primary: LangCode;
  secondary: LangCode;
  selectionEnabled: boolean;
};

export const defaultSettings: Settings = {
  provider: "azure",
  key: "",
  region: "",
  endpoint: DEFAULT_ENDPOINT,
  volcAccessKey: "",
  volcSecretKey: "",
  primary: "zh-Hans",
  secondary: "en",
  selectionEnabled: true,
};

const ALLOWED_ENDPOINTS = [
  /^https:\/\/api(?:-[a-z0-9]+)?\.cognitive\.microsofttranslator\.com$/,
  /^https:\/\/[a-z0-9-]+\.cognitiveservices\.azure\.com$/,
];

export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const merged: Settings = {
    ...defaultSettings,
    ...raw,
    provider: raw?.provider === "volcengine" ? "volcengine" : "azure",
    key: typeof raw?.key === "string" ? raw.key.trim() : "",
    region: typeof raw?.region === "string" ? raw.region.trim() : "",
    volcAccessKey: typeof raw?.volcAccessKey === "string" ? raw.volcAccessKey.trim() : "",
    volcSecretKey: typeof raw?.volcSecretKey === "string" ? raw.volcSecretKey.trim() : "",
    endpoint:
      typeof raw?.endpoint === "string" && raw.endpoint.trim()
        ? raw.endpoint.trim().replace(/\/+$/, "")
        : DEFAULT_ENDPOINT,
    selectionEnabled: raw?.selectionEnabled !== false,
  };
  if (!isLangCode(merged.primary)) merged.primary = defaultSettings.primary;
  if (!isLangCode(merged.secondary)) merged.secondary = defaultSettings.secondary;
  if (merged.primary === merged.secondary) {
    merged.secondary = merged.primary === "en" ? "zh-Hans" : "en";
  }
  return merged;
}

export function providerLabel(provider: Provider | undefined): string {
  return provider === "volcengine" ? "火山引擎机器翻译" : "Azure Translator";
}

export function hasCredentials(settings: Settings): boolean {
  if (settings.provider === "volcengine") return settings.volcAccessKey.length > 0 && settings.volcSecretKey.length > 0;
  return settings.key.length > 0;
}

export function assertEndpoint(endpoint: string): string {
  const normalized = endpoint.trim().replace(/\/+$/, "");
  if (!ALLOWED_ENDPOINTS.some((pattern) => pattern.test(normalized))) {
    throw new Error("接口地址只允许 Azure Translator 的官方域名。");
  }
  return normalized;
}
