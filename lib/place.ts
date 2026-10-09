export type Box = {
  left: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export function placeCard(
  anchor: Box,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const margin = 8;
  let left = anchor.left;
  let top = anchor.bottom + margin;
  if (left + card.width > viewport.width - margin) left = viewport.width - card.width - margin;
  if (left < margin) left = margin;
  if (top + card.height > viewport.height - margin) top = anchor.top - card.height - margin;
  if (top < margin) top = margin;
  return { top, left };
}
