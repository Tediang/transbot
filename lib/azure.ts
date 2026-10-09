import { assertEndpoint, type Settings } from "./settings";

export type Sense = {
  text: string;
  pos: string;
  confidence: number;
  back: string[];
};

export type Detected = {
  language: string;
  score: number;
};

export type Translated = {
  text: string;
  detectedLanguage?: string;
};

export class AzureError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AzureError";
  }
}

type FetchLike = typeof fetch;

export async function azureDetect(settings: Settings, text: string, fetchImpl: FetchLike = fetch): Promise<Detected> {
  const payload = await request(settings, "/detect?api-version=3.0", [{ Text: text }], fetchImpl);
  const row = asArray(payload)[0];
  const language = asString(asRecord(row).language);
  if (!language) throw new AzureError("Azure 没有识别出语言。", 200);
  return { language, score: asNumber(asRecord(row).score) };
}

export async function azureTranslate(
  settings: Settings,
  text: string,
  to: string,
  from: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<Translated> {
  const params = new URLSearchParams({ "api-version": "3.0", to, textType: "plain" });
  if (from) params.set("from", from);
  const payload = await request(settings, `/translate?${params}`, [{ Text: text }], fetchImpl);
  const row = asRecord(asArray(payload)[0]);
  const translations = asArray(row.translations);
  const first = asRecord(translations[0]);
  if (typeof first.text !== "string") throw new AzureError("Azure 没有返回译文。", 200);
  const translated = first.text;
  const detected = asRecord(row.detectedLanguage);
  return {
    text: translated,
    detectedLanguage: asString(detected.language) || undefined,
  };
}

export async function azureDictionary(
  settings: Settings,
  text: string,
  from: string,
  to: string,
  fetchImpl: FetchLike = fetch,
): Promise<Sense[]> {
  const params = new URLSearchParams({ "api-version": "3.0", from, to });
  const payload = await request(settings, `/dictionary/lookup?${params}`, [{ Text: text }], fetchImpl);
  const row = asRecord(asArray(payload)[0]);
  return asArray(row.translations)
    .map((item) => {
      const sense = asRecord(item);
      const back = asArray(sense.backTranslations)
        .map((entry) => asString(asRecord(entry).displayText))
        .filter(Boolean)
        .slice(0, 3);
      return {
        text: asString(sense.displayTarget),
        pos: asString(sense.posTag) || "OTHER",
        confidence: asNumber(sense.confidence),
        back,
      };
    })
    .filter((sense) => sense.text)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}

export function messageForStatus(status: number, body: string): string {
  const detail = readErrorDetail(body);
  if (status === 401 || status === 403) {
    return "密钥被拒绝。全球资源只填 Key；区域资源或多服务资源还要填写区域，例如 eastasia。";
  }
  if (status === 429) return "请求过于频繁，或本月免费额度已用完。";
  if (status === 400) return detail ? `Azure 拒绝了这段文字：${detail}` : "Azure 拒绝了这段文字。";
  return detail || `Azure 请求失败（${status}）。`;
}

async function request(settings: Settings, path: string, body: unknown, fetchImpl: FetchLike): Promise<unknown> {
  if (!settings.key) throw new AzureError("还没有填写 Azure Key。打开设置页添加。", 0);
  const endpoint = assertEndpoint(settings.endpoint);
  const headers = new Headers({
    "Ocp-Apim-Subscription-Key": settings.key,
    "Content-Type": "application/json",
  });
  if (settings.region) headers.set("Ocp-Apim-Subscription-Region", settings.region);

  let response: Response;
  try {
    response = await fetchImpl(`${endpoint}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AzureError("连不上 Azure。检查网络后再试。", 0);
  }

  const raw = await response.text();
  if (!response.ok) throw new AzureError(messageForStatus(response.status, raw), response.status);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AzureError("Azure 返回了无法识别的结果。", response.status);
  }
}

function readErrorDetail(body: string): string {
  try {
    const json = asRecord(JSON.parse(body) as unknown);
    const message = asString(asRecord(json.error).message);
    return message.slice(0, 180);
  } catch {
    return "";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}
