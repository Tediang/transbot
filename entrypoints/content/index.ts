import { runtimeAlive, sendExtensionMessage } from "@/lib/extension-message";
import { MAX_CHARS } from "@/lib/settings";
import { createBubble } from "./bubble";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main(ctx) {
    const bubble = createBubble({
      onLaunch(text, rect) {
        void open(text, rect, epoch, true);
      },
    });
    let timer = 0;
    let epoch = 0;

    const onMouseUp = (event: MouseEvent) => {
      if (bubble.isAdjusting || stopIfStale()) return;
      if (event.button !== 0 || bubble.isEventInside(event)) return;
      schedule(event.target);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (stopIfStale()) return;
      if (!event.shiftKey || bubble.isEventInside(event)) return;
      schedule(event.target);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (stopIfStale()) return;
      if (event.button !== 0 || bubble.isEventInside(event)) return;
      epoch += 1;
      if (bubble.isPinned) {
        bubble.hideLauncher();
        return;
      }
      bubble.hide();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      epoch += 1;
      bubble.hide();
    };

    const onScroll = () => bubble.followSelection();
    const onMessage = (message: { type?: string; text?: string }) => {
      if (message?.type !== "transbot:show-selection") return;
      const live = readSelection(document.activeElement);
      if (live && !bubble.containsNode(window.getSelection()?.anchorNode ?? null)) {
        void open(live.text, live.rect, epoch, true);
        return;
      }
      const fallback = typeof message.text === "string" ? message.text.trim() : "";
      if (!fallback) return;
      void open(fallback, new DOMRect(Math.max(16, window.innerWidth / 2 - 160), 72, 0, 0), epoch, true);
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    try {
      browser.runtime.onMessage.addListener(onMessage);
    } catch {
      detach();
      return;
    }

    ctx.onInvalidated(detach);

    function stopIfStale(): boolean {
      if (runtimeAlive(() => browser.runtime?.id)) return false;
      detach();
      return true;
    }

    function detach(): void {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      try {
        browser.runtime.onMessage.removeListener(onMessage);
      } catch {
        // The reloaded extension has already dropped this content script.
      }
      bubble.destroy();
    }

    function schedule(target: EventTarget | null): void {
      const scheduledAt = epoch;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (scheduledAt !== epoch || stopIfStale()) return;
        const captured = readSelection(target);
        if (!captured || bubble.containsNode(window.getSelection()?.anchorNode ?? null)) return;
        if (bubble.visible && bubble.currentText === captured.text) {
          bubble.followSelection();
          return;
        }
        void open(captured.text, captured.rect, scheduledAt);
      }, 180);
    }

    async function open(text: string, rect: DOMRect, scheduledAt = epoch, force = false): Promise<void> {
      if (scheduledAt !== epoch || stopIfStale()) return;
      if (!force && bubble.isPinned) {
        bubble.showLauncher(text, rect);
        return;
      }
      const meta = await sendExtensionMessage(() => browser.runtime.sendMessage({ type: "transbot:meta" }));
      if (scheduledAt !== epoch || stopIfStale()) return;
      if (!isMeta(meta)) return;
      if (!force && !meta.selectionEnabled) {
        bubble.showLauncher(text, rect);
        return;
      }
      if (text.length > MAX_CHARS) {
        bubble.showMessage(text, rect, `一次最多翻译 ${MAX_CHARS} 个字符。`);
        return;
      }
      bubble.show(text, rect);
    }
  },
});

function readSelection(target: EventTarget | null): { text: string; rect: DOMRect } | null {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target instanceof HTMLInputElement && target.type === "password") return null;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const text = target.value.slice(Math.min(start, end), Math.max(start, end)).trim();
    if (!text) return null;
    return { text, rect: target.getBoundingClientRect() };
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const element = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
    if (!element) return { text, rect: new DOMRect(16, 16, 0, 0) };
    return { text, rect: element.getBoundingClientRect() };
  }
  return { text, rect };
}

function isMeta(value: unknown): value is { selectionEnabled: boolean } {
  return !!value && typeof value === "object" && typeof (value as { selectionEnabled?: unknown }).selectionEnabled === "boolean";
}
