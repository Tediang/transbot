const MARGIN = 8;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 160;

export type Frame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function dragFrame(
  pointer: { x: number; y: number },
  offset: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const left = clamp(pointer.x - offset.x, MARGIN, Math.max(MARGIN, viewport.width - size.width - MARGIN));
  const top = clamp(pointer.y - offset.y, MARGIN, Math.max(MARGIN, viewport.height - size.height - MARGIN));
  return { left, top };
}

export function resizeFromCorner(
  start: Frame,
  deltaX: number,
  deltaY: number,
  viewport: { width: number; height: number },
): { width: number; height: number } {
  const widthLimit = Math.max(160, viewport.width - start.left - MARGIN);
  const heightLimit = Math.max(120, viewport.height - start.top - MARGIN);
  return {
    width: clamp(start.width + deltaX, Math.min(MIN_WIDTH, widthLimit), widthLimit),
    height: clamp(start.height + deltaY, Math.min(MIN_HEIGHT, heightLimit), heightLimit),
  };
}

export function clampFrame(frame: Frame, viewport: { width: number; height: number }): Frame {
  const width = Math.min(frame.width, Math.max(160, viewport.width - MARGIN * 2));
  const height = Math.min(frame.height, Math.max(120, viewport.height - MARGIN * 2));
  const left = clamp(frame.left, MARGIN, Math.max(MARGIN, viewport.width - width - MARGIN));
  const top = clamp(frame.top, MARGIN, Math.max(MARGIN, viewport.height - height - MARGIN));
  return { left, top, width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
