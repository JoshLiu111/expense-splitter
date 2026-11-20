import "server-only";
import { del, put } from "@vercel/blob";
import type { AvatarStore } from "./avatar-store";

/**
 * Avatars in a public Vercel Blob store. They are no secret: every Member of
 * a Group the User shares sees them. Each image gets a fresh URL, so a
 * replaced avatar is never served from a stale cache.
 */
export function createVercelBlobAvatarStore(token: string): AvatarStore {
  return {
    async put(pathname, image) {
      const blob = await put(pathname, image, {
        access: "public",
        addRandomSuffix: true,
        contentType: image.type,
        token,
      });
      return blob.url;
    },
    async delete(url) {
      await del(url, { token });
    },
  };
}
