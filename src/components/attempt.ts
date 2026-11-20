/** What a form shows when its call never reached the server. */
export interface Offline {
  ok: false;
  /** Only `form` is set; the other fields read as unset, as in any failure. */
  errors: { form: string } & Partial<Record<string, string>>;
}

export const OFFLINE: Offline = {
  ok: false,
  errors: { form: "Couldn't save the change. Check your connection and try again." },
};

/**
 * Runs a form's call, turning a thrown network error into a failure with a
 * form-level error, the shape every management result shares.
 */
export async function attempt<R>(call: () => Promise<R>): Promise<R | Offline> {
  try {
    return await call();
  } catch {
    return OFFLINE;
  }
}
