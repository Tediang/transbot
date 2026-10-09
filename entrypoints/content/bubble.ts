import { sendExtensionMessage } from "@/lib/extension-message";
import { clampFrame, dragFrame, resizeFromCorner } from "@/lib/frame";
import { isResult, langChoice } from "@/lib/messages";
import { displayLang, isLangCode, LANGS, type LangCode } from "@/lib/languages";
import { placeCard } from "@/lib/place";
import { fillResult, resultPlainText } from "@/lib/render";
import type { Translation } from "@/lib/translate";

const CSS = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  color-scheme: light dark;
}
* { box-sizing: border-box; }
button, p { margin: 0; font: inherit; color: inherit; }
button { cursor: pointer; }
.card[hidden],
.launcher[hidden] { display: none !important; }
.card {
  position: relative;
  width: 320px;
  max-height: min(420px, 70vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #ddd4c4;
  border-radius: 14px;
  background: #f4f0e6;
  color: #1d1a16;
  box-shadow: 0 16px 40px rgba(40, 30, 10, 0.18);
  font: 14px/1.5 "Segoe UI", "PingFang SC", "Hiragino Sans", "Noto Sans CJK SC", "Noto Sans SC", sans-serif;
}
header, footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
}
header { border-bottom: 1px solid #ddd4c4; }
footer { border-top: 1px solid #ddd4c4; }
.route { font-size: 12px; color: #6f675c; }
.tools, .langs { display: flex; gap: 4px; }
.tools button, .langs button {
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: #3d3832;
  padding: 2px 8px;
}
.tools button {
  width: 26px;
  height: 26px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 8px;
}
.tools svg {
  width: 15px;
  height: 15px;
  display: block;
}
.tools svg * {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tools button:hover, .langs button:hover { background: rgba(44, 74, 124, 0.1); }
.langs button[aria-pressed="true"],
.tools button[aria-pressed="true"] {
  background: #2c4a7c;
  color: #f4f0e6;
}
.langs button:disabled { opacity: 0.35; cursor: default; }
.langs button:disabled:hover { background: transparent; }
.body { flex: 1; min-height: 0; padding: 10px 12px; overflow: auto; }
.card[data-pinned="true"] header { cursor: grab; }
.card[data-adjusting="drag"] header { cursor: grabbing; }
.card[data-adjusting] { user-select: none; }
.card[data-pinned="true"] .tools,
.card[data-pinned="true"] .tools button { cursor: pointer; }
.card[data-pinned="true"] footer { padding-right: 18px; }
.resize {
  display: none;
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
}
.card[data-pinned="true"] .resize { display: block; }
.resize::after {
  content: "";
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 7px;
  height: 7px;
  border-right: 2px solid #6f675c;
  border-bottom: 2px solid #6f675c;
}
.translation { font-size: 15px; white-space: pre-wrap; }
.sense { display: grid; grid-template-columns: 1.5em 1fr; column-gap: 6px; margin-bottom: 8px; }
.sense .pos { color: #2c4a7c; font-size: 12px; padding-top: 2px; }
.sense .back { grid-column: 2; margin: 0; color: #6f675c; font-size: 12px; }
.muted { color: #6f675c; }
.error { color: #8d2f2f; }
.launcher {
  display: inline-flex;
  align-items: center;
  border: 0;
  border-radius: 999px;
  padding: 4px 10px;
  background: #2c4a7c;
  color: #f4f0e6;
  box-shadow: 0 8px 20px rgba(40, 30, 10, 0.2);
  font: 13px/1.4 "Segoe UI", "PingFang SC", "Hiragino Sans", "Noto Sans CJK SC", "Noto Sans SC", sans-serif;
}
@media (prefers-color-scheme: dark) {
  .card { background: #221f1b; color: #f4f0e6; border-color: #3c362e; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45); }
  header, footer { border-color: #3c362e; }
  .route, .sense .back, .muted { color: #b7ad9f; }
  .tools button, .langs button { color: #f4f0e6; }
  .langs button[aria-pressed="true"],
  .tools button[aria-pressed="true"] { background: #8eafd6; color: #1a1815; }
  .sense .pos { color: #8eafd6; }
  .error { color: #ffb4b4; }
  .launcher { background: #8eafd6; color: #1a1815; }
  .resize::after { border-color: #b7ad9f; }
}
`;

export type Bubble = {
  destroy: () => void;
  show: (text: string, rect: DOMRect) => void;
  showMessage: (text: string, rect: DOMRect, message: string) => void;
  showLauncher: (text: string, rect: DOMRect) => void;
  hideLauncher: () => void;
  hide: () => void;
  followSelection: () => void;
  containsNode: (node: Node | null) => boolean;
  isEventInside: (event: Event) => boolean;
  readonly isPinned: boolean;
  readonly isAdjusting: boolean;
  readonly visible: boolean;
  readonly currentText: string;
};

export function createBubble(handlers: { onLaunch: (text: string, rect: DOMRect) => void }): Bubble {
  const host = createHost();
  const launcherHost = createHost();
  launcherHost.style.zIndex = "2147483647";
  const shadow = host.shadowRoot;
  const launcherShadow = launcherHost.shadowRoot;
  if (!shadow || !launcherShadow) throw new Error("Transbot 气泡没有挂上。");

  const card = document.createElement("article");
  card.className = "card";
  card.hidden = true;

  const header = document.createElement("header");
  const route = document.createElement("p");
  route.className = "route";
  const tools = document.createElement("div");
  tools.className = "tools";
  const pinButton = iconButton("pin", "pin", "钉住");
  pinButton.title = "钉住后可以拖动标题栏，右下角可以改大小。再次划词会出现翻译按钮";
  pinButton.setAttribute("aria-pressed", "false");
  const copyButton = iconButton("copy", "copy", "复制");
  const closeButton = iconButton("close", "close", "关闭");
  tools.append(pinButton, copyButton, closeButton);
  header.append(route, tools);

  const body = document.createElement("div");
  body.className = "body";

  const footer = document.createElement("footer");
  const langs = document.createElement("div");
  langs.className = "langs";
  for (const lang of LANGS) {
    const chip = button(lang.short, "lang");
    chip.dataset.lang = lang.code;
    chip.title = lang.label;
    chip.setAttribute("aria-pressed", "false");
    langs.append(chip);
  }
  footer.append(langs);
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "resize";
  resizeHandle.dataset.resize = "true";
  resizeHandle.title = "拖动改变大小";
  card.append(header, body, footer, resizeHandle);
  const launcher = button("翻译", "launch");
  launcher.className = "launcher";
  launcher.hidden = true;
  launcher.title = "Transbot 翻译";
  shadow.append(card);
  launcherShadow.append(launcher);

  let currentText = "";
  let lastRect = new DOMRect(16, 16, 0, 0);
  let placement: "card" | "launcher" | "hidden" = "hidden";
  let sourceChoice: LangCode | "auto" = "auto";
  let targetChoice: LangCode | "auto" = "auto";
  let seq = 0;
  let plain = "";
  let copyTimer = 0;
  let pinned = false;
  let launcherText = "";
  let dragOffset: { x: number; y: number } | null = null;
  let resizeStart: { x: number; y: number; left: number; top: number; width: number; height: number } | null = null;

  shadow.addEventListener("mousedown", onControlMouseDown);
  launcherShadow.addEventListener("mousedown", onControlMouseDown);

  function onControlMouseDown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof Element) || !(event instanceof MouseEvent) || event.button !== 0) return;
    if (pinned && target.closest("[data-resize]")) {
      const box = host.getBoundingClientRect();
      resizeStart = {
        x: event.clientX,
        y: event.clientY,
        left: box.left,
        top: box.top,
        width: card.offsetWidth,
        height: card.offsetHeight,
      };
      beginAdjust("resize");
      return;
    }
    if (pinned && target.closest("header") && !target.closest(".tools")) {
      const box = host.getBoundingClientRect();
      dragOffset = { x: event.clientX - box.left, y: event.clientY - box.top };
      beginAdjust("drag");
      return;
    }
    const control = target.closest("[data-action]");
    if (!(control instanceof HTMLButtonElement) || control.disabled) return;
    const action = control.dataset.action;
    if (action === "close") hide();
    if (action === "pin") setPinned(!pinned);
    if (action === "copy") void copyText();
    if (action === "launch") handlers.onLaunch(launcherText || currentText, lastRect);
    if (action === "lang") {
      const code = control.dataset.lang;
      if (code && isLangCode(code)) {
        targetChoice = code;
        void request(currentText);
      }
    }
  }

  function show(text: string, rect: DOMRect): void {
    currentText = text;
    launcherText = "";
    if (!pinned) lastRect = rect;
    sourceChoice = "auto";
    targetChoice = "auto";
    plain = "";
    placement = "card";
    launcher.hidden = true;
    reveal(pinned ? lastRect : rect, pinned);
    route.textContent = "翻译中…";
    setPressed(null);
    setBodyMessage("翻译中…", "muted");
    void request(text);
  }

  function showMessage(text: string, rect: DOMRect, message: string): void {
    seq += 1;
    currentText = text;
    launcherText = "";
    if (!pinned) lastRect = rect;
    plain = "";
    placement = "card";
    launcher.hidden = true;
    reveal(pinned ? lastRect : rect, pinned);
    route.textContent = "Transbot";
    setPressed(null);
    setBodyMessage(message, "error");
  }

  function showLauncher(text: string, rect: DOMRect): void {
    launcherText = text;
    if (!pinned) {
      seq += 1;
      currentText = text;
      lastRect = rect;
      placement = "launcher";
      card.hidden = true;
    }
    document.documentElement.append(launcherHost);
    launcher.hidden = false;
    placeLauncher(rect);
  }

  function hideLauncher(): void {
    launcher.hidden = true;
    launcherText = "";
    if (placement === "launcher") {
      placement = "hidden";
      currentText = "";
    }
  }

  function hide(): void {
    endAdjust();
    seq += 1;
    placement = "hidden";
    card.hidden = true;
    launcher.hidden = true;
    currentText = "";
    launcherText = "";
    setPinned(false);
  }

  function setPinned(next: boolean): void {
    pinned = next;
    card.dataset.pinned = next ? "true" : "false";
    if (!next) clearFrame();
    pinButton.setAttribute("aria-pressed", next ? "true" : "false");
    pinButton.setAttribute("aria-label", next ? "取消钉住" : "钉住");
    pinButton.title = next
      ? "已钉住。拖动标题栏移动，右下角改大小。再次划词会出现翻译按钮"
      : "钉住后可以拖动标题栏，右下角可以改大小。再次划词会出现翻译按钮";
  }

  function followSelection(): void {
    if (pinned && placement === "card") holdInView();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    if (!pinned && placement === "card") {
      lastRect = rect;
      move(rect);
    } else if (!pinned && placement === "launcher") {
      lastRect = rect;
    }
    if (!launcher.hidden) placeLauncher(rect);
  }

  async function request(text: string): Promise<void> {
    const token = ++seq;
    const response =
      (await sendExtensionMessage(() =>
        browser.runtime.sendMessage({
          type: "transbot:translate",
          text,
          from: sourceChoice,
          to: targetChoice,
        }),
      )) ?? { ok: false, error: "翻译进程没有响应。" };
    if (token !== seq) return;
    if (!isResult(response)) {
      setBodyMessage("翻译没有返回结果。", "error");
      return;
    }
    if (!response.ok) {
      route.textContent = "翻译失败";
      setBodyMessage(response.error, "error");
      return;
    }
    render(response);
  }

  function render(result: Translation): void {
    sourceChoice = langChoice(result.sourceLang);
    targetChoice = result.targetLang;
    plain = resultPlainText(result);
    route.textContent = `${displayLang(result.sourceLang)} → ${displayLang(result.targetLang)} · ${result.mode === "dictionary" ? "词典" : "译文"}`;
    setPressed(result.targetLang, result.sourceLang);
    fillResult(body, result);
    if (!pinned) move(lastRect);
  }

  function beginAdjust(kind: "drag" | "resize"): void {
    card.dataset.adjusting = kind;
    document.documentElement.style.cursor = kind === "drag" ? "grabbing" : "nwse-resize";
    window.addEventListener("mousemove", onAdjustMove);
    window.addEventListener("mouseup", endAdjust);
  }

  function onAdjustMove(event: MouseEvent): void {
    const view = { width: window.innerWidth, height: window.innerHeight };
    if (dragOffset) {
      const next = dragFrame(
        { x: event.clientX, y: event.clientY },
        dragOffset,
        { width: card.offsetWidth || 320, height: card.offsetHeight || 180 },
        view,
      );
      host.style.left = `${next.left}px`;
      host.style.top = `${next.top}px`;
      return;
    }
    if (!resizeStart) return;
    const size = resizeFromCorner(resizeStart, event.clientX - resizeStart.x, event.clientY - resizeStart.y, view);
    card.style.width = `${size.width}px`;
    card.style.height = `${size.height}px`;
    card.style.maxHeight = "none";
  }

  function endAdjust(): void {
    dragOffset = null;
    resizeStart = null;
    delete card.dataset.adjusting;
    document.documentElement.style.cursor = "";
    window.removeEventListener("mousemove", onAdjustMove);
    window.removeEventListener("mouseup", endAdjust);
  }

  function holdInView(): void {
    if (dragOffset || resizeStart) return;
    const box = host.getBoundingClientRect();
    const next = clampFrame(
      { left: box.left, top: box.top, width: card.offsetWidth || 320, height: card.offsetHeight || 180 },
      { width: window.innerWidth, height: window.innerHeight },
    );
    if (Math.abs(next.left - box.left) > 0.5) host.style.left = `${next.left}px`;
    if (Math.abs(next.top - box.top) > 0.5) host.style.top = `${next.top}px`;
    if (Math.abs(next.width - card.offsetWidth) > 0.5) card.style.width = `${next.width}px`;
    if (Math.abs(next.height - card.offsetHeight) > 0.5) {
      card.style.height = `${next.height}px`;
      card.style.maxHeight = "none";
    }
  }

  function clearFrame(): void {
    card.style.width = "";
    card.style.height = "";
    card.style.maxHeight = "";
  }

  function reveal(rect: DOMRect, keepPosition = false): void {
    if (!host.isConnected) document.documentElement.append(host);
    card.hidden = false;
    if (!keepPosition) move(rect);
  }

  function move(rect: DOMRect): void {
    const box = placeCard(rect, { width: card.offsetWidth || 320, height: card.offsetHeight || 180 }, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    host.style.top = `${box.top}px`;
    host.style.left = `${box.left}px`;
  }

  function placeLauncher(rect: DOMRect): void {
    const width = launcher.offsetWidth || 64;
    const height = launcher.offsetHeight || 28;
    let left = rect.right + 6;
    let top = rect.bottom - height;
    if (left + width > window.innerWidth - 8) left = rect.left - width - 6;
    if (left < 8) left = 8;
    if (top < 8) top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
    launcherHost.style.top = `${top}px`;
    launcherHost.style.left = `${left}px`;
  }

  function setBodyMessage(message: string, kind: "muted" | "error"): void {
    body.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.className = kind;
    paragraph.textContent = message;
    body.append(paragraph);
  }

  function setPressed(code: LangCode | null, sourceLang?: string): void {
    const source = sourceLang?.toLowerCase() ?? "";
    for (const chip of langs.querySelectorAll("button")) {
      const lang = chip.dataset.lang ?? "";
      const family = lang === "zh-Hans" ? "zh" : lang;
      chip.disabled = source.length > 0 && source.startsWith(family);
      chip.setAttribute("aria-pressed", lang === code ? "true" : "false");
    }
  }

  async function copyText(): Promise<void> {
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(plain);
    } catch {
      const area = document.createElement("textarea");
      area.value = plain;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setButtonIcon(copyButton, "check");
    copyButton.setAttribute("aria-label", "已复制");
    copyButton.title = "已复制";
    window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      setButtonIcon(copyButton, "copy");
      copyButton.setAttribute("aria-label", "复制");
      copyButton.title = "复制";
    }, 1200);
  }

  return {
    destroy: () => {
      endAdjust();
      host.remove();
      launcherHost.remove();
    },
    show,
    showMessage,
    showLauncher,
    hideLauncher,
    hide,
    followSelection,
    containsNode: (node) => {
      if (!node) return false;
      const root = node.getRootNode();
      return node === host || node === launcherHost || root === shadow || root === launcherShadow;
    },
    isEventInside: (event) => {
      const path = event.composedPath();
      return path.includes(host) || path.includes(launcherHost);
    },
    get isPinned() {
      return pinned && placement === "card";
    },
    get isAdjusting() {
      return dragOffset !== null || resizeStart !== null;
    },
    get visible() {
      return placement !== "hidden";
    },
    get currentText() {
      return currentText;
    },
  };
}

function createHost(): HTMLElement {
  const element = document.createElement("div");
  const root = element.attachShadow({ mode: "open" });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);
  }
  return element;
}

function button(label: string, action: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.dataset.action = action;
  element.textContent = label;
  return element;
}

type IconName = "pin" | "copy" | "check" | "close";

function iconButton(icon: IconName, action: string, label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.dataset.action = action;
  element.title = label;
  element.setAttribute("aria-label", label);
  element.append(svgIcon(icon));
  return element;
}

function setButtonIcon(element: HTMLButtonElement, icon: IconName): void {
  element.replaceChildren(svgIcon(icon));
}

function svgIcon(icon: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const shape of ICON_SHAPES[icon]) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", shape.tag);
    for (const [name, value] of Object.entries(shape.attrs)) node.setAttribute(name, value);
    svg.append(node);
  }
  return svg;
}

const ICON_SHAPES: Record<IconName, { tag: "path" | "rect"; attrs: Record<string, string> }[]> = {
  pin: [
    { tag: "path", attrs: { d: "M12 17v5" } },
    {
      tag: "path",
      attrs: {
        d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
      },
    },
  ],
  copy: [
    { tag: "rect", attrs: { x: "9", y: "9", width: "13", height: "13", rx: "2" } },
    { tag: "path", attrs: { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" } },
  ],
  check: [{ tag: "path", attrs: { d: "M20 6 9 17l-5-5" } }],
  close: [{ tag: "path", attrs: { d: "M6 6l12 12M18 6 6 18" } }],
};

