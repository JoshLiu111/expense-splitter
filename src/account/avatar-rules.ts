/**
 * What an avatar upload must be. The browser checks a chosen file against
 * these before cropping it; the server checks the upload again.
 */

/** Each image type an avatar may be: its name as the User reads it, and the extension it is stored under. */
const AVATAR_FORMATS = {
  "image/jpeg": { name: "JPEG", extension: "jpg" },
  "image/png": { name: "PNG", extension: "png" },
  "image/webp": { name: "WebP", extension: "webp" },
} as const;

export type AvatarType = keyof typeof AVATAR_FORMATS;
export const AVATAR_TYPES = Object.keys(AVATAR_FORMATS) as AvatarType[];

/** The file extension an avatar of `type` is stored under. */
export const avatarExtension = (type: AvatarType): string => AVATAR_FORMATS[type].extension;

/**
 * The largest image accepted, in bytes. next.config.ts's
 * `serverActions.bodySizeLimit` must stay above it, or a too-large upload is
 * refused before this check can say why.
 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** The side, in pixels, of the square the browser crops an avatar to. */
export const AVATAR_SIDE = 256;

const typeNames = AVATAR_TYPES.map((type) => AVATAR_FORMATS[type].name);
/** The types accepted, as the User reads them: "JPEG, PNG or WebP". */
export const AVATAR_TYPE_NAMES = `${typeNames.slice(0, -1).join(", ")} or ${typeNames.at(-1)}`;
/** The size limit, as the User reads it: "2 MB". */
export const AVATAR_SIZE_LIMIT = `${MAX_AVATAR_BYTES / (1024 * 1024)} MB`;

export const NOT_AN_IMAGE = `Choose a ${AVATAR_TYPE_NAMES} image.`;
export const TOO_LARGE = `Choose an image of ${AVATAR_SIZE_LIMIT} or less.`;

/** Why a file can't be an avatar, judged by its stated type and size; `undefined` if it can. */
export function avatarFileError(file: { type: string; size: number }): string | undefined {
  if (!(AVATAR_TYPES as string[]).includes(file.type) || file.size === 0) return NOT_AN_IMAGE;
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
