import "~/assets/page.css";
import { isLangCode, LANGS, type LangCode } from "@/lib/languages";
import { isResult } from "@/lib/messages";
import { resultPlainText, routeLabel } from "@/lib/render";
import { normalizeSettings, type Provider, type Settings } from "@/lib/settings";
import { loadSettings, settingsItem } from "@/lib/storage";

const providerSelect = required<HTMLSelectElement>("#provider");
const fromSelect = required<HTMLSelectElement>("#from");
const toSelect = required<HTMLSelectElement>("#to");
const sourceInput = required<HTMLTextAreaElement>("#source");
const targetInput = required<HTMLTextAreaElement>("#target");
const sourceCount = required<HTMLParagraphElement>("#source-count");
const targetCount = required<HTMLParagraphElement>("#target-count");
const goButton = required<HTMLButtonElement>("#go");
const swapButton = required<HTMLButtonElement>("#swap");
const copyButton = required<HTMLButtonElement>("#copy");
const statusLine = required<HTMLParagraphElement>("#status");
const routeLine = required<HTMLParagraphElement>("#route");

let settings: Settings | null = null;
let copyTimer = 0;

fillLangSelect(fromSelect);
fillLangSelect(toSelect);
fromSelect.value = "zh-Hans";
toSelect.value = "en";

providerSelect.addEventListener("change", () => {
  void rememberProvider(providerSelect.value === "volcengine" ? "volcengine" : "azure");
});

goButton.addEventListener("click", () => {
  void translate();
});

swapButton.addEventListener("click", () => {
  swapLanguages();
});

copyButton.addEventListener("click", () => {
  void copyTranslation();
});

sourceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void translate();
  }
});

for (const area of [sourceInput, targetInput]) {
  area.addEventListener("input", refreshCounts);
  area.addEventListener("keyup", refreshCounts);
  area.addEventListener("pointerup", refreshCounts);
  area.addEventListener("select", refreshCounts);
}

document.addEventListener("selectionchange", refreshCounts);

void init();

async function init(): Promise<void> {
  settings = await loadSettings();
  providerSelect.value = settings.provider;
  sourceInput.focus();
  refreshCounts();
}

async function rememberProvider(provider: Provider): Promise<void> {
  const current = settings ?? (await loadSettings());
  const next = normalizeSettings({ ...current, provider });
  settings = next;
  await settingsItem.setValue(next);
}

function swapLanguages(): void {
  const from = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = from;
  if (targetInput.value) {
    const source = sourceInput.value;
    sourceInput.value = targetInput.value;
    targetInput.value = source;
  }
  refreshCounts();
  sourceInput.focus();
}

async function copyTranslation(): Promise<void> {
  const text = targetInput.value;
  if (!text) {
    showStatus("没有可复制的译文。", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    targetInput.focus();
    targetInput.select();
    refreshCounts();
    showStatus("复制失败，译文已选中。", "error");
    return;
  }
  showStatus("已复制译文。", "muted");
  copyButton.textContent = "已复制";
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyButton.textContent = "复制";
  }, 1500);
}

async function translate(): Promise<void> {
  const text = sourceInput.value.trim();
  if (!text) {
    showStatus("先输入要翻译的文字。", "error");
    return;
  }
  const from = fromSelect.value;
  const to = toSelect.value;
  if (!isLangCode(from) || !isLangCode(to)) {
    showStatus("语言无效。", "error");
    return;
  }
  if (from === to) {
    showStatus("源语言和目标语言要不一样。", "error");
    return;
  }
  goButton.disabled = true;
  showStatus("翻译中…", "muted");
  routeLine.textContent = "";
  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: "transbot:translate",
      text,
      from,
      to,
    });
    if (!isResult(response)) {
      showStatus("翻译没有返回结果。", "error");
      return;
    }
    if (!response.ok) {
      showStatus(response.error, "error");
      return;
    }
    targetInput.value = resultPlainText(response);
    statusLine.textContent = "";
    routeLine.textContent = routeLabel(response);
    refreshCounts();
  } catch {
    showStatus("翻译进程没有响应。", "error");
  } finally {
    goButton.disabled = false;
  }
}

function refreshCounts(): void {
  sourceCount.textContent = countLabel(sourceInput);
  targetCount.textContent = countLabel(targetInput);
}

function countLabel(area: HTMLTextAreaElement): string {
  const total = area.value.length;
  const start = area.selectionStart ?? 0;
  const end = area.selectionEnd ?? 0;
  const selected = Math.abs(end - start);
  if (selected > 0 && document.activeElement === area) return `已选 ${selected} 字符 · 共 ${total} 字符`;
  return `${total} 字符`;
}

function fillLangSelect(select: HTMLSelectElement): void {
  select.replaceChildren();
  for (const lang of LANGS) {
    const option = document.createElement("option");
    option.value = lang.code satisfies LangCode;
    option.textContent = lang.label;
    select.append(option);
  }
}

function showStatus(message: string, kind: "muted" | "error"): void {
  statusLine.dataset.kind = kind;
  statusLine.textContent = message;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`翻译页缺少 ${selector}`);
  return element;
}
