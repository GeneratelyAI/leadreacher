type Rgb = { r: number; g: number; b: number };

const PLANE_SHADOW: Rgb = { r: 38, g: 20, b: 108 }; // #26146c
const PLANE_MID: Rgb = { r: 105, g: 69, b: 219 }; // #6945db
const PLANE_HIGHLIGHT: Rgb = { r: 148, g: 120, b: 235 }; // #9478eb

const ALPHA_THRESHOLD = 10;
const LUMINANCE_MIDPOINT = 0.5;

function interpolateColor(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}

function mapLuminanceToPlaneColor(luminance: number): Rgb {
  if (luminance < LUMINANCE_MIDPOINT) {
    return interpolateColor(
      PLANE_SHADOW,
      PLANE_MID,
      luminance / LUMINANCE_MIDPOINT,
    );
  }

  return interpolateColor(
    PLANE_MID,
    PLANE_HIGHLIGHT,
    (luminance - LUMINANCE_MIDPOINT) / LUMINANCE_MIDPOINT,
  );
}

function getLuminance(r: number, g: number, b: number): number {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

export function recolorPlaneFrame(img: HTMLImageElement): HTMLCanvasElement {
  const buffer = document.createElement("canvas");
  buffer.width = img.naturalWidth;
  buffer.height = img.naturalHeight;

  const bufferCtx = buffer.getContext("2d");
  if (!bufferCtx) return buffer;

  bufferCtx.drawImage(img, 0, 0);
  const imageData = bufferCtx.getImageData(0, 0, buffer.width, buffer.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_THRESHOLD) continue;

    const color = mapLuminanceToPlaneColor(
      getLuminance(data[i], data[i + 1], data[i + 2]),
    );

    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
  }

  bufferCtx.putImageData(imageData, 0, 0);
  return buffer;
}
