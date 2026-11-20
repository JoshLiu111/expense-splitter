import "server-only";
import { createMemoryAvatarStore, type AvatarStore } from "./avatar-store";
import { createVercelBlobAvatarStore } from "./vercel-blob-avatar-store";

const globalForAvatars = globalThis as unknown as { expenseSplitterAvatars?: AvatarStore };

/**
 * The app's avatar store: Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
 * Without it (local development and e2e runs) avatars are kept in memory and
 * served as `data:` URLs; on Vercel a missing token is a misconfiguration.
 */
export function avatarStore(): AvatarStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return createVercelBlobAvatarStore(token);
  if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  globalForAvatars.expenseSplitterAvatars ??= createMemoryAvatarStore();
  return globalForAvatars.expenseSplitterAvatars;
}
