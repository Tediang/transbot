import "~/assets/page.css";
import { isResult } from "@/lib/messages";
import { isLangCode, LANGS } from "@/lib/languages";
import { assertEndpoint, DEFAULT_ENDPOINT, normalizeSettings, type Settings } from "@/lib/settings";
import { loadSettings, settingsItem } from "@/lib/storage";

const keyInput = required<HTMLInputElement>("#key");
const regionInput = required<HTMLInputElement>("#region");
const endpointInput = required<HTMLInputElement>("#endpoint");
const primarySelect = required<HTMLSelectElement>("#primary");
const secondarySelect = required<HTMLSelectElement>("#secondary");
const selectionInput = required<HTMLInputElement>("#selection-enabled");
const statusLine = required<HTMLParagraphElement>("#status");

fillLangSelect(primarySelect);
fillLangSelect(secondarySelect);

document.querySelector("#toggle-key")?.addEventListener("click", () => {
  const hidden = keyInput.type === "password";
  keyInput.type = hidden ? "text" : "password";
  const toggle = document.querySelector("#toggle-key");
  if (toggle) toggle.textContent = hidden ? "隐藏" : "显示";
});

document.querySelector("#save")?.addEventListener("click", () => {
  void persist("已保存。");
});

document.querySelector("#test")?.addEventListener("click", () => {
  void testConnection();
});

void loadSettings().then(fillForm);

function fillForm(settings: Settings): void {
  keyInput.value = settings.key;
  regionInput.value = settings.region;
  endpointInput.value = settings.endpoint || DEFAULT_ENDPOINT;
  primarySelect.value = settings.primary;
  secondarySelect.value = settings.secondary;
  selectionInput.checked = settings.selectionEnabled;
}

async function persist(doneMessage: string): Promise<Settings | null> {
  const draft = readDraft();
  if (!draft) return null;
  await settingsItem.setValue(draft);
  show(doneMessage, "muted");
  return draft;
}

async function testConnection(): Promise<void> {
  try {
    const saved = await persist("正在测试…");
    if (!saved) return;
    const target = saved.primary === "en" ? "zh-Hans" : saved.primary;
    const response: unknown = await browser.runtime.sendMessage({
      type: "transbot:translate",
      text: "hello",
      from: "en",
      to: target,
    });
    if (!isResult(response)) {
      show("测试没有返回结果。", "error");
      return;
    }
    if (!response.ok) {
      show(response.error, "error");
      return;
    }
    show(`连接成功：hello → ${response.translation}`, "muted");
  } catch {
    show("翻译进程没有响应。", "error");
  }
}

function readDraft(): Settings | null {
  const primary = primarySelect.value;
  const secondary = secondarySelect.value;
  if (!isLangCode(primary) || !isLangCode(secondary)) {
    show("语言无效。", "error");
    return null;
  }
  if (primary === secondary) {
    show("我的语言和外语要不一样。", "error");
    return null;
  }
  const endpoint = endpointInput.value.trim() || DEFAULT_ENDPOINT;
  try {
    assertEndpoint(endpoint);
  } catch (error) {
    show(error instanceof Error ? error.message : "接口地址无效。", "error");
    return null;
  }
  return normalizeSettings({
    key: keyInput.value,
    region: regionInput.value,
    endpoint,
    primary,
    secondary,
    selectionEnabled: selectionInput.checked,
  });
}

function fillLangSelect(select: HTMLSelectElement): void {
  for (const lang of LANGS) {
    const option = document.createElement("option");
    option.value = lang.code;
    option.textContent = lang.label;
    select.append(option);
  }
}

function show(message: string, kind: "muted" | "error"): void {
  statusLine.dataset.kind = kind;
  statusLine.textContent = message;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`设置页缺少 ${selector}`);
  return element;
}
