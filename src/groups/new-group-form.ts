import type { NewGroupFields } from "@/domain";

/** What the create-Group form shows after a submit. */
export interface CreateGroupState {
  errors?: Partial<Record<keyof NewGroupFields | "form", string>>;
  values?: NewGroupFields;
}

export type CreateGroupAction = (
  state: CreateGroupState,
  formData: FormData,
) => Promise<CreateGroupState>;

/** Reads the create-Group fields out of a submitted form. */
export function newGroupFields(formData: FormData): NewGroupFields {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return { name: get("name"), description: get("description"), currency: get("currency") };
}
