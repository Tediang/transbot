import "~/assets/page.css";
import { displayLang, LANGS, type LangCode } from "@/lib/languages";
import { isResult, langChoice, type MetaResponse } from "@/lib/messages";
import { fillResult, routeLabel } from "@/lib/render";
import { providerLabel, type Provider } from "@/lib/settings";

const source = document.querySelector<HTMLTextAreaElement>("#source");
const from = document.querySelector<HTMLSelectElement>("#from");
const to = document.querySelector<HTMLSelectElement>("#to");
const go = document.querySelector<HTMLButtonElement>("#go");
const status = document.querySelector<HTMLParagraphElement>("#status");
const result = document.querySelector<HTMLElement>("#result");
const service = document.querySelector<HTMLParagraphElement>("#service");

if (!source || !from || !to || !go || !status || !result || !service) {
  throw new Error("翻译框缺少必要的页面元素。");
}

const sourceInput = source;
const fromSelect = from;
const toSelect = to;
const goButton = go;
const statusLine = status;
const resultBox = result;
const serviceLine = service;

void init();

document.querySelector("#open-options")?.addEventListener("click", (event) => {
  event.preventDefault();
  void browser.runtime.openOptionsPage();
});

goButton.addEventListener("click", () => {
  void translate();
});

sourceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void translate();
  }
});

async function init(): Promise<void> {
  const meta = await readMeta();
  showService(meta?.provider);
  const auto = meta ? `自动（${displayLang(meta.primary)} ↔ ${displayLang(meta.secondary)}）` : "自动";
  fillSelect(fromSelect, auto);
  fillSelect(toSelect, auto);
  sourceInput.focus();
}

async function translate(): Promise<void> {
  const text = sourceInput.value.trim();
  if (!text) {
    showStatus("先输入要翻译的文字。", "error");
    return;
  }
  goButton.disabled = true;
  showStatus("翻译中…", "muted");
  resultBox.hidden = true;
  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: "transbot:translate",
      text,
      from: langChoice(fromSelect.value),
      to: langChoice(toSelect.value),
    });
    if (!isResult(response)) {
      showStatus("翻译没有返回结果。", "error");
      return;
    }
    if (!response.ok) {
      showStatus(response.error, "error");
      return;
    }
    statusLine.hidden = true;
    resultBox.hidden = false;
    resultBox.replaceChildren();
    const route = document.createElement("p");
    route.className = "route";
    showService(response.provider);
    route.textContent = routeLabel(response);
    const body = document.createElement("div");
    fillResult(body, response);
    resultBox.append(route, body);
  } catch {
    showStatus("翻译进程没有响应。", "error");
  } finally {
    goButton.disabled = false;
  }
}

function fillSelect(select: HTMLSelectElement, autoLabel: string): void {
  select.replaceChildren();
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = autoLabel;
  select.append(auto);
  for (const lang of LANGS) {
    const option = document.createElement("option");
    option.value = lang.code satisfies LangCode;
    option.textContent = lang.label;
    select.append(option);
  }
}

async function readMeta(): Promise<MetaResponse | null> {
  const response: unknown = await browser.runtime.sendMessage({ type: "transbot:meta" }).catch(() => null);
  if (!response || typeof response !== "object" || !("primary" in response)) return null;
  return response as MetaResponse;
}

function showService(provider: Provider | undefined): void {
  if (!provider) return;
  serviceLine.textContent = providerLabel(provider);
}

function showStatus(message: string, kind: "muted" | "error"): void {
  statusLine.hidden = false;
  statusLine.dataset.kind = kind;
  statusLine.textContent = message;
}
