"use client";

import { getEntry, getPhoto } from "./store";
import type { Entry } from "./types";

export type DayData = { entry?: Entry; photoUrl?: string };

// スワイプのたびにIndexedDBを読み直すとページがちらつくため、読み込んだ日をメモリに保持する。
const cache = new Map<string, Promise<DayData>>();

export function loadDay(date: string): Promise<DayData> {
  let hit = cache.get(date);
  if (!hit) {
    hit = (async () => {
      const entry = await getEntry(date);
      const photo = entry?.hasPhoto ? await getPhoto(date) : undefined;
      return { entry, photoUrl: photo ? URL.createObjectURL(photo) : undefined };
    })();
    cache.set(date, hit);
    hit.catch(() => cache.delete(date));
  }
  return hit;
}

/** 保存・削除した日のキャッシュを捨てる。 */
export function invalidateDay(date: string) {
  const hit = cache.get(date);
  cache.delete(date);
  hit?.then((d) => d.photoUrl && URL.revokeObjectURL(d.photoUrl)).catch(() => {});
}
