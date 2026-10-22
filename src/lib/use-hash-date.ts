"use client";

import { useSyncExternalStore } from "react";
import { dateFromHash, todayKey } from "./date";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** URLハッシュ（#2026-10-22）の日付。なければ今日。サーバー描画時は null。 */
export function useHashDate(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => dateFromHash(location.hash) ?? todayKey(),
    () => null,
  );
}
