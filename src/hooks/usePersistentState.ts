import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export const usePersistentState = <T,>(
  storageKey: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const savedValue = window.localStorage.getItem(storageKey);
      return savedValue === null ? initialValue : JSON.parse(savedValue) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // The UI remains usable when storage is disabled or full.
    }
  }, [storageKey, value]);

  return [value, setValue];
};
