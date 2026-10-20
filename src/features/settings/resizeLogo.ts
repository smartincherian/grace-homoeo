const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE = 5_000_000;
export const MAX_LOGO_CHARS = 200000;

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("not-image"));
    };
    img.src = url;
  });
}

/** Resizes an uploaded logo to fit maxSide and returns a webp/png data URL. */
export async function resizeLogo(file: File, maxSide = 256): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error("not-image");
  if (file.size > MAX_FILE) throw new Error("too-large");
  const img = await load(file);
  const scale = Math.min(
    1,
    maxSide / Math.max(img.naturalWidth, img.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("not-image");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let out = canvas.toDataURL("image/webp", 0.9);
  if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/png");
  if (out.length > MAX_LOGO_CHARS) throw new Error("too-large");
  return out;
}
