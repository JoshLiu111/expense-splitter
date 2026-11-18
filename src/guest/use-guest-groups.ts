"use client";

import { useSyncExternalStore } from "react";
import sampleData from "../../data/sample-groups.json";
import { importSampleGroups, type GroupSnapshot } from "@/domain";
import {
  createSessionStorageRepository,
  type GroupRepository,
} from "./guest-repository";

const CHANGE_EVENT = "expense-splitter:guest-change";

let repository: GroupRepository | undefined;

/** The browser session's Guest repository (client only). */
export function guestRepository(): GroupRepository {
  if (!repository) {
    const inner = createSessionStorageRepository(window.sessionStorage, () =>
      importSampleGroups(sampleData),
    );
    repository = {
      ...inner,
      saveGroup(group) {
        inner.saveGroup(group);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      },
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
    () => guestRepository().listGroups(),
    () => null,
  );
}
