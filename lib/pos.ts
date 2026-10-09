const POS_LABELS: Record<string, string> = {
  ADJ: "形",
  ADV: "副",
  CONJ: "连",
  DET: "限",
  MODAL: "情",
  NOUN: "名",
  PREP: "介",
  PRON: "代",
  VERB: "动",
  OTHER: "其他",
};

export function posLabel(tag: string): string {
  return POS_LABELS[tag.toUpperCase()] ?? tag.toLowerCase();
}
