import { AVATAR_SIDE } from "./avatar-rules";

/**
 * Crops an image to its centred square and downsizes it to 256×256, in the
 * browser, so the upload stays small. Answers a WebP, or a PNG where the
 * browser can't encode WebP; `undefined` if the file doesn't decode.
 */
export async function cropAvatar(file: Blob): Promise<Blob | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return undefined;
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIDE;
  canvas.height = AVATAR_SIDE;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIDE,
    AVATAR_SIDE,
  );
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), "image/webp", 0.9));
}
