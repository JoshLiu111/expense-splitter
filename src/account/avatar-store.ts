/**
 * Where avatar images live. A User's `image` holds the URL `put` returns;
 * replacing or removing the avatar deletes the old image by that URL.
 */
export interface AvatarStore {
  /** Stores the image publicly and answers the URL it is served at. */
  put(pathname: string, image: Blob): Promise<string>;
  /** Deletes the image at `url`; a URL it never stored is ignored. */
  delete(url: string): Promise<void>;
}

/** An in-memory AvatarStore that can list what it holds. */
export interface MemoryAvatarStore extends AvatarStore {
  /** The URLs of the images it holds now. */
  urls(): string[];
}

/**
 * Keeps avatars in memory, for tests and for running without Vercel Blob.
 * Each image is served as a `data:` URL, so a browser can show it with no
 * server behind the store.
 */
export function createMemoryAvatarStore(): MemoryAvatarStore {
  const images = new Set<string>();
  return {
    async put(_pathname, image) {
      const bytes = Buffer.from(await image.arrayBuffer());
      const url = `data:${image.type};base64,${bytes.toString("base64")}`;
      images.add(url);
      return url;
    },
    async delete(url) {
      images.delete(url);
    },
    urls: () => [...images],
  };
}
