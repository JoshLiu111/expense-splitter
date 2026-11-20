/** The bytes each image type starts with, as the server reads them. */
const SIGNATURES = {
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  webp: [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")],
  gif: [...Buffer.from("GIF89a")],
} as const;

const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as const;

/**
 * A file that reads as an image of `kind`: its type's signature, padded to
 * `size` bytes with random ones so no two images are alike.
 */
export function anImage(
  kind: keyof typeof SIGNATURES,
  { size = 512, type = MIME[kind] }: { size?: number; type?: string } = {},
): File {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes.subarray(0, Math.min(size, 65536)));
  bytes.set(SIGNATURES[kind]);
  return new File([bytes], `avatar.${kind}`, { type });
}
