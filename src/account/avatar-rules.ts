/**
 * What an avatar upload must be. The browser checks a chosen file against
 * these before cropping it; the server checks the upload again.
 */

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

/** The largest image accepted, in bytes. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** The side, in pixels, of the square the browser crops an avatar to. */
export const AVATAR_SIDE = 256;

export const NOT_AN_IMAGE = "Choose a JPEG, PNG or WebP image.";
export const TOO_LARGE = "Choose an image of 2 MB or less.";

/** Why a file can't be an avatar, judged by its stated type and size; `undefined` if it can. */
export function avatarFileError(file: { type: string; size: number }): string | undefined {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type) || file.size === 0) return NOT_AN_IMAGE;
  if (file.size > MAX_AVATAR_BYTES) return TOO_LARGE;
  return undefined;
}

/** The image type the bytes start with, whatever the file says it is. */
export function sniffAvatarType(bytes: Uint8Array): AvatarType | undefined {
  const starts = (signature: readonly number[], at = 0) => signature.every((b, i) => bytes[at + i] === b);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts(ascii("RIFF")) && starts(ascii("WEBP"), 8)) return "image/webp";
  return undefined;
}
