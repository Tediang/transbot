import { displayLang } from "./languages";
import { posLabel } from "./pos";
import { providerLabel } from "./settings";
import type { Translation } from "./translate";

export function routeLabel(result: Translation): string {
  const kind = result.mode === "dictionary" ? "词典" : "译文";
  return `${displayLang(result.sourceLang)} → ${displayLang(result.targetLang)} · ${kind} · ${providerLabel(result.provider)} · 消耗 ${result.characters} 字符 · 耗时 ${formatDuration(result.durationMs)}`;
}

export function formatDuration(ms: number): string {
  const rounded = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
  if (rounded < 1000) return `${rounded} 毫秒`;
  return `${(rounded / 1000).toFixed(1).replace(/\.0$/, "")} 秒`;
}

export function fillResult(container: HTMLElement, result: Translation): void {
  container.replaceChildren();
  if (result.mode === "dictionary") {
    for (const sense of result.senses) {
      const row = document.createElement("div");
      row.className = "sense";
      const pos = document.createElement("span");
      pos.className = "pos";
      pos.textContent = posLabel(sense.pos);
      const word = document.createElement("strong");
      word.textContent = sense.text;
      row.append(pos, word);
      if (sense.back.length > 0) {
        const back = document.createElement("p");
        back.className = "back";
        back.textContent = sense.back.join("、");
        row.append(back);
      }
      container.append(row);
    }
    return;
  }

  const paragraph = document.createElement("p");
  paragraph.className = "translation";
  paragraph.textContent = result.translation;
  container.append(paragraph);
}

export function resultPlainText(result: Translation): string {
  if (result.mode === "text") return result.translation;
  return result.senses
    .map((sense) => {
      const back = sense.back.length > 0 ? ` (${sense.back.join("、")})` : "";
      return `${posLabel(sense.pos)} ${sense.text}${back}`;
    })
    .join("\n");
}
