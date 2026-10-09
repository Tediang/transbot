import "~/assets/page.css";
import { isResult } from "@/lib/messages";
import { isLangCode, LANGS } from "@/lib/languages";
import { assertEndpoint, DEFAULT_ENDPOINT, normalizeSettings, type Provider, type Settings } from "@/lib/settings";
import { loadSettings, settingsItem } from "@/lib/storage";

const providerSelect = required<HTMLSelectElement>("#provider");
const azureFields = required<HTMLElement>("#azure-fields");
const volcFields = required<HTMLElement>("#volc-fields");
const keyInput = required<HTMLInputElement>("#key");
const regionInput = required<HTMLInputElement>("#region");
const endpointInput = required<HTMLInputElement>("#endpoint");
const volcAccessInput = required<HTMLInputElement>("#volc-access-key");
const volcSecretInput = required<HTMLInputElement>("#volc-secret-key");
const primarySelect = required<HTMLSelectElement>("#primary");
const secondarySelect = required<HTMLSelectElement>("#secondary");
const selectionInput = required<HTMLInputElement>("#selection-enabled");
const statusLine = required<HTMLParagraphElement>("#status");

fillLangSelect(primarySelect);
fillLangSelect(secondarySelect);

document.querySelector("#toggle-key")?.addEventListener("click", () => {
  toggleSecret(keyInput, "#toggle-key");
});

document.querySelector("#toggle-secret")?.addEventListener("click", () => {
  toggleSecret(volcSecretInput, "#toggle-secret");
});

providerSelect.addEventListener("change", () => {
  showProvider(providerSelect.value === "volcengine" ? "volcengine" : "azure");
});

document.querySelector("#save")?.addEventListener("click", () => {
  void persist("已保存。");
});

document.querySelector("#test")?.addEventListener("click", () => {
  void testConnection();
});

void loadSettings().then(fillForm);

function fillForm(settings: Settings): void {
  providerSelect.value = settings.provider;
  keyInput.value = settings.key;
  regionInput.value = settings.region;
  endpointInput.value = settings.endpoint || DEFAULT_ENDPOINT;
  volcAccessInput.value = settings.volcAccessKey;
  volcSecretInput.value = settings.volcSecretKey;
  primarySelect.value = settings.primary;
  secondarySelect.value = settings.secondary;
  selectionInput.checked = settings.selectionEnabled;
  showProvider(settings.provider);
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
    provider: providerSelect.value === "volcengine" ? "volcengine" : "azure",
    key: keyInput.value,
    region: regionInput.value,
    endpoint,
    volcAccessKey: volcAccessInput.value,
    volcSecretKey: volcSecretInput.value,
    primary,
    secondary,
    selectionEnabled: selectionInput.checked,
  });
}

function showProvider(provider: Provider): void {
  azureFields.hidden = provider !== "azure";
  volcFields.hidden = provider !== "volcengine";
}

function toggleSecret(input: HTMLInputElement, buttonSelector: string): void {
  const hidden = input.type === "password";
  input.type = hidden ? "text" : "password";
  const toggle = document.querySelector(buttonSelector);
  if (toggle) toggle.textContent = hidden ? "隐藏" : "显示";
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
