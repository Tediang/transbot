import type { LangCode } from "./languages";
import type { Settings } from "./settings";

export const VOLC_HOST = "translate.volcengineapi.com";
export const VOLC_VERSION = "2025-03-01";

const encoder = new TextEncoder();

export class VolcError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "VolcError";
  }
}

type FetchLike = typeof fetch;

export type VolcTranslation = {
  text: string;
  detectedLanguage?: string;
};

export function toVolcLanguage(code: string): string {
  const lower = code.toLowerCase();
  if (lower === "zh-hans" || lower === "zh" || lower.startsWith("zh-")) return "zh";
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  return lower;
}

export function fromVolcLanguage(code: string): LangCode | string {
  const volc = toVolcLanguage(code);
  if (volc === "zh") return "zh-Hans";
  if (volc === "en" || volc === "ja" || volc === "ko") return volc;
  return code;
}

export async function createVolcRequest(input: {
  accessKeyId: string;
  secretAccessKey: string;
  body: string;
  now?: Date;
}): Promise<{ url: string; headers: Record<string, string>; body: string; canonicalRequest: string; authorization: string }> {
  const now = input.now ?? new Date();
  const xDate = formatVolcDate(now);
  const shortDate = xDate.slice(0, 8);
  const bodyHash = await sha256Hex(input.body);
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalHeaders = [
    "content-type:application/json",
    `host:${VOLC_HOST}`,
    `x-content-sha256:${bodyHash}`,
    `x-date:${xDate}`,
  ].join("\n") + "\n";
  const query = `Action=TranslateText&Version=${VOLC_VERSION}`;
  const canonicalRequest = ["POST", "/", query, canonicalHeaders, signedHeaders, bodyHash].join("\n");
  const scope = `${shortDate}/cn-north-1/translate/request`;
  const stringToSign = ["HMAC-SHA256", xDate, scope, await sha256Hex(canonicalRequest)].join("\n");
  const signature = await signingKeyHex(input.secretAccessKey, shortDate, stringToSign);
  const authorization = `HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    url: `https://${VOLC_HOST}/?${query}`,
    headers: {
      "Content-Type": "application/json",
      "X-Date": xDate,
      "X-Content-Sha256": bodyHash,
      Authorization: authorization,
    },
    body: input.body,
    canonicalRequest,
    authorization,
  };
}

export async function volcTranslate(
  settings: Settings,
  text: string,
  target: LangCode,
  source: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<VolcTranslation> {
  if (!settings.volcAccessKey || !settings.volcSecretKey) {
    throw new VolcError("还没有填写火山引擎的 Access Key ID 和 Secret Access Key。打开设置页添加。", 0);
  }
  const targetLanguage = toVolcLanguage(target);
  const sourceLanguage = source ? toVolcLanguage(source) : undefined;
  if (sourceLanguage && sourceLanguage === targetLanguage) {
    throw new VolcError("源语言和目标语言相同。换一个目标语言。", 0);
  }

  const payload: { SourceLanguage?: string; TargetLanguage: string; TextList: string[] } = {
    ...(sourceLanguage ? { SourceLanguage: sourceLanguage } : {}),
    TargetLanguage: targetLanguage,
    TextList: [text],
  };
  const body = JSON.stringify(payload);
  const signed = await createVolcRequest({
    accessKeyId: settings.volcAccessKey,
    secretAccessKey: settings.volcSecretKey,
    body,
  });

  let response: Response;
  try {
    response = await fetchImpl(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new VolcError("连不上火山引擎。检查网络后再试。", 0);
  }

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    throw new VolcError(response.ok ? "火山引擎没有返回译文。" : `火山引擎请求失败（${response.status}）。`, response.status);
  }
  const record = asRecord(parsed);
  const error = asRecord(asRecord(record.ResponseMetadata).Error);
  const code = errorCode(error.Code);
  const detail = asString(error.Message);
  if (code || detail) throw new VolcError(messageForVolc(code, detail), response.status || 400);
  if (!response.ok) throw new VolcError(`火山引擎请求失败（${response.status}）。`, response.status);

  const first = asRecord(translationList(record)[0]);
  const translated = asString(first.Translation);
  if (!translated) throw new VolcError("火山引擎没有返回译文。", response.status || 200);
  const detected = asString(first.DetectedSourceLanguage);
  return {
    text: translated,
    detectedLanguage: detected ? String(fromVolcLanguage(detected)) : undefined,
  };
}

export function messageForVolc(code: string, detail: string): string {
  if (code === "-429") return "火山引擎请求过于频繁。";
  if (code === "-415") return detail ? `火山引擎不支持这个语言方向：${detail}` : "火山引擎不支持这个语言方向。";
  if (code === "-400") return detail ? `火山引擎拒绝了这段文字：${detail}` : "火山引擎拒绝了这段文字。";
  if (code === "-500") return "火山引擎翻译服务暂时不可用。";
  return detail ? `火山引擎：${detail}` : `火山引擎请求失败（${code}）。`;
}

function formatVolcDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
}

async function signingKeyHex(secret: string, shortDate: string, stringToSign: string): Promise<string> {
  let key: ArrayBuffer = await hmac(encoder.encode(secret), shortDate);
  key = await hmac(key, "cn-north-1");
  key = await hmac(key, "translate");
  key = await hmac(key, "request");
  return hex(await hmac(key, stringToSign));
}

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function sha256Hex(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function translationList(record: Record<string, unknown>): unknown[] {
  const nested = asArray(asRecord(record.Result).TranslationList);
  if (nested.length > 0) return nested;
  return asArray(record.TranslationList);
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

function errorCode(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
