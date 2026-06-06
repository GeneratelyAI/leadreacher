type DrawableFrame = HTMLCanvasElement | HTMLImageElement;

export function getFrameSize(frame: DrawableFrame) {
  if (frame instanceof HTMLCanvasElement) {
    return { width: frame.width, height: frame.height };
  }

  return { width: frame.naturalWidth, height: frame.naturalHeight };
}

export function drawCoverFrame(
  ctx: CanvasRenderingContext2D,
  frame: DrawableFrame,
  viewportWidth: number,
  viewportHeight: number,
) {
  const { width: frameWidth, height: frameHeight } = getFrameSize(frame);
  if (frameWidth === 0 || frameHeight === 0) return;

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  const scale = Math.max(
    viewportWidth / frameWidth,
    viewportHeight / frameHeight,
  );
  const drawWidth = frameWidth * scale;
  const drawHeight = frameHeight * scale;
  const x = (viewportWidth - drawWidth) / 2;
  const y = (viewportHeight - drawHeight) / 2;

  ctx.drawImage(frame, x, y, drawWidth, drawHeight);
}
