"use client";

// 端末内（IndexedDB）の保存層。実装順序4でSupabaseに置き換える前提で、
// 画面側はこのモジュールの関数だけを使う。
import { createStore, del, get, keys, set } from "idb-keyval";
import { DEFAULT_SETTINGS, type Draft, type Entry, type Settings } from "./types";

const db = typeof indexedDB !== "undefined" ? createStore("jinsei-album", "kv") : undefined;

function requireDb() {
  if (!db) throw new Error("この環境では端末内保存が使えません");
  return db;
}

const entryKey = (date: string) => `entry:${date}`;
const photoKey = (date: string) => `photo:${date}`;
const draftKey = (date: string) => `draft:${date}`;
const SETTINGS_KEY = "settings";

export async function getEntry(date: string): Promise<Entry | undefined> {
  return get<Entry>(entryKey(date), requireDb());
}

export async function getPhoto(date: string): Promise<Blob | undefined> {
  return get<Blob>(photoKey(date), requireDb());
}

/**
 * 記録を保存する。photo が undefined なら既存写真を維持、null なら削除。
 */
export async function saveEntry(
  entry: Omit<Entry, "createdAt" | "updatedAt" | "hasPhoto">,
  photo: Blob | null | undefined,
): Promise<Entry> {
  const store = requireDb();
  const existing = await getEntry(entry.entryDate);
  const now = new Date().toISOString();

  if (photo) await set(photoKey(entry.entryDate), photo, store);
  else if (photo === null) await del(photoKey(entry.entryDate), store);

  const hasPhoto = photo === undefined ? (existing?.hasPhoto ?? false) : photo !== null;
  const saved: Entry = {
    ...entry,
    hasPhoto,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await set(entryKey(entry.entryDate), saved, store);
  return saved;
}

export async function deleteEntry(date: string): Promise<void> {
  const store = requireDb();
  await Promise.all([del(entryKey(date), store), del(photoKey(date), store), del(draftKey(date), store)]);
}

/** 記録のある日付の一覧（昇順） */
export async function listEntryDates(): Promise<string[]> {
  const all = await keys<string>(requireDb());
  return all
    .filter((k) => typeof k === "string" && k.startsWith("entry:"))
    .map((k) => k.slice("entry:".length))
    .sort();
}

export async function getDraft(date: string): Promise<Draft | undefined> {
  return get<Draft>(draftKey(date), requireDb());
}

export async function saveDraft(date: string, draft: Draft): Promise<void> {
  await set(draftKey(date), draft, requireDb());
}

export async function clearDraft(date: string): Promise<void> {
  await del(draftKey(date), requireDb());
}

export async function getSettings(): Promise<Settings> {
  const saved = await get<Partial<Settings>>(SETTINGS_KEY, requireDb());
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set(SETTINGS_KEY, settings, requireDb());
}
