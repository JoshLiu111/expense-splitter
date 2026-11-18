"use client";

import { useSyncExternalStore } from "react";
import sampleData from "../../data/sample-groups.json";
import { importSampleGroups, type GroupSnapshot } from "@/domain";
import {
  createSessionStorageRepository,
  type GuestGroupRepository,
} from "./guest-repository";

const CHANGE_EVENT = "expense-splitter:guest-change";

let repository: GuestGroupRepository | undefined;

/** The browser session's Guest repository (client only). */
export function guestRepository(): GuestGroupRepository {
  if (!repository) {
    const inner = createSessionStorageRepository(window.sessionStorage, () =>
      importSampleGroups(sampleData),
    );
    /** Runs a write, then tells subscribed views to re-read. */
    const notifying =
      <Args extends unknown[], Result>(write: (...args: Args) => Promise<Result>) =>
      async (...args: Args) => {
        const result = await write(...args);
        window.dispatchEvent(new Event(CHANGE_EVENT));
        return result;
      };
    repository = {
      ...inner,
      createGroup: notifying(inner.createGroup),
      addExpense: notifying(inner.addExpense),
      updateExpense: notifying(inner.updateExpense),
      deleteExpense: notifying(inner.deleteExpense),
      updateGroup: notifying(inner.updateGroup),
      addMember: notifying(inner.addMember),
      removeMember: notifying(inner.removeMember),
      deleteGroup: notifying(inner.deleteGroup),
    };
  }
  return repository;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Guest Groups, or `null` while rendering on the server. */
export function useGuestGroups(): GroupSnapshot[] | null {
  return useSyncExternalStore(
    subscribe,
    () => guestRepository().snapshot(),
    () => null,
  );
}
