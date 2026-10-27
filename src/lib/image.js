/**
 * Browser-side image preparation.
 *
 * Kindwise accepts images up to a few megabytes, but large phone photos waste
 * upload bandwidth and can hit the proxy body limit. We downscale to a long
 * edge of 1600 px and re-encode as JPEG before sending.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.9;
export const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateImageFile(file) {
  if (!file) return "Choose an image file first.";
  if (!ACCEPTED_TYPES.includes(file.type)) return "Use a JPG, PNG, or WebP image.";
  if (file.size > MAX_INPUT_BYTES) return "That image is over 12 MB. Pick a smaller file.";
  return "";
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This browser could not read the image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be decoded."));
    image.src = source;
  });
}

/**
 * @returns {Promise<{dataUrl: string, width: number, height: number, bytes: number, base64: string}>}
 */
export async function prepareImage(file) {
  const original = await readAsDataUrl(file);
  const image = await loadImage(original);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return {
    dataUrl,
    base64,
    width,
    height,
    bytes: Math.round((base64.length * 3) / 4),
  };
}
