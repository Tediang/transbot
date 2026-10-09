import { AzureError } from "@/lib/azure";
import { langChoice, isTranslateRequest, type ResultMessage, type TranslateRequest } from "@/lib/messages";
import { loadSettings } from "@/lib/storage";
import { translateText, type Translation } from "@/lib/translate";

const cache = new Map<string, Translation>();
let menuQueue: Promise<void> = Promise.resolve();

export default defineBackground(() => {
  void setupMenus();

  browser.runtime.onInstalled.addListener(() => {
    void setupMenus();
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === "translate-selection") void askActiveTab();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== "transbot-translate" || !tab?.id) return;
    const text = typeof info.selectionText === "string" ? info.selectionText : undefined;
    void browser.tabs
      .sendMessage(tab.id, { type: "transbot:show-selection", text }, { frameId: info.frameId })
      .catch(() => undefined);
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "transbot:meta") {
      void loadSettings()
        .then((settings) => {
          sendResponse({
            selectionEnabled: settings.selectionEnabled,
            hasKey: settings.key.length > 0,
            primary: settings.primary,
            secondary: settings.secondary,
          });
        })
        .catch((error: unknown) => {
          sendResponse({ ok: false, error: errorText(error) });
        });
      return true;
    }

    if (!isTranslateRequest(message)) return;

    void run(message)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        const failure: ResultMessage = { ok: false, error: errorText(error) };
        sendResponse(failure);
      });
    return true;
  });
});

function setupMenus(): Promise<void> {
  menuQueue = menuQueue
    .then(() => browser.contextMenus.removeAll())
    .then(() => {
      browser.contextMenus.create({
        id: "transbot-translate",
        title: 'Transbot：翻译“%s”',
        contexts: ["selection"],
      });
    })
    .catch(() => undefined);
  return menuQueue;
}

async function askActiveTab(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await browser.tabs.sendMessage(tab.id, { type: "transbot:show-selection" }).catch(() => undefined);
}

async function run(message: TranslateRequest): Promise<ResultMessage> {
  const settings = await loadSettings();
  const query = {
    text: message.text,
    from: langChoice(message.from),
    to: langChoice(message.to),
    primary: settings.primary,
    secondary: settings.secondary,
  };
  const cacheKey = JSON.stringify({
    text: query.text.trim(),
    from: query.from,
    to: query.to,
    primary: query.primary,
    secondary: query.secondary,
  });
  const cached = cache.get(cacheKey);
  if (cached) {
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return { ok: true, ...cached };
  }

  const translation = await translateText(query, settings);
  cache.set(cacheKey, translation);
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return { ok: true, ...translation };
}

function errorText(error: unknown): string {
  if (error instanceof AzureError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "翻译失败。";
}
